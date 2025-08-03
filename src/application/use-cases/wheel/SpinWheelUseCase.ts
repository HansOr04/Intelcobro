// src/application/use-cases/wheel/SpinWheelUseCase.ts

import { WheelResult } from '../../../domain/entities/WheelResult';
import { WheelSection, getSectionConfig } from '../../../domain/enums/WheelSection';
import { DiscountPercentage } from '../../../domain/value-objects/DiscountPercentage';
import { WheelSpinRequestDTO, WheelSpinResponseDTO } from '../../dto/WheelSpinDTO';
import { ValidationException } from '../../exceptions/ValidationException';
import { logger } from '../../../shared/utils/Logger';
import { randomGenerator } from '../../../shared/utils/RandomGenerator';

/**
 * Opciones para el caso de uso de girar rueda
 */
export interface SpinWheelOptions {
  validateCooldown?: boolean;
  validateSpinLimits?: boolean;
  saveResult?: boolean;
  logSpin?: boolean;
  metadata?: Record<string, any>;
}

/**
 * Resultado del giro de rueda
 */
export interface SpinWheelResult {
  result: WheelSpinResponseDTO;
  canSpinAgain: boolean;
  nextSpinAllowedAt?: Date | undefined; // Explicitly allow undefined
  spinsRemainingToday: number;
  processingTime: number;
  metadata?: Record<string, any>;
}

/**
 * Límites de giro por usuario/sesión
 */
interface SpinLimits {
  maxSpinsPerSession: number;
  maxSpinsPerDay: number;
  maxSpinsPerIp: number;
  cooldownBetweenSpins: number; // en milisegundos
}

/**
 * Historial de giros del usuario
 */
interface UserSpinHistory {
  sessionId: string;
  spinsToday: WheelResult[];
  spinsInSession: WheelResult[];
  lastSpinAt?: Date | undefined; // Explicitly allow undefined
  totalSpins: number;
}

/**
 * Contexto para el procesamiento del giro
 */
interface SpinProcessingContext {
  request: WheelSpinRequestDTO;
  userHistory: UserSpinHistory;
  limits: SpinLimits;
  selectedSection: WheelSection;
  spinAngle: number;
  spinDuration: number;
  discountPercentage: DiscountPercentage;
  canSpin: boolean;
  cooldownRemaining?: number;
}

/**
 * Caso de uso para procesar giros de la rueda de descuentos
 */
export class SpinWheelUseCase {
  private readonly defaultLimits: SpinLimits = {
    maxSpinsPerSession: 3,
    maxSpinsPerDay: 10,
    maxSpinsPerIp: 15,
    cooldownBetweenSpins: 5 * 60 * 1000 // 5 minutos
  };

  /**
   * Ejecuta el caso de uso de giro de rueda
   */
  async execute(
    request: WheelSpinRequestDTO,
    options: SpinWheelOptions = {}
  ): Promise<SpinWheelResult> {
    const startTime = Date.now();
    
    try {
      // Validar entrada
      this.validateRequest(request);
      
      // Crear contexto de procesamiento
      const context = await this.createProcessingContext(request, options);
      
      // Validar si puede girar
      if (options.validateCooldown !== false || options.validateSpinLimits !== false) {
        this.validateCanSpin(context, options);
      }
      
      // Procesar el giro
      const wheelResult = await this.processWheelSpin(context, options);
      
      // Guardar resultado si está habilitado
      if (options.saveResult !== false) {
        await this.saveSpinResult(wheelResult);
      }
      
      // Log del evento si está habilitado
      if (options.logSpin !== false) {
        this.logSpinEvent(wheelResult, context);
      }
      
      const processingTime = Date.now() - startTime;
      
      // Calcular próximo giro permitido
      const nextSpinInfo = this.calculateNextSpinInfo(context, wheelResult);
      
      return {
        result: this.toResponseDTO(wheelResult, nextSpinInfo.nextSpinAllowedAt),
        canSpinAgain: nextSpinInfo.canSpinAgain,
        nextSpinAllowedAt: nextSpinInfo.nextSpinAllowedAt,
        spinsRemainingToday: nextSpinInfo.spinsRemainingToday,
        processingTime,
        metadata: {
          section: wheelResult.section,
          isWinning: wheelResult.isWinningResult(),
          ...options.metadata
        }
      };
      
    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      logger.error('Error al procesar giro de rueda', error as Error, {
        sessionId: request.sessionId,
        userId: request.userId,
        userIp: request.userIp,
        processingTime
      });
      
      throw error;
    }
  }

