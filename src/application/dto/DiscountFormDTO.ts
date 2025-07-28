// src/application/dto/DiscountFormDTO.ts

/**
 * DTO para solicitud de descuento
 */
export interface DiscountFormRequestDTO {
  sessionId: string;
  email: string;
  fullName: string;
  phoneNumber?: string | undefined;
  serviceInterest: string;
  companyName?: string | undefined;
  companySize?: string | undefined;
  budget?: string | undefined;
  timeline?: string | undefined;
  projectDescription?: string | undefined;
  currentSolution?: string | undefined;
  painPoints?: string | undefined;
  goals?: string | undefined;
  decisionMakers?: string | undefined;
  additionalInfo?: string | undefined;
  wheelResultId?: string | undefined; // ID del resultado de la rueda si aplica
  discountCode?: string | undefined; // Código de descuento de la rueda
  referralSource?: string | undefined;
  agreeToMarketing?: boolean | undefined;
}

/**
 * DTO para respuesta de solicitud de descuento
 */
export interface DiscountFormResponseDTO {
  id: string;
  sessionId: string;
  email: string;
  fullName: string;
  phoneNumber?: string | undefined;
  serviceInterest: string;
  status: string;
  submittedAt: string;
  processedAt?: string | undefined;
  emailSent: boolean;
  followUpScheduled: boolean;
  discountApplied?: string | undefined;
  quotationNumber?: string | undefined;
  estimatedValue?: number | undefined;
  validUntil?: string | undefined;
}

// Rest of the file remains the same...
// (I'll include the rest of the content for completeness)

/**
 * DTO para listado de solicitudes de descuento
 */
export interface DiscountFormListDTO {
  requests: DiscountFormSummaryDTO[];
  totalRequests: number;
  pendingRequests: number;
  processedRequests: number;
  totalEstimatedValue: number;
  averageDiscountApplied: number;
  lastUpdate: string;
}

/**
 * DTO para resumen de solicitud de descuento
 */
export interface DiscountFormSummaryDTO {
  id: string;
  quotationNumber?: string | undefined;
  fullName: string;
  email: string;
  serviceInterest: string;
  status: string;
  submittedAt: string;
  estimatedValue?: number | undefined;
  discountApplied?: string | undefined;
  urgentFollowUp: boolean;
  hasWheelDiscount: boolean;
}

/**
 * DTO para filtros de búsqueda de solicitudes
 */
export interface DiscountFormSearchDTO {
  serviceInterest?: string | undefined;
  status?: string | undefined;
  companySize?: string | undefined;
  budgetRange?: { min?: number | undefined; max?: number | undefined } | undefined;
  timeline?: string | undefined;
  startDate?: string | undefined;
  endDate?: string | undefined;
  hasDiscount?: boolean | undefined;
  urgentOnly?: boolean | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
  sortBy?: 'submittedAt' | 'fullName' | 'serviceInterest' | 'estimatedValue' | undefined;
  sortOrder?: 'asc' | 'desc' | undefined;
}

/**
 * DTO para estadísticas de solicitudes de descuento
 */
export interface DiscountFormStatsDTO {
  totalRequests: number;
  requestsByStatus: Record<string, number>;
  requestsByService: Record<string, number>;
  requestsByCompanySize: Record<string, number>;
  averageProcessingTime: number;
  totalEstimatedValue: number;
  averageDiscountPercentage: number;
  conversionRate: number;
  wheelDiscountUsage: number;
  topServices: Array<{ service: string; count: number; avgValue: number }>;
  requestTrends: Array<{ date: string; count: number; value: number }>;
  budgetDistribution: Record<string, number>;
}

/**
 * DTO para configuración de servicios disponibles
 */
export interface ServiceConfigDTO {
  id: string;
  name: string;
  category: string;
  description: string;
  basePrice: number;
  currency: string;
  isActive: boolean;
  features: string[];
  estimatedTimeline: string;
  requiredInfo: string[];
  optionalInfo: string[];
}

