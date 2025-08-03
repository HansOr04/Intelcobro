// src/infrastructure/web/controllers/WheelController.ts

import { Request, Response, NextFunction } from 'express';
import { SpinWheelUseCase } from '../../../application/use-cases/wheel/SpinWheelUseCase';
import { WheelSpinRequestDTO, WheelSpinResponseDTO } from '../../../application/dto/WheelSpinDTO';
import { ValidationException } from '../../../application/exceptions/ValidationException';
import { logger } from '../../../shared/utils/Logger';
import { WHEEL_CONFIG, WHEEL_RESULT_MESSAGES } from '../../../shared/constants/WheelConfig';
// Import necesario para ValidationErrorType
import { ValidationErrorType } from '../../../application/exceptions/ValidationException';
/**
 * Controlador para endpoints de la ruleta de descuentos
 */
export class WheelController {
  constructor(
    private readonly spinWheelUseCase: SpinWheelUseCase
  ) {}

  /**
   * Gira la ruleta de descuentos
   * POST /api/wheel/spin
   */
  async spin(req: Request, res: Response, next: NextFunction): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Extraer datos del request
      const spinRequest: WheelSpinRequestDTO = {
        sessionId: req.body.sessionId || this.generateSessionId(req),
        userId: req.body.userId,
        metadata: {
          ip: req.ip || 'unknown',
          userAgent: req.get('User-Agent'),
          referer: req.get('Referer'),
          timestamp: new Date().toISOString()
        }
      };

      logger.info('Processing wheel spin', {
        sessionId: spinRequest.sessionId,
        userId: spinRequest.userId,
        ip: req.ip || 'unknown'
      });

      // Validaciones adicionales
      await this.validateSpinRequest(spinRequest, req);

      // Ejecutar caso de uso
      const result = await this.spinWheelUseCase.execute(spinRequest);

      // Preparar respuesta usando el resultado del DTO
      const spinResponse: WheelSpinResponseDTO = {
        id: result.result.id,
        sessionId: result.result.sessionId,
        section: result.result.section,
        discountPercentage: result.result.discountPercentage,
        isWinning: result.result.isWinning,
        resultMessage: result.result.resultMessage,
        timestamp: result.result.timestamp,
        spinAngle: result.result.spinAngle,
        spinDuration: result.result.spinDuration,
        discountCode: result.result.discountCode,
        expiresAt: result.result.expiresAt,
        nextSpinAllowedAt: result.result.nextSpinAllowedAt,
        animation: {
          duration: this.calculateAnimationDuration(),
          rotations: this.calculateRotations(),
          finalAngle: this.calculateFinalAngle(result.result.section)
        },
        metadata: {
          ...result.metadata,
          processingTime: Date.now() - startTime,
          spinsRemaining: result.spinsRemainingToday
        }
      };

      logger.info('Wheel spin processed successfully', {
        resultId: result.result.id,
        sessionId: result.result.sessionId,
        section: result.result.section,
        discountPercentage: result.result.discountPercentage,
        isWinning: result.result.isWinning,
        processingTime: Date.now() - startTime
      });

