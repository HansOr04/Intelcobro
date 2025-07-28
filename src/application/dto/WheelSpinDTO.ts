// src/application/dto/WheelSpinDTO.ts

import { WheelSection } from '../../domain/enums/WheelSection';

/**
 * DTO para solicitud de giro de rueda
 */
export interface WheelSpinRequestDTO {
  sessionId: string;
  userId?: string | undefined; // Hacer explícito que puede ser undefined
  userIp?: string | undefined; // Hacer explícito que puede ser undefined
  userAgent?: string | undefined; // Hacer explícito que puede ser undefined
  metadata?: Record<string, any> | undefined; // Hacer explícito que puede ser undefined
}

/**
 * DTO para respuesta de giro de rueda
 */
export interface WheelSpinResponseDTO {
  id: string;
  sessionId: string;
  section: WheelSection;
  discountPercentage: number;
  spinAngle: number;
  spinDuration: number;
  timestamp: string;
  isWinning: boolean;
  resultMessage: string;
  discountCode?: string | undefined; // Hacer explícito que puede ser undefined
  expiresAt?: string | undefined; // Hacer explícito que puede ser undefined
  nextSpinAllowedAt?: string | undefined; // Hacer explícito que puede ser undefined
}

/**
 * DTO para configuración de la rueda
 */
export interface WheelConfigResponseDTO {
  isEnabled: boolean;
  sections: WheelSectionConfigDTO[];
  spinCooldownMs: number;
  maxSpinsPerSession: number;
  maxSpinsPerDay: number;
  minDiscountPercentage: number;
  maxDiscountPercentage: number;
}

/**
 * DTO para configuración de sección de rueda
 */
export interface WheelSectionConfigDTO {
  section: WheelSection;
  label: string;
  discountPercentage: number;
  probability: number;
  color: string;
  textColor: string;
}

/**
 * DTO para estadísticas de la rueda
 */
export interface WheelStatsDTO {
  totalSpins: number;
  totalWins: number;
  winRate: number;
  spinsBySection: Record<WheelSection, number>;
  averageDiscountAwarded: number;
  totalDiscountValue: number;
  uniqueUsers: number;
  spinsToday: number;
  spinsThisWeek: number;
  spinsThisMonth: number;
  topPrizes: Array<{
    section: WheelSection;
    discountPercentage: number;
    count: number;
  }>;
  spinTrends: Array<{
    date: string;
    spins: number;
    wins: number;
    discountAwarded: number;
  }>;
}

/**
 * DTO para historial de giros de usuario
 */
export interface UserSpinHistoryDTO {
  sessionId?: string;
  userId?: string;
  spins: WheelSpinSummaryDTO[];
  totalSpins: number;
  totalWins: number;
  totalDiscountEarned: number;
  lastSpinAt?: string;
  nextSpinAllowedAt?: string;
  canSpin: boolean;
}

/**
 * DTO para resumen de giro
 */
export interface WheelSpinSummaryDTO {
  id: string;
  section: WheelSection;
  discountPercentage: number;
  timestamp: string;
  isWinning: boolean;
  isRedeemed: boolean;
  expiresAt?: string;
  discountCode?: string;
}

/**
 * DTO para validación de giro
 */
export interface WheelSpinValidationDTO {
  canSpin: boolean;
  errors: string[];
  warnings: string[];
  cooldownRemaining?: number;
  spinsRemaining?: number;
  nextAllowedSpin?: string;
}

/**
 * DTO para límites de giro
 */
export interface SpinLimitsDTO {
  maxSpinsPerSession: number;
  maxSpinsPerDay: number;
  maxSpinsPerUser: number;
  cooldownBetweenSpins: number;
  currentSpinsToday: number;
  currentSpinsInSession: number;
  lastSpinAt?: string;
}

/**
 * DTO para resultado detallado del giro
 */
export interface DetailedWheelResultDTO extends WheelSpinResponseDTO {
  statistics: {
    fullRotations: number;
    finalAngle: number;
    spinDurationSeconds: number;
    avgSpinSpeed: number;
    isHighValuePrize: boolean;
  };
  userInfo: {
    userAgent?: string;
    userIp?: string;
    isFirstSpin: boolean;
    totalSpinsToday: number;
  };
  redemptionInfo?: {
    isRedeemable: boolean;
    validUntil?: string;
    discountCode?: string;
    termsAndConditions: string[];
  };
}

/**
 * Validador para WheelSpinDTO
 */