/**
 * DTO para validación de solicitud de descuento
 */
export interface DiscountFormValidationDTO {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  requiredFields: string[];
  optionalFields: string[];
  discountEligible: boolean;
  estimatedDiscount?: number | undefined;
}

/**
 * Validador para DiscountFormDTO
 */
export class DiscountFormDTOValidator {
  /**
   * Valida una solicitud de descuento
   */
  static validateDiscountFormRequest(dto: any): DiscountFormValidationDTO {
    const errors: string[] = [];
    const warnings: string[] = [];
    const requiredFields = ['sessionId', 'email', 'fullName', 'serviceInterest'];
    const optionalFields = ['phoneNumber', 'companyName', 'companySize', 'budget', 'timeline'];

    // Validar campos requeridos
    requiredFields.forEach(field => {
      if (!dto[field] || typeof dto[field] !== 'string' || dto[field].trim().length === 0) {
        errors.push(`${field} es requerido y no puede estar vacío`);
      }
    });

    // Validar email
    if (dto.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(dto.email)) {
        errors.push('Email debe tener un formato válido');
      }
    }

    // Validar nombre completo
    if (dto.fullName && dto.fullName.length < 2) {
      errors.push('Nombre completo debe tener al menos 2 caracteres');
    }

    // Validar servicio de interés
    const validServices = [
      'Desarrollo Web',
      'Desarrollo Mobile',
      'E-commerce',
      'Sistemas de Gestión',
      'Consultoría IT',
      'Marketing Digital',
      'Diseño UX/UI',
      'Mantenimiento',
      'Otro'
    ];

    if (dto.serviceInterest && !validServices.includes(dto.serviceInterest)) {
      warnings.push('Servicio seleccionado no está en la lista predefinida');
    }

    // Validar tamaño de empresa
    if (dto.companySize) {
      const validSizes = ['1-10', '11-50', '51-200', '201-500', '500+'];
      if (!validSizes.includes(dto.companySize)) {
        warnings.push('Tamaño de empresa debe ser uno de los valores predefinidos');
      }
    }

    // Validar presupuesto
    if (dto.budget) {
      const validBudgets = ['<$5k', '$5k-$10k', '$10k-$25k', '$25k-$50k', '$50k+'];
      if (!validBudgets.includes(dto.budget)) {
        warnings.push('Presupuesto debe ser uno de los rangos predefinidos');
      }
    }

    // Validar timeline
    if (dto.timeline) {
      const validTimelines = ['Inmediato', '1-3 meses', '3-6 meses', '6+ meses', 'Sin prisa'];
      if (!validTimelines.includes(dto.timeline)) {
        warnings.push('Timeline debe ser uno de los valores predefinidos');
      }
    }

    // Validar código de descuento si está presente
    if (dto.discountCode && typeof dto.discountCode === 'string') {
      const codeRegex = /^INTEL\d+[A-Z0-9]+$/;
      if (!codeRegex.test(dto.discountCode)) {
        warnings.push('Código de descuento no tiene el formato válido');
      }
    }

    // Validar teléfono si está presente
    if (dto.phoneNumber && typeof dto.phoneNumber === 'string') {
      const phoneRegex = /^\+?[\d\s\-\(\)]{8,15}$/;
      if (!phoneRegex.test(dto.phoneNumber)) {
        warnings.push('Formato de teléfono puede no ser válido');
      }
    }

    // Validar boolean fields
    if (dto.agreeToMarketing !== undefined && typeof dto.agreeToMarketing !== 'boolean') {
      warnings.push('agreeToMarketing debe ser true o false');
    }

    // Determinar elegibilidad para descuento
    let discountEligible = false;
    let estimatedDiscount: number | undefined = undefined;