  /**
   * Valida la solicitud de giro
   */
  private validateRequest(request: WheelSpinRequestDTO): void {
    if (!request.sessionId || request.sessionId.trim().length === 0) {
      throw ValidationException.requiredField('sessionId');
    }

    if (request.sessionId.length > 100) {
      throw ValidationException.invalidLength('sessionId', undefined, 100, request.sessionId.length);
    }

    // Validar IP si está presente
    if (request.userIp) {
      const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
      if (!ipRegex.test(request.userIp)) {
        throw ValidationException.invalidFormat('userIp', 'dirección IP válida', request.userIp);
      }
    }
  }

  /**
   * Crea el contexto de procesamiento
   */
  private async createProcessingContext(
    request: WheelSpinRequestDTO,
    options: SpinWheelOptions
  ): Promise<SpinProcessingContext> {
    // Cargar historial del usuario
    const userHistory = await this.loadUserSpinHistory(request);
    
    // Obtener límites (podrían venir de configuración)
    const limits = this.getSpinLimits();
    
    // Generar resultado del giro
    const selectedSection = randomGenerator.generateWheelSection();
    const spinAngle = randomGenerator.generateWheelAngle(selectedSection);
    const spinDuration = randomGenerator.generateSpinDuration();
    
    // Obtener configuración de la sección
    const sectionConfig = getSectionConfig(selectedSection);
    const discountPercentage = new DiscountPercentage(sectionConfig?.discountPercentage || 0);
    
    // Verificar si puede girar
    const canSpin = this.checkCanSpin(userHistory, limits);
    const cooldownRemaining = this.calculateCooldownRemaining(userHistory, limits);

    return {
      request,
      userHistory,
      limits,
      selectedSection,
      spinAngle,
      spinDuration,
      discountPercentage,
      canSpin,
      cooldownRemaining
    };
  }

  /**
   * Valida si el usuario puede girar
   */
  private validateCanSpin(context: SpinProcessingContext, options: SpinWheelOptions): void {
    if (!context.canSpin) {
      // Determinar razón específica
      if (context.cooldownRemaining && context.cooldownRemaining > 0) {
        const minutesRemaining = Math.ceil(context.cooldownRemaining / (1000 * 60));
        throw ValidationException.rateLimitExceeded(
          'spin',
          1,
          `${minutesRemaining} minutos`
        );
      }

      // Verificar límite diario
      const today = new Date().toISOString().split('T')[0];
      const spinsToday = context.userHistory.spinsToday.filter(spin => 
        spin.timestamp.toISOString().startsWith(today || '')
      ).length;

      if (spinsToday >= context.limits.maxSpinsPerDay) {
        throw ValidationException.rateLimitExceeded(
          'spin',
          context.limits.maxSpinsPerDay,
          'día'
        );
      }

      // Verificar límite por sesión
      if (context.userHistory.spinsInSession.length >= context.limits.maxSpinsPerSession) {
        throw ValidationException.rateLimitExceeded(
          'spin',
          context.limits.maxSpinsPerSession,
          'sesión'
        );
      }

      // Error genérico
      throw ValidationException.businessRuleViolation(
        'No es posible girar la rueda en este momento',
        'spin'
      );
    }
  }

  /**
   * Procesa el giro de la rueda
   */
  private async processWheelSpin(
    context: SpinProcessingContext,
    options: SpinWheelOptions
  ): Promise<WheelResult> {
    const resultId = randomGenerator.generateId(16);
    
    const wheelResult = new WheelResult(
      resultId,
      context.request.sessionId,
      context.selectedSection,
      context.discountPercentage,
      context.spinAngle,
      context.spinDuration,
      context.request.userIp,
      context.request.userId,
      {
        userAgent: context.request.userAgent,
        processingTimestamp: new Date().toISOString(),
        ...context.request.metadata,
        ...options.metadata
      }
    );

    return wheelResult;
  }

  /**
   * Guarda el resultado del giro
   */
  private async saveSpinResult(wheelResult: WheelResult): Promise<void> {
    // En una implementación real, esto guardaría en base de datos
    logger.info('Resultado de rueda guardado', {
      id: wheelResult.id,
      sessionId: wheelResult.sessionId,
      section: wheelResult.section,
      discountPercentage: wheelResult.discountPercentage.value,
      isWinning: wheelResult.isWinningResult()
    });
  }