export class WheelSpinDTOValidator {
  /**
   * Valida una solicitud de giro de rueda
   */
  static validateWheelSpinRequest(dto: any): WheelSpinValidationDTO {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validar sessionId requerido
    if (!dto.sessionId || typeof dto.sessionId !== 'string') {
      errors.push('sessionId es requerido y debe ser string');
    }

    if (dto.sessionId && dto.sessionId.trim().length === 0) {
      errors.push('sessionId no puede estar vacío');
    }

    // Validar campos opcionales
    if (dto.userId !== undefined && typeof dto.userId !== 'string') {
      warnings.push('userId debe ser string');
    }

    if (dto.userIp !== undefined && typeof dto.userIp !== 'string') {
      warnings.push('userIp debe ser string');
    }

    if (dto.userAgent !== undefined && typeof dto.userAgent !== 'string') {
      warnings.push('userAgent debe ser string');
    }

    if (dto.metadata !== undefined && typeof dto.metadata !== 'object') {
      warnings.push('metadata debe ser objeto');
    }

    // Validar formato de IP si está presente
    if (dto.userIp && typeof dto.userIp === 'string') {
      const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
      if (!ipRegex.test(dto.userIp)) {
        warnings.push('Formato de IP puede no ser válido');
      }
    }

    return {
      canSpin: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Valida límites de giro para un usuario/sesión
   */
  static validateSpinLimits(
    sessionId: string,
    userSpinHistory: WheelSpinSummaryDTO[],
    limits: SpinLimitsDTO
  ): WheelSpinValidationDTO {
    const errors: string[] = [];
    const warnings: string[] = [];
    const now = new Date();

    // Verificar cooldown entre giros
    if (userSpinHistory.length > 0) {
      const lastSpin = new Date(userSpinHistory[0]?.timestamp || '');
      const timeSinceLastSpin = now.getTime() - lastSpin.getTime();
      
      if (timeSinceLastSpin < limits.cooldownBetweenSpins) {
        const remainingCooldown = limits.cooldownBetweenSpins - timeSinceLastSpin;
        errors.push('Debe esperar antes de girar nuevamente');
        
        return {
          canSpin: false,
          errors,
          warnings,
          cooldownRemaining: remainingCooldown,
          nextAllowedSpin: new Date(now.getTime() + remainingCooldown).toISOString()
        };
      }
    }

    // Verificar límite diario
    const today = new Date().toISOString().split('T')[0];
    const spinsToday = userSpinHistory.filter(spin => {
      const spinDate = spin.timestamp.split('T')[0];
      return spinDate === today;
    }).length;

    if (spinsToday >= limits.maxSpinsPerDay) {
      errors.push('Ha alcanzado el límite diario de giros');
      
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      
      return {
        canSpin: false,
        errors,
        warnings,
        spinsRemaining: 0,
        nextAllowedSpin: tomorrow.toISOString()
      };
    }

    // Verificar límite por sesión
    const spinsInSession = userSpinHistory.length;
    if (spinsInSession >= limits.maxSpinsPerSession) {
      errors.push('Ha alcanzado el límite de giros por sesión');
      
      return {
        canSpin: false,
        errors,
        warnings,
        spinsRemaining: 0
      };
    }

    // Todo está bien, puede girar
    return {
      canSpin: true,
      errors,
      warnings,
      spinsRemaining: Math.min(
        limits.maxSpinsPerDay - spinsToday,
        limits.maxSpinsPerSession - spinsInSession
      )
    };
  }

  /**
   * Sanitiza una solicitud de giro
   */
  static sanitizeWheelSpinRequest(dto: WheelSpinRequestDTO): WheelSpinRequestDTO {
    const sanitized: WheelSpinRequestDTO = {
      sessionId: dto.sessionId.trim(),
      metadata: dto.metadata || {}
    };

    if (dto.userId?.trim()) sanitized.userId = dto.userId.trim();
    if (dto.userIp?.trim()) sanitized.userIp = dto.userIp.trim();
    if (dto.userAgent?.trim()) sanitized.userAgent = dto.userAgent.trim();

    return sanitized;
  }
}

/**
 * Helper para trabajar con WheelSpinDTOs
 */
export class WheelSpinDTOHelper {
  /**
   * Convierte datos de entidad a WheelSpinResponseDTO
   */
  static toResponseDTO(spinData: {
    id: string;
    sessionId: string;
    section: WheelSection;
    discountPercentage: number;
    spinAngle: number;
    spinDuration: number;
    timestamp: Date;
    isWinning: boolean;
    resultMessage: string;
    discountCode?: string;
    expiresAt?: Date;
  }, nextSpinAllowedAt?: Date): WheelSpinResponseDTO {
    const response: WheelSpinResponseDTO = {
      id: spinData.id,
      sessionId: spinData.sessionId,
      section: spinData.section,
      discountPercentage: spinData.discountPercentage,
      spinAngle: spinData.spinAngle,
      spinDuration: spinData.spinDuration,
      timestamp: spinData.timestamp.toISOString(),
      isWinning: spinData.isWinning,
      resultMessage: spinData.resultMessage
    };

    if (spinData.discountCode) response.discountCode = spinData.discountCode;
    if (spinData.expiresAt) response.expiresAt = spinData.expiresAt.toISOString();
    if (nextSpinAllowedAt) response.nextSpinAllowedAt = nextSpinAllowedAt.toISOString();

    return response;
  }

  /**
   * Convierte a resultado detallado
   */
  static toDetailedResultDTO(
    spinData: WheelSpinResponseDTO,
    statistics: any,
    userInfo: any,
    redemptionInfo?: any
  ): DetailedWheelResultDTO {
    return {
      ...spinData,
      statistics,
      userInfo,
      redemptionInfo
    };
  }

  /**
   * Convierte a resumen de giro
   */
  static toSummaryDTO(spinData: {
    id: string;
    section: WheelSection;
    discountPercentage: number;
    timestamp: Date;
    isWinning: boolean;
    isRedeemed: boolean;
    expiresAt?: Date;
    discountCode?: string;
  }): WheelSpinSummaryDTO {
    const summary: WheelSpinSummaryDTO = {
      id: spinData.id,
      section: spinData.section,
      discountPercentage: spinData.discountPercentage,
      timestamp: spinData.timestamp.toISOString(),
      isWinning: spinData.isWinning,
      isRedeemed: spinData.isRedeemed
    };

    if (spinData.expiresAt) summary.expiresAt = spinData.expiresAt.toISOString();
    if (spinData.discountCode) summary.discountCode = spinData.discountCode;

    return summary;
  }

  /**
   * Obtiene configuración por defecto de la rueda
   */
  static getDefaultWheelConfig(): WheelConfigResponseDTO {
    return {
      isEnabled: true,
      sections: [
        {
          section: WheelSection.DISCOUNT_5,
          label: '5% OFF',
          discountPercentage: 5,
          probability: 25,
          color: '#FF6B6B',
          textColor: '#FFFFFF'
        },
        {
          section: WheelSection.DISCOUNT_10,
          label: '10% OFF',
          discountPercentage: 10,
          probability: 20,
          color: '#4ECDC4',
          textColor: '#FFFFFF'
        },
        {
          section: WheelSection.DISCOUNT_15,
          label: '15% OFF',
          discountPercentage: 15,
          probability: 15,
          color: '#45B7D1',
          textColor: '#FFFFFF'
        },
        {
          section: WheelSection.DISCOUNT_20,
          label: '20% OFF',
          discountPercentage: 20,
          probability: 15,
          color: '#96CEB4',
          textColor: '#FFFFFF'
        },
        {
          section: WheelSection.DISCOUNT_25,
          label: '25% OFF',
          discountPercentage: 25,
          probability: 10,
          color: '#FFEAA7',
          textColor: '#2D3436'
        },
        {
          section: WheelSection.DISCOUNT_30,
          label: '30% OFF',
          discountPercentage: 30,
          probability: 8,
          color: '#DDA0DD',
          textColor: '#FFFFFF'
        },
        {
          section: WheelSection.DISCOUNT_50,
          label: '50% OFF',
          discountPercentage: 50,
          probability: 2,
          color: '#FFD700',
          textColor: '#2D3436'
        },
        {
          section: WheelSection.TRY_AGAIN,
          label: 'Try Again',
          discountPercentage: 0,
          probability: 5,
          color: '#74B9FF',
          textColor: '#FFFFFF'
        }
      ],
      spinCooldownMs: 5 * 60 * 1000, // 5 minutos
      maxSpinsPerSession: 3,
      maxSpinsPerDay: 10,
      minDiscountPercentage: 5,
      maxDiscountPercentage: 50
    };
  }

  /**
   * Obtiene límites por defecto
   */
  static getDefaultSpinLimits(): SpinLimitsDTO {
    return {
      maxSpinsPerSession: 3,
      maxSpinsPerDay: 10,
      maxSpinsPerUser: 1, // Por email único
      cooldownBetweenSpins: 5 * 60 * 1000, // 5 minutos
      currentSpinsToday: 0,
      currentSpinsInSession: 0
    };
  }

  /**
   * Calcula el siguiente momento permitido para girar
   */
  static calculateNextAllowedSpin(lastSpinAt: Date, cooldownMs: number): Date {
    return new Date(lastSpinAt.getTime() + cooldownMs);
  }

  /**
   * Verifica si un usuario puede girar ahora
   */
  static canUserSpinNow(
    lastSpinAt?: Date,
    cooldownMs: number = 5 * 60 * 1000
  ): { canSpin: boolean; nextAllowedAt?: Date | undefined } {
    if (!lastSpinAt) {
      return { canSpin: true };
    }

    const nextAllowedAt = WheelSpinDTOHelper.calculateNextAllowedSpin(lastSpinAt, cooldownMs);
    const canSpin = new Date() >= nextAllowedAt;

    const result: { canSpin: boolean; nextAllowedAt?: Date | undefined } = { canSpin };
    
    if (!canSpin) {
      result.nextAllowedAt = nextAllowedAt;
    }

    return result;
  }
}