    if (dto.discountCode) {
      discountEligible = true;
      // Extraer porcentaje del código si es posible
      const match = dto.discountCode.match(/INTEL(\d+)/);
      if (match) {
        estimatedDiscount = parseInt(match[1], 10);
      }
    } else if (dto.budget && ['$25k-$50k', '$50k+'].includes(dto.budget)) {
      discountEligible = true;
      estimatedDiscount = 10; // Descuento estándar para presupuestos altos
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      requiredFields,
      optionalFields,
      discountEligible,
      estimatedDiscount
    };
  }

  /**
   * Valida filtros de búsqueda de solicitudes
   */
  static validateDiscountFormSearch(dto: any): DiscountFormValidationDTO {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validar límites de paginación
    if (dto.limit !== undefined) {
      if (typeof dto.limit !== 'number' || dto.limit < 1 || dto.limit > 100) {
        errors.push('limit debe ser un número entre 1 y 100');
      }
    }

    if (dto.offset !== undefined) {
      if (typeof dto.offset !== 'number' || dto.offset < 0) {
        errors.push('offset debe ser un número mayor o igual a 0');
      }
    }

    // Validar rango de presupuesto
    if (dto.budgetRange) {
      if (dto.budgetRange.min !== undefined && dto.budgetRange.min < 0) {
        errors.push('budgetRange.min debe ser mayor o igual a 0');
      }
      if (dto.budgetRange.max !== undefined && dto.budgetRange.max < 0) {
        errors.push('budgetRange.max debe ser mayor o igual a 0');
      }
      if (dto.budgetRange.min && dto.budgetRange.max && dto.budgetRange.min > dto.budgetRange.max) {
        errors.push('budgetRange.min no puede ser mayor que budgetRange.max');
      }
    }

    // Validar fechas
    ['startDate', 'endDate'].forEach(field => {
      if (dto[field]) {
        const date = new Date(dto[field]);
        if (isNaN(date.getTime())) {
          errors.push(`${field} debe ser una fecha válida`);
        }
      }
    });

    // Validar orden
    if (dto.sortBy && !['submittedAt', 'fullName', 'serviceInterest', 'estimatedValue'].includes(dto.sortBy)) {
      errors.push('sortBy debe ser uno de: submittedAt, fullName, serviceInterest, estimatedValue');
    }

    if (dto.sortOrder && !['asc', 'desc'].includes(dto.sortOrder)) {
      errors.push('sortOrder debe ser asc o desc');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      requiredFields: [],
      optionalFields: ['serviceInterest', 'status', 'companySize', 'budgetRange'],
      discountEligible: false,
      estimatedDiscount: undefined
    };
  }

  /**
   * Sanitiza los datos de la solicitud de descuento
   */
  static sanitizeDiscountFormRequest(dto: DiscountFormRequestDTO): DiscountFormRequestDTO {
    const sanitized: DiscountFormRequestDTO = {
      sessionId: dto.sessionId.trim(),
      email: dto.email.trim().toLowerCase(),
      fullName: dto.fullName.trim(),
      serviceInterest: dto.serviceInterest.trim(),
      agreeToMarketing: dto.agreeToMarketing || false
    };

    // Solo agregar campos opcionales si tienen valor
    if (dto.phoneNumber?.trim()) sanitized.phoneNumber = dto.phoneNumber.trim();
    if (dto.companyName?.trim()) sanitized.companyName = dto.companyName.trim();
    if (dto.companySize?.trim()) sanitized.companySize = dto.companySize.trim();
    if (dto.budget?.trim()) sanitized.budget = dto.budget.trim();
    if (dto.timeline?.trim()) sanitized.timeline = dto.timeline.trim();
    if (dto.projectDescription?.trim()) sanitized.projectDescription = dto.projectDescription.trim();
    if (dto.currentSolution?.trim()) sanitized.currentSolution = dto.currentSolution.trim();
    if (dto.painPoints?.trim()) sanitized.painPoints = dto.painPoints.trim();
    if (dto.goals?.trim()) sanitized.goals = dto.goals.trim();
    if (dto.decisionMakers?.trim()) sanitized.decisionMakers = dto.decisionMakers.trim();
    if (dto.additionalInfo?.trim()) sanitized.additionalInfo = dto.additionalInfo.trim();
    if (dto.wheelResultId?.trim()) sanitized.wheelResultId = dto.wheelResultId.trim();
    if (dto.discountCode?.trim()) sanitized.discountCode = dto.discountCode.trim().toUpperCase();
    if (dto.referralSource?.trim()) sanitized.referralSource = dto.referralSource.trim();

    return sanitized;
  }
}