  /**
   * Registra el evento de giro
   */
  private logSpinEvent(wheelResult: WheelResult, context: SpinProcessingContext): void {
    logger.info('Rueda girada', {
      resultId: wheelResult.id,
      sessionId: wheelResult.sessionId,
      userId: wheelResult.userId,
      userIp: wheelResult.userIp,
      section: wheelResult.section,
      discountPercentage: wheelResult.discountPercentage.value,
      isWinning: wheelResult.isWinningResult(),
      spinAngle: wheelResult.spinAngle,
      spinDuration: wheelResult.spinDuration,
      spinsInSession: context.userHistory.spinsInSession.length + 1,
      spinsToday: context.userHistory.spinsToday.length + 1
    });
  }

  /**
   * Calcula información del próximo giro
   */
  private calculateNextSpinInfo(
    context: SpinProcessingContext,
    wheelResult: WheelResult
  ): {
    canSpinAgain: boolean;
    nextSpinAllowedAt?: Date | undefined; // Explicitly allow undefined
    spinsRemainingToday: number;
  } {
    const now = new Date();
    
    // Calcular próximo giro permitido por cooldown
    const nextSpinByCooldown = new Date(now.getTime() + context.limits.cooldownBetweenSpins);
    
    // Verificar límites
    const spinsInSessionAfter = context.userHistory.spinsInSession.length + 1;
    const spinsToday = context.userHistory.spinsToday.length + 1;
    
    const reachedSessionLimit = spinsInSessionAfter >= context.limits.maxSpinsPerSession;
    const reachedDailyLimit = spinsToday >= context.limits.maxSpinsPerDay;
    
    let canSpinAgain = !reachedSessionLimit && !reachedDailyLimit;
    let nextSpinAllowedAt: Date | undefined = undefined;
    
    if (canSpinAgain) {
      nextSpinAllowedAt = nextSpinByCooldown;
    } else if (reachedDailyLimit) {
      // Próximo día a las 00:00
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      nextSpinAllowedAt = tomorrow;
    }
    // Si se alcanzó el límite de sesión, no hay próximo giro en esta sesión
    
    const spinsRemainingToday = Math.max(0, context.limits.maxSpinsPerDay - spinsToday);

    return {
      canSpinAgain,
      nextSpinAllowedAt,
      spinsRemainingToday
    };
  }

  /**
   * Carga el historial de giros del usuario
   */
  private async loadUserSpinHistory(request: WheelSpinRequestDTO): Promise<UserSpinHistory> {
    // En una implementación real, esto vendría de base de datos
    // Por ahora simulamos un historial vacío
    
    return {
      sessionId: request.sessionId,
      spinsToday: [],
      spinsInSession: [],
      lastSpinAt: undefined,
      totalSpins: 0
    };
  }

  /**
   * Obtiene los límites de giro
   */
  private getSpinLimits(): SpinLimits {
    // En una implementación real, esto vendría de configuración
    return {
      maxSpinsPerSession: parseInt(process.env.MAX_SPINS_PER_SESSION || '3', 10),
      maxSpinsPerDay: parseInt(process.env.MAX_SPINS_PER_DAY || '10', 10),
      maxSpinsPerIp: parseInt(process.env.MAX_SPINS_PER_IP || '15', 10),
      cooldownBetweenSpins: parseInt(process.env.SPIN_COOLDOWN_MS || '300000', 10) // 5 minutos
    };
  }

  /**
   * Verifica si el usuario puede girar
   */
  private checkCanSpin(history: UserSpinHistory, limits: SpinLimits): boolean {
    const now = new Date();
    
    // Verificar cooldown
    if (history.lastSpinAt) {
      const timeSinceLastSpin = now.getTime() - history.lastSpinAt.getTime();
      if (timeSinceLastSpin < limits.cooldownBetweenSpins) {
        return false;
      }
    }

    // Verificar límite de sesión
    if (history.spinsInSession.length >= limits.maxSpinsPerSession) {
      return false;
    }

    // Verificar límite diario
    const today = now.toISOString().split('T')[0];
    const spinsToday = history.spinsToday.filter(spin => 
      spin.timestamp.toISOString().startsWith(today || '')
    ).length;
    
    if (spinsToday >= limits.maxSpinsPerDay) {
      return false;
    }

    return true;
  }

  /**
   * Calcula tiempo restante de cooldown
   */
  private calculateCooldownRemaining(history: UserSpinHistory, limits: SpinLimits): number {
    if (!history.lastSpinAt) {
      return 0;
    }

    const timeSinceLastSpin = Date.now() - history.lastSpinAt.getTime();
    return Math.max(0, limits.cooldownBetweenSpins - timeSinceLastSpin);
  }