      res.status(200).json({
        success: true,
        message: result.result.isWinning ? '¡Felicidades! Has ganado un descuento' : 'Intenta nuevamente',
        data: spinResponse,
        metadata: {
          processingTime: Date.now() - startTime,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      logger.error('Error processing wheel spin', error as Error, {
        sessionId: req.body.sessionId,
        processingTime: Date.now() - startTime,
        ip: req.ip || 'unknown'
      });

      next(error);
    }
  }

  /**
   * Obtiene el estado actual de la ruleta para una sesión
   * GET /api/wheel/status/:sessionId
   */
  async getStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { sessionId } = req.params;

      logger.debug('Fetching wheel status', {
        sessionId,
        ip: req.ip || 'unknown'
      });

      // En una implementación real, consultarías la base de datos
      const wheelStatus = {
        sessionId,
        canSpin: true,
        spinsUsed: 0,
        spinsRemaining: WHEEL_CONFIG.MAX_SPINS_PER_SESSION,
        lastSpinAt: null,
        nextSpinAvailableAt: null,
        cooldownRemaining: 0,
        totalDiscountsWon: 0,
        bestDiscount: 0,
        wheelConfig: {
          maxSpinsPerSession: WHEEL_CONFIG.MAX_SPINS_PER_SESSION,
          cooldownMinutes: Math.floor(WHEEL_CONFIG.SPIN_COOLDOWN_MS / 60000),
          sessionExpiryHours: Math.floor(WHEEL_CONFIG.SESSION_EXPIRY_MS / 3600000)
        }
      };

      res.status(200).json({
        success: true,
        message: 'Estado de ruleta obtenido exitosamente',
        data: wheelStatus
      });

    } catch (error) {
      logger.error('Error fetching wheel status', error as Error, {
        sessionId: req.params.sessionId,
        ip: req.ip || 'unknown'
      });

      next(error);
    }
  }

  /**
   * Obtiene el historial de giros de una sesión
   * GET /api/wheel/history/:sessionId
   */
  async getHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { sessionId } = req.params;
      const limit = parseInt(req.query.limit as string) || 10;
      const offset = parseInt(req.query.offset as string) || 0;

      logger.debug('Fetching wheel history', {
        sessionId,
        limit,
        offset,
        ip: req.ip || 'unknown'
      });

      // En una implementación real, consultarías la base de datos
      const history = {
        sessionId,
        spins: [] as WheelSpinResponseDTO[],
        totalSpins: 0,
        totalDiscountsWon: 0,
        bestDiscount: 0,
        pagination: {
          limit,
          offset,
          hasMore: false,
          totalPages: 0
        },
        statistics: {
          winRate: 0.0,
          averageDiscount: 0.0,
          favoriteSection: null,
          totalValueWon: 0
        }
      };

      res.status(200).json({
        success: true,
        message: 'Historial obtenido exitosamente',
        data: history
      });

    } catch (error) {
      logger.error('Error fetching wheel history', error as Error, {
        sessionId: req.params.sessionId,
        ip: req.ip || 'unknown'
      });

      next(error);
    }
  }

  /**
   * Obtiene la configuración de la ruleta
   * GET /api/wheel/config
   */
  async getConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      logger.debug('Fetching wheel configuration', { ip: req.ip || 'unknown' });

      const config = {
        sections: Object.entries(WHEEL_CONFIG.SECTIONS).map(([section, config]) => ({
          id: section,
          label: config.label || `${config.discountPercentage}% OFF`,
          color: config.color,
          discountPercentage: config.discountPercentage,
          probability: config.probability,
          isWinning: config.discountPercentage > 0
        })),
        rules: {
          maxSpinsPerSession: WHEEL_CONFIG.MAX_SPINS_PER_SESSION,
          cooldownMinutes: Math.floor(WHEEL_CONFIG.SPIN_COOLDOWN_MS / 60000),
          sessionExpiryHours: Math.floor(WHEEL_CONFIG.SESSION_EXPIRY_MS / 3600000),
          minAnimationDuration: WHEEL_CONFIG.MIN_SPIN_DURATION_MS,
          maxAnimationDuration: WHEEL_CONFIG.MAX_SPIN_DURATION_MS
        },
        messages: WHEEL_RESULT_MESSAGES,
        totalSections: Object.keys(WHEEL_CONFIG.SECTIONS).length,
        winningProbability: Object.values(WHEEL_CONFIG.SECTIONS)
          .filter(s => s.discountPercentage > 0)
          .reduce((sum, s) => sum + s.probability, 0)
      };

      res.status(200).json({
        success: true,
        message: 'Configuración obtenida exitosamente',
        data: config
      });

    } catch (error) {
      logger.error('Error fetching wheel config', error as Error, {
        ip: req.ip || 'unknown'
      });

      next(error);
    }
  }

  /**
   * Valida un resultado de ruleta
   * POST /api/wheel/validate
   */
  async validateResult(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { resultId, discountCode } = req.body;

      logger.debug('Validating wheel result', {
        resultId,
        discountCode,
        ip: req.ip || 'unknown'
      });

      if (!resultId && !discountCode) {
        throw new ValidationException('Se requiere resultId o discountCode');
      }

      // En una implementación real, verificarías en la base de datos
      const validation = {
        isValid: true,
        resultId: resultId || `wheel_result_${Date.now()}`,
        discountCode: discountCode || 'WHEEL2024',
        discountPercentage: 20,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 días
        isUsed: false,
        usageLimit: 1,
        applicableServices: ['web-development', 'mobile-development', 'ecommerce'],
        minimumPurchase: 5000,
        maxDiscountAmount: 10000,
        terms: [
          'Válido por 7 días desde la fecha de generación',
          'Aplicable solo a servicios seleccionados',
          'No acumulable con otras ofertas',
          'Sujeto a términos y condiciones'
        ]
      };

      res.status(200).json({
        success: true,
        message: validation.isValid ? 'Resultado válido' : 'Resultado inválido',
        data: validation
      });

    } catch (error) {
      logger.error('Error validating wheel result', error as Error, {
        resultId: req.body.resultId,
        discountCode: req.body.discountCode,
        ip: req.ip || 'unknown'
      });

      next(error);
    }
  }

  /**
   * Obtiene estadísticas de la ruleta
   * GET /api/wheel/stats
   */
  async getStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const timeRange = req.query.timeRange as string || '24h';
      const detailed = req.query.detailed === 'true';

      logger.debug('Fetching wheel statistics', {
        timeRange,
        detailed,
        ip: req.ip || 'unknown'
      });

      const stats = {
        timeRange,
        generatedAt: new Date().toISOString(),
        overview: {
          totalSpins: 0,
          totalWins: 0,
          winRate: 0.0,
          uniqueSessions: 0,
          totalDiscountValue: 0
        },
        sections: Object.entries(WHEEL_CONFIG.SECTIONS).map(([section, config]) => ({
          section,
          label: config.label || `${config.discountPercentage}% OFF`,
          spins: 0,
          wins: config.discountPercentage > 0 ? 0 : undefined,
          probability: config.probability,
          actualRate: 0.0
        })),
        performance: {
          averageSpinTime: 0,
          peakHour: '00:00',
          conversionRate: 0.0, // De spin a formulario
          redemptionRate: 0.0  // De código a compra
        }
      };

      if (detailed) {
        stats.performance = {
          ...stats.performance,
          // Métricas adicionales para modo detallado
        };
      }

      res.status(200).json({
        success: true,
        message: 'Estadísticas obtenidas exitosamente',
        data: stats
      });

    } catch (error) {
      logger.error('Error fetching wheel stats', error as Error, {
        ip: req.ip || 'unknown'
      });

      next(error);
    }
  }

  /**
   * Reinicia una sesión de ruleta (admin)
   * POST /api/wheel/reset/:sessionId
   */
  async resetSession(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { sessionId } = req.params;
      const { reason } = req.body;

      logger.info('Resetting wheel session', {
        sessionId,
        reason,
        ip: req.ip || 'unknown'
      });

      // En una implementación real, verificarías permisos de admin
      // y resetearías la sesión en la base de datos

      const resetResult = {
        sessionId,
        resetAt: new Date().toISOString(),
        reason: reason || 'Manual reset',
        previousState: {
          spinsUsed: 0,
          discountsWon: 0
        },
        newState: {
          spinsUsed: 0,
          spinsRemaining: WHEEL_CONFIG.MAX_SPINS_PER_SESSION,
          canSpin: true,
          cooldownRemaining: 0
        }
      };

      res.status(200).json({
        success: true,
        message: 'Sesión reiniciada exitosamente',
        data: resetResult
      });

    } catch (error) {
      logger.error('Error resetting wheel session', error as Error, {
        sessionId: req.params.sessionId,
        ip: req.ip || 'unknown'
      });

      next(error);
    }
  }

  /**
   * Health check específico de la ruleta
   * GET /api/wheel/health
   */
  async getHealth(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const detailed = req.query.detailed === 'true';

      const healthStatus = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        components: {
          wheelLogic: 'operational',
          randomGenerator: 'operational',
          sessionManagement: 'operational',
          discountValidation: 'operational'
        },
        configuration: {
          sectionsLoaded: Object.keys(WHEEL_CONFIG.SECTIONS).length,
          totalProbability: Object.values(WHEEL_CONFIG.SECTIONS).reduce((sum, s) => sum + s.probability, 0),
          maxSpinsPerSession: WHEEL_CONFIG.MAX_SPINS_PER_SESSION,
          cooldownMs: WHEEL_CONFIG.SPIN_COOLDOWN_MS
        }
      };

      if (detailed) {
        healthStatus.configuration = {
          ...healthStatus.configuration,
          // Información adicional en modo detallado
        };
      }

      // Verificar que la configuración es válida
      const totalProbability = Object.values(WHEEL_CONFIG.SECTIONS).reduce((sum, s) => sum + s.probability, 0);
      const isConfigValid = Math.abs(totalProbability - 100) < 0.01; // Permitir pequeña diferencia por decimales

      if (!isConfigValid) {
        healthStatus.status = 'unhealthy';
        healthStatus.components.wheelLogic = 'error: probabilidades no suman 100%';
      }

      const statusCode = healthStatus.status === 'healthy' ? 200 : 503;

      res.status(statusCode).json({
        success: statusCode === 200,
        message: `Wheel service is ${healthStatus.status}`,
        data: healthStatus
      });

    } catch (error) {
      logger.error('Error in wheel health check', error as Error);

      res.status(503).json({
        success: false,
        message: 'Wheel service is unhealthy',
        data: {
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      });
    }
  }

  /**
   * Obtiene leaderboard de descuentos ganados
   * GET /api/wheel/leaderboard
   */
  async getLeaderboard(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const timeRange = req.query.timeRange as string || '7d';
      const limit = parseInt(req.query.limit as string) || 10;

      logger.debug('Fetching wheel leaderboard', {
        timeRange,
        limit,
        ip: req.ip || 'unknown'
      });

      // En una implementación real, consultarías la base de datos
      const leaderboard = {
        timeRange,
        generatedAt: new Date().toISOString(),
        entries: [] as Array<{
          rank: number;
          sessionId: string;
          totalSpins: number;
          totalWins: number;
          bestDiscount: number;
          totalDiscountValue: number;
          winRate: number;
        }>,
        summary: {
          totalParticipants: 0,
          averageWinRate: 0.0,
          mostPopularDiscount: 0,
          biggestWinner: null
        }
      };

      res.status(200).json({
        success: true,
        message: 'Leaderboard obtenido exitosamente',
        data: leaderboard
      });

    } catch (error) {
      logger.error('Error fetching leaderboard', error as Error, {
        ip: req.ip || 'unknown'
      });

      next(error);
    }
  }

  /**
   * Validaciones adicionales para el spin
   */
  private async validateSpinRequest(request: WheelSpinRequestDTO, req: Request): Promise<void> {
    const errors: string[] = [];

    // Validar sessionId
    if (!request.sessionId || !/^[a-zA-Z0-9_-]+$/.test(request.sessionId)) {
      errors.push('SessionId inválido');
    }

    // Verificar rate limiting por IP
    const ip = req.ip || 'unknown';
    await this.checkRateLimit(ip);

    // Verificar cooldown de sesión
    await this.checkSessionCooldown(request.sessionId);

    // Verificar límite de spins por sesión
    await this.checkSpinLimit(request.sessionId);

    if (errors.length > 0) {
      throw new ValidationException(errors.map(error => ({
        type: ValidationErrorType.BUSINESS_RULE_VIOLATION,
        field: 'general',
        message: error
      })), {
        entity: 'WheelSpin',
        operation: 'validate',
        timestamp: new Date()
      });
    }
  }

  /**
   * Verifica rate limiting por IP
   */
  private async checkRateLimit(ip: string): Promise<void> {
    // En una implementación real, usarías Redis o similar
    // Por ahora, simulamos la verificación
    logger.debug('Checking rate limit', { ip });
    // Si excede: throw new ValidationException('Demasiados intentos desde esta IP');
  }

  /**
   * Verifica cooldown de sesión
   */
  private async checkSessionCooldown(sessionId: string): Promise<void> {
    // En una implementación real, verificarías en la base de datos
    logger.debug('Checking session cooldown', { sessionId });
    // Si está en cooldown: throw new ValidationException('Debes esperar antes de girar nuevamente');
  }

  /**
   * Verifica límite de spins por sesión
   */
  private async checkSpinLimit(sessionId: string): Promise<void> {
    // En una implementación real, verificarías en la base de datos
    logger.debug('Checking spin limit', { sessionId });
    // Si excede: throw new ValidationException('Has alcanzado el límite de giros para esta sesión');
  }

  /**
   * Genera sessionId único basado en request
   */
  private generateSessionId(req: Request): string {
    const timestamp = Date.now();
    const ip = (req.ip || 'unknown').replace(/[:.]/g, '');
    const random = Math.random().toString(36).substring(2, 8);
    return `session_${timestamp}_${ip}_${random}`;
  }

  /**
   * Calcula duración de animación
   */
  private calculateAnimationDuration(): number {
    const min = WHEEL_CONFIG.MIN_SPIN_DURATION_MS;
    const max = WHEEL_CONFIG.MAX_SPIN_DURATION_MS;
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Calcula número de rotaciones
   */
  private calculateRotations(): number {
    const min = WHEEL_CONFIG.MIN_FULL_ROTATIONS;
    const max = WHEEL_CONFIG.MAX_FULL_ROTATIONS;
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Calcula ángulo final basado en la sección
   */
  private calculateFinalAngle(section: string): number {
    const sections = Object.keys(WHEEL_CONFIG.SECTIONS);
    const sectionIndex = sections.indexOf(section);
    
    if (sectionIndex === -1) {
      return 0;
    }

    const sectionsCount = sections.length;
    const anglePerSection = 360 / sectionsCount;
    const baseAngle = sectionIndex * anglePerSection;
    
    // Añadir variación aleatoria dentro de la sección
    const variation = (Math.random() - 0.5) * anglePerSection * 0.8;
    
    return Math.round(baseAngle + variation);
  }

  /**
   * Obtiene premio especial del día
   * GET /api/wheel/daily-special
   */
  async getDailySpecial(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      logger.debug('Fetching daily special', { ip: req.ip || 'unknown' });

      // Generar premio especial basado en la fecha
      const today = new Date();
      const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000);
      
      // Usar el día para determinar el premio especial
      const specialDiscounts = [25, 30, 35, 40, 50];
      const specialDiscount = specialDiscounts[dayOfYear % specialDiscounts.length];

      const dailySpecial = {
        date: today.toISOString().split('T')[0],
        isActive: true,
        specialDiscount,
        description: `¡Premio especial del día: ${specialDiscount}% de descuento!`,
        probability: 5, // 5% de probabilidad
        requirements: [
          'Solo disponible hoy',
          'Máximo 1 por sesión',
          'Válido por 24 horas'
        ],
        expiresAt: new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString(),
        claimed: 0,
        maxClaims: 100
      };

      res.status(200).json({
        success: true,
        message: 'Premio especial obtenido exitosamente',
        data: dailySpecial
      });

    } catch (error) {
      logger.error('Error fetching daily special', error as Error, {
        ip: req.ip || 'unknown'
      });

      next(error);
    }
  }

  /**
   * Exporta datos de la ruleta
   * GET /api/wheel/export
   */
  async exportData(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const format = req.query.format as string || 'json';
      const dateFrom = req.query.dateFrom as string;
      const dateTo = req.query.dateTo as string;

      logger.info('Exporting wheel data', {
        format,
        dateFrom,
        dateTo,
        ip: req.ip || 'unknown'
      });

      // En una implementación real, consultarías y exportarías datos reales
      const exportData = {
        exportedAt: new Date().toISOString(),
        format,
        dateRange: {
          from: dateFrom || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          to: dateTo || new Date().toISOString()
        },
        summary: {
          totalSpins: 0,
          totalWins: 0,
          totalSessions: 0,
          popularSections: []
        },
        data: [] // Array de spins exportados
      };

      if (format === 'json') {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename="wheel-data.json"');
        res.status(200).json(exportData);
      } else if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="wheel-data.csv"');
        res.status(200).send('timestamp,sessionId,section,discountPercentage,isWinning\n');
      } else {
        throw new ValidationException('Formato de exportación no soportado');
      }

    } catch (error) {
      logger.error('Error exporting wheel data', error as Error, {
        format: req.query.format,
        ip: req.ip || 'unknown'
      });

      next(error);
    }
  }

  /**
   * Configura A/B testing para la ruleta
   * POST /api/wheel/ab-test
   */
  async configureABTest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const {
        testName,
        variants,
        trafficSplit,
        startDate,
        endDate
      } = req.body;

      logger.info('Configuring wheel A/B test', {
        testName,
        variants: variants?.length,
        trafficSplit,
        ip: req.ip || 'unknown'
      });

      // Validar configuración de A/B test
      if (!testName || !variants || !Array.isArray(variants)) {
        throw new ValidationException('Configuración de A/B test inválida');
      }

      // En una implementación real, guardarías la configuración
      const abTest = {
        id: `ab_test_${Date.now()}`,
        name: testName,
        status: 'draft',
        variants,
        trafficSplit: trafficSplit || { A: 50, B: 50 },
        startDate: startDate || new Date().toISOString(),
        endDate: endDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: new Date().toISOString(),
        metrics: {
          participants: 0,
          conversions: 0,
          conversionRate: 0.0
        }
      };

      res.status(201).json({
        success: true,
        message: 'A/B test configurado exitosamente',
        data: abTest
      });

    } catch (error) {
      logger.error('Error configuring A/B test', error as Error, {
        testName: req.body.testName,
        ip: req.ip || 'unknown'
      });

      next(error);
    }
  }
}