/**
 * Helper para trabajar con DiscountFormDTOs
 */
export class DiscountFormDTOHelper {
  /**
   * Convierte datos de entidad a DiscountFormResponseDTO
   */
  static toResponseDTO(requestData: {
    id: string;
    sessionId: string;
    email: string;
    fullName: string;
    phoneNumber?: string | undefined;
    serviceInterest: string;
    status: string;
    timestamp: Date;
    processedAt?: Date | undefined;
    emailSent: boolean;
    followUpScheduled: boolean;
    discountApplied?: string | undefined;
    estimatedValue?: number | undefined;
  }): DiscountFormResponseDTO {
    const response: DiscountFormResponseDTO = {
      id: requestData.id,
      sessionId: requestData.sessionId,
      email: requestData.email,
      fullName: requestData.fullName,
      serviceInterest: requestData.serviceInterest,
      status: requestData.status,
      submittedAt: requestData.timestamp.toISOString(),
      emailSent: requestData.emailSent,
      followUpScheduled: requestData.followUpScheduled,
      quotationNumber: DiscountFormDTOHelper.generateQuotationNumber(requestData.id, requestData.timestamp),
      validUntil: DiscountFormDTOHelper.calculateValidUntil().toISOString()
    };

    // Solo agregar campos opcionales si tienen valor
    if (requestData.phoneNumber) response.phoneNumber = requestData.phoneNumber;
    if (requestData.processedAt) response.processedAt = requestData.processedAt.toISOString();
    if (requestData.discountApplied) response.discountApplied = requestData.discountApplied;
    if (requestData.estimatedValue !== undefined) response.estimatedValue = requestData.estimatedValue;

    return response;
  }

  /**
   * Genera número de cotización único
   */
  static generateQuotationNumber(id: string, timestamp: Date): string {
    const year = timestamp.getFullYear();
    const month = (timestamp.getMonth() + 1).toString().padStart(2, '0');
    const day = timestamp.getDate().toString().padStart(2, '0');
    const shortId = id.substring(0, 4).toUpperCase();
    return `COT${year}${month}${day}-${shortId}`;
  }