  /**
   * Convierte resultado a DTO de respuesta
   */
  private toResponseDTO(
    wheelResult: WheelResult,
    nextSpinAllowedAt?: Date | undefined
  ): WheelSpinResponseDTO {
    return {
      id: wheelResult.id,
      sessionId: wheelResult.sessionId,
      section: wheelResult.section,
      discountPercentage: wheelResult.discountPercentage.value,
      spinAngle: wheelResult.spinAngle,
      spinDuration: wheelResult.spinDuration,
      timestamp: wheelResult.timestamp.toISOString(),
      isWinning: wheelResult.isWinningResult(),
      resultMessage: wheelResult.getResultMessage(),
      discountCode: wheelResult.isWinningResult() ? wheelResult.getDiscountCode() : undefined,
      expiresAt: wheelResult.isWinningResult() ? wheelResult.expiresAt.toISOString() : undefined,
      nextSpinAllowedAt: nextSpinAllowedAt?.toISOString()
    };
  }

  /**
   * Obtiene estadísticas de la rueda
   */
  async getWheelStats(timeRange?: { from: Date; to: Date }): Promise<{
    totalSpins: number;
    totalWins: number;
    winRate: number;
    averageDiscount: number;
    topPrizes: Array<{ section: WheelSection; count: number }>;
    uniqueUsers: number;
  }> {
    // En una implementación real, esto consultaría la base de datos
    return {
      totalSpins: 0,
      totalWins: 0,
      winRate: 0,
      averageDiscount: 0,
      topPrizes: [],
      uniqueUsers: 0
    };
  }

  /**
   * Verifica si la rueda está habilitada
   */
  async isWheelEnabled(): Promise<boolean> {
    // En una implementación real, esto vendría de configuración
    return process.env.WHEEL_ENABLED !== 'false';
  }

  /**
   * Obtiene configuración actual de la rueda
   */
  async getWheelConfig(): Promise<{
    isEnabled: boolean;
    maxSpinsPerDay: number;
    maxSpinsPerSession: number;
    cooldownBetweenSpins: number;
    sections: Array<{
      section: WheelSection;
      probability: number;
      discountPercentage: number;
    }>;
  }> {
    const limits = this.getSpinLimits();
    const isEnabled = await this.isWheelEnabled();
    
    return {
      isEnabled,
      maxSpinsPerDay: limits.maxSpinsPerDay,
      maxSpinsPerSession: limits.maxSpinsPerSession,
      cooldownBetweenSpins: limits.cooldownBetweenSpins,
      sections: [
        { section: WheelSection.DISCOUNT_5, probability: 25, discountPercentage: 5 },
        { section: WheelSection.DISCOUNT_10, probability: 20, discountPercentage: 10 },
        { section: WheelSection.DISCOUNT_15, probability: 15, discountPercentage: 15 },
        { section: WheelSection.DISCOUNT_20, probability: 15, discountPercentage: 20 },
        { section: WheelSection.DISCOUNT_25, probability: 10, discountPercentage: 25 },
        { section: WheelSection.DISCOUNT_30, probability: 8, discountPercentage: 30 },
        { section: WheelSection.DISCOUNT_50, probability: 2, discountPercentage: 50 },
        { section: WheelSection.TRY_AGAIN, probability: 5, discountPercentage: 0 }
      ]
    };
  }

  /**
   * Maneja errores de giro y proporciona respuesta de fallback
   */
  async handleSpinError(
    request: WheelSpinRequestDTO,
    error: Error
  ): Promise<WheelSpinResponseDTO> {
    logger.error('Error en giro de rueda', error, {
      sessionId: request.sessionId,
      userId: request.userId,
      userIp: request.userIp
    });

    // Crear respuesta de error
    const errorId = randomGenerator.generateId(16);
    
    return {
      id: errorId,
      sessionId: request.sessionId,
      section: WheelSection.TRY_AGAIN,
      discountPercentage: 0,
      spinAngle: 0,
      spinDuration: 0,
      timestamp: new Date().toISOString(),
      isWinning: false,
      resultMessage: 'Ha ocurrido un error. Por favor, inténtalo de nuevo más tarde.'
    };
  }