  /**
   * Calcula fecha de validez del descuento (30 días)
   */
  static calculateValidUntil(): Date {
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + 30);
    return validUntil;
  }

  /**
   * Obtiene configuración por defecto de búsqueda
   */
  static getDefaultSearchConfig(): DiscountFormSearchDTO {
    return {
      limit: 20,
      offset: 0,
      sortBy: 'submittedAt',
      sortOrder: 'desc'
    };
  }

  /**
   * Convierte a resumen de solicitud
   */
  static toSummaryDTO(requestData: {
    id: string;
    fullName: string;
    email: string;
    serviceInterest: string;
    status: string;
    timestamp: Date;
    estimatedValue?: number | undefined;
    discountApplied?: string | undefined;
    urgentFollowUp: boolean;
    wheelResultId?: string | undefined;
  }): DiscountFormSummaryDTO {
    const summary: DiscountFormSummaryDTO = {
      id: requestData.id,
      quotationNumber: DiscountFormDTOHelper.generateQuotationNumber(requestData.id, requestData.timestamp),
      fullName: requestData.fullName,
      email: requestData.email,
      serviceInterest: requestData.serviceInterest,
      status: requestData.status,
      submittedAt: requestData.timestamp.toISOString(),
      urgentFollowUp: requestData.urgentFollowUp,
      hasWheelDiscount: !!requestData.wheelResultId
    };

    // Solo agregar campos opcionales si tienen valor
    if (requestData.estimatedValue !== undefined) summary.estimatedValue = requestData.estimatedValue;
    if (requestData.discountApplied) summary.discountApplied = requestData.discountApplied;

    return summary;
  }

  /**
   * Obtiene servicios disponibles por defecto
   */
  static getDefaultServices(): ServiceConfigDTO[] {
    return [
      {
        id: 'web-development',
        name: 'Desarrollo Web',
        category: 'Desarrollo',
        description: 'Desarrollo de sitios web y aplicaciones web personalizadas',
        basePrice: 15000,
        currency: 'USD',
        isActive: true,
        features: ['Diseño responsive', 'SEO optimizado', 'Panel de administración'],
        estimatedTimeline: '2-3 meses',
        requiredInfo: ['Objetivos del proyecto', 'Funcionalidades deseadas'],
        optionalInfo: ['Referencias de diseño', 'Integraciones necesarias']
      },
      {
        id: 'mobile-development',
        name: 'Desarrollo Mobile',
        category: 'Desarrollo',
        description: 'Aplicaciones móviles nativas e híbridas',
        basePrice: 25000,
        currency: 'USD',
        isActive: true,
        features: ['iOS y Android', 'Backend incluido', 'Publicación en stores'],
        estimatedTimeline: '3-4 meses',
        requiredInfo: ['Plataformas objetivo', 'Funcionalidades principales'],
        optionalInfo: ['Integraciones con APIs', 'Notificaciones push']
      },
      {
        id: 'ecommerce',
        name: 'E-commerce',
        category: 'Desarrollo',
        description: 'Tiendas online completas con gestión de inventario',
        basePrice: 20000,
        currency: 'USD',
        isActive: true,
        features: ['Carrito de compras', 'Pagos en línea', 'Gestión de productos'],
        estimatedTimeline: '2-3 meses',
        requiredInfo: ['Tipo de productos', 'Métodos de pago preferidos'],
        optionalInfo: ['Integraciones ERP', 'Marketing automation']
      }
    ];
  }

  /**
   * Calcula descuento estimado basado en criterios
   */
  static calculateEstimatedDiscount(requestData: {
    serviceInterest: string;
    budget?: string | undefined;
    companySize?: string | undefined;
    timeline?: string | undefined;
    wheelResultId?: string | undefined;
  }): { eligible: boolean; percentage: number; reason: string } {
    let percentage = 0;
    let reason = '';

    // Descuento de rueda tiene prioridad
    if (requestData.wheelResultId) {
      return { eligible: true, percentage: 15, reason: 'Descuento ganado en la rueda de la suerte' };
    }

    // Descuento por presupuesto alto
    if (requestData.budget === '$50k+') {
      percentage = 15;
      reason = 'Descuento por presupuesto alto';
    } else if (requestData.budget === '$25k-$50k') {
      percentage = 10;
      reason = 'Descuento por presupuesto considerable';
    }

    // Descuento adicional por empresa grande
    if (requestData.companySize === '500+') {
      percentage += 5;
      reason += percentage > 5 ? ' + descuento empresarial' : 'Descuento empresarial';
    }

    // Descuento por urgencia
    if (requestData.timeline === 'Inmediato') {
      percentage += 5;
      reason += percentage > 5 ? ' + descuento por urgencia' : 'Descuento por proyecto urgente';
    }

    // Limitar descuento máximo
    percentage = Math.min(percentage, 25);

    return {
      eligible: percentage > 0,
      percentage,
      reason: reason || 'No elegible para descuento automático'
    };
  }
}