  /**
   * Obtiene historial de giros del usuario
   */
  async getUserSpinHistory(sessionId: string, userId?: string | undefined): Promise<{
    spins: Array<{
      id: string;
      section: WheelSection;
      discountPercentage: number;
      timestamp: string;
      isWinning: boolean;
      isRedeemed: boolean;
    }>;
    totalSpins: number;
    totalWins: number;
    canSpin: boolean;
    nextSpinAllowedAt?: string | undefined; // Explicitly allow undefined
  }> {
    // En una implementación real, esto consultaría la base de datos
    const history = await this.loadUserSpinHistory({ sessionId, userId });
    const limits = this.getSpinLimits();
    
    const canSpin = this.checkCanSpin(history, limits);
    let nextSpinAllowedAt: string | undefined = undefined;
    
    if (!canSpin && history.lastSpinAt) {
      const cooldownRemaining = this.calculateCooldownRemaining(history, limits);
      if (cooldownRemaining > 0) {
        nextSpinAllowedAt = new Date(Date.now() + cooldownRemaining).toISOString();
      }
    }
    
    const spins = [...history.spinsToday, ...history.spinsInSession].map(result => ({
      id: result.id,
      section: result.section,
      discountPercentage: result.discountPercentage.value,
      timestamp: result.timestamp.toISOString(),
      isWinning: result.isWinningResult(),
      isRedeemed: result.isRedeemed
    }));
    
    const totalWins = spins.filter(spin => spin.isWinning).length;
    
    return {
      spins,
      totalSpins: history.totalSpins,
      totalWins,
      canSpin,
      nextSpinAllowedAt
    };
  }

  /**
   * Valida y canjea un código de descuento de rueda
   */
  async redeemWheelDiscount(
    discountCode: string,
    userEmail: string
  ): Promise<{
    isValid: boolean;
    discount?: {
      percentage: number;
      validUntil: Date;
      alreadyRedeemed: boolean;
    };
    message: string;
  }> {
    // En una implementación real, esto consultaría y actualizaría la base de datos
    
    // Validar formato del código
    const codeRegex = /^INTEL\d+[A-Z0-9]+$/;
    if (!codeRegex.test(discountCode)) {
      return {
        isValid: false,
        message: 'Código de descuento no válido'
      };
    }

    // Extraer porcentaje del código
    const match = discountCode.match(/INTEL(\d+)/);
    if (!match || !match[1]) {
      return {
        isValid: false,
        message: 'Código de descuento no válido'
      };
    }

    const percentage = parseInt(match[1], 10);
    
    // Simular validación (en implementación real consultaría BD)
    return {
      isValid: true,
      discount: {
        percentage,
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 días
        alreadyRedeemed: false
      },
      message: `Código válido: ${percentage}% de descuento`
    };
  }

  /**
   * Obtiene métricas de rendimiento de la rueda
   */
  async getWheelMetrics(timeRange: { from: Date; to: Date }): Promise<{
    totalSpins: number;
    uniqueUsers: number;
    conversionRate: number;
    averageSpinsPerUser: number;
    sectionDistribution: Record<WheelSection, number>;
    hourlyDistribution: Array<{ hour: number; spins: number }>;
    topDiscounts: Array<{
      code: string;
      percentage: number;
      isRedeemed: boolean;
      redeemedAt?: Date;
    }>;
  }> {
    // En una implementación real, esto haría consultas complejas a la BD
    return {
      totalSpins: 0,
      uniqueUsers: 0,
      conversionRate: 0,
      averageSpinsPerUser: 0,
      sectionDistribution: {
        [WheelSection.DISCOUNT_5]: 0,
        [WheelSection.DISCOUNT_10]: 0,
        [WheelSection.DISCOUNT_15]: 0,
        [WheelSection.DISCOUNT_20]: 0,
        [WheelSection.DISCOUNT_25]: 0,
        [WheelSection.DISCOUNT_30]: 0,
        [WheelSection.DISCOUNT_50]: 0,
        [WheelSection.TRY_AGAIN]: 0
      },
      hourlyDistribution: [],
      topDiscounts: []
    };
  }

  /**
   * Resetea límites de giro para testing/admin
   */
  async resetSpinLimits(
    sessionId: string,
    userId?: string | undefined,
    adminKey?: string | undefined
  ): Promise<{ success: boolean; message: string }> {
    // Validar clave de administrador
    if (adminKey !== process.env.ADMIN_RESET_KEY) {
      return {
        success: false,
        message: 'No autorizado para resetear límites'
      };
    }

    // En una implementación real, esto resetearía los contadores en BD
    logger.info('Límites de giro reseteados', {
      sessionId,
      userId,
      resetBy: 'admin'
    });

    return {
      success: true,
      message: 'Límites de giro reseteados exitosamente'
    };
  }
}