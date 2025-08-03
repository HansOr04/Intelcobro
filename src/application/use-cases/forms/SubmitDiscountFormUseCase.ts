// src/application/use-cases/forms/SubmitDiscountFormUseCase.ts

import { FormSubmission, FormSubmissionStatus } from '../../../domain/entities/FormSubmission';
import { FormType } from '../../../domain/enums/FormType';
import { Email } from '../../../domain/value-objects/Email';
import { PhoneNumber } from '../../../domain/value-objects/PhoneNumber';
import { DiscountPercentage } from '../../../domain/value-objects/DiscountPercentage';
import { DiscountFormRequestDTO, DiscountFormResponseDTO } from '../../dto/DiscountFormDTO';
import { IEmailService } from '../../interfaces/services/IEmailService';
import { IAIService } from '../../interfaces/services/IAIService';
import { ValidationException, ValidationErrorType } from '../../exceptions/ValidationException';
import { EmailServiceException } from '../../exceptions/EmailServiceException';
import { logger } from '../../../shared/utils/Logger';
import { randomGenerator } from '../../../shared/utils/RandomGenerator';

/**
 * Opciones para el caso de uso de solicitud de descuento
 */
export interface SubmitDiscountFormOptions {
  sendNotificationEmail?: boolean;
  sendConfirmationEmail?: boolean;
  validateWheelDiscount?: boolean;
  generateQuotation?: boolean;
  scheduleFollowUp?: boolean;
  adminEmails?: string[];
  metadata?: Record<string, any>;
}

/**
 * Resultado del envío de solicitud de descuento
 */
export interface SubmitDiscountFormResult {
  request: DiscountFormResponseDTO;
  quotationNumber: string;
  discountApplied: DiscountInfo;
  emailsSent: {
    confirmation: boolean;
    notification: boolean;
  };
  estimatedValue: EstimatedValue;
  validationWarnings: string[];
  processingTime: number;
  nextSteps: string[];
  metadata?: Record<string, any>;
}

/**
 * Información de descuento aplicado
 */
interface DiscountInfo {
  percentage: number;
  source: 'wheel' | 'budget' | 'company_size' | 'urgency' | 'none';
  code?: string | undefined; // Explicitly allow undefined
  description: string;
  validUntil: Date;
}

/**
 * Valor estimado del proyecto
 */
interface EstimatedValue {
  basePrice: number;
  discountAmount: number;
  finalPrice: number;
  currency: string;
  breakdown: PricingBreakdown[];
}

/**
 * Desglose de precios
 */
interface PricingBreakdown {
  item: string;
  description: string;
  basePrice: number;
  quantity: number;
  total: number;
}

/**
 * Contexto para el procesamiento de la solicitud
 */
interface DiscountRequestProcessingContext {
  submission: FormSubmission;
  service: ServiceInfo;
  customerEmail: Email;
  customerPhone?: PhoneNumber | undefined; // Explicitly allow undefined
  wheelDiscount?: WheelDiscountInfo | undefined; // Explicitly allow undefined
  calculatedDiscount: DiscountInfo;
  estimatedValue: EstimatedValue;
  adminEmails: string[];
  validationResults: ValidationResult[];
}

/**
 * Información del servicio solicitado
 */
interface ServiceInfo {
  id: string;
  name: string;
  category: string;
  basePrice: number;
  estimatedTimeline: string;
  features: string[];
  complexity: 'simple' | 'medium' | 'complex' | 'enterprise';
}

/**
 * Información de descuento de rueda
 */
interface WheelDiscountInfo {
  resultId: string;
  code: string;
  percentage: number;
  isValid: boolean;
  expiresAt: Date;
}

/**
 * Resultado de validación
 */
interface ValidationResult {
  field: string;
  isValid: boolean;
  message?: string;
  suggestion?: string;
}

/**
 * Caso de uso para procesar solicitudes de descuento
 */
export class SubmitDiscountFormUseCase {
  private readonly defaultAdminEmails = ['ventas@intelcobro.com', 'admin@intelcobro.com'];

  constructor(
    private readonly emailService: IEmailService,
    private readonly aiService?: IAIService
  ) {}

  /**
   * Ejecuta el caso de uso de solicitud de descuento
   */
  async execute(
    request: DiscountFormRequestDTO,
    options: SubmitDiscountFormOptions = {}
  ): Promise<SubmitDiscountFormResult> {
    const startTime = Date.now();
    
    try {
      // Validar entrada
      await this.validateRequest(request);
      
      // Crear contexto de procesamiento
      const context = await this.createProcessingContext(request, options);
      
      // Procesar la solicitud
      await this.processDiscountRequest(context, options);
      
      // Enviar emails si está habilitado
      const emailResults = await this.sendEmails(context, options);
      
      // Programar follow-up si es necesario
      if (options.scheduleFollowUp) {
        await this.scheduleFollowUp(context);
      }
      
      // Marcar como completado
      context.submission.markAsCompleted();
      
      const processingTime = Date.now() - startTime;
      
      // Log del resultado
      logger.info('Solicitud de descuento procesada exitosamente', {
        requestId: context.submission.id,
        service: request.serviceInterest,
        customerEmail: request.email,
        discountApplied: context.calculatedDiscount.percentage,
        estimatedValue: context.estimatedValue.finalPrice,
        processingTime
      });
      
      return {
        request: this.toResponseDTO(context.submission),
        quotationNumber: this.generateQuotationNumber(context.submission),
        discountApplied: context.calculatedDiscount,
        emailsSent: emailResults,
        estimatedValue: context.estimatedValue,
        validationWarnings: this.extractWarnings(context.validationResults),
        processingTime,
        nextSteps: this.generateNextSteps(context),
        metadata: {
          serviceComplexity: context.service.complexity,
          hasWheelDiscount: !!context.wheelDiscount,
          ...options.metadata
        }
      };
      
    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      logger.error('Error al procesar solicitud de descuento', error as Error, {
        service: request.serviceInterest,
        customerEmail: request.email,
        processingTime
      });
      
      throw error;
    }
  }

  /**
   * Valida la solicitud de descuento
   */
  private async validateRequest(request: DiscountFormRequestDTO): Promise<void> {
    const errors: string[] = [];

    // Validar campos requeridos
    if (!request.sessionId?.trim()) errors.push('sessionId es requerido');
    if (!request.email?.trim()) errors.push('email es requerido');
    if (!request.fullName?.trim()) errors.push('fullName es requerido');
    if (!request.serviceInterest?.trim()) errors.push('serviceInterest es requerido');

    // Validar email
    try {
      new Email(request.email);
    } catch {
      errors.push('email debe tener un formato válido');
    }

    // Validar teléfono si está presente
    if (request.phoneNumber) {
      try {
        new PhoneNumber(request.phoneNumber);
      } catch {
        errors.push('phoneNumber debe tener un formato válido');
      }
    }

    // Validar código de descuento si está presente
    if (request.discountCode) {
      const codeRegex = /^INTEL\d+[A-Z0-9]+$/;
      if (!codeRegex.test(request.discountCode)) {
        errors.push('discountCode no tiene el formato válido');
      }
    }

    // Validar servicios válidos
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

    if (request.serviceInterest && !validServices.includes(request.serviceInterest)) {
      errors.push('serviceInterest debe ser uno de los servicios válidos');
    }

    if (errors.length > 0) {
      throw ValidationException.multiple(
        errors.map(error => ({
          type: ValidationErrorType.BUSINESS_RULE_VIOLATION,
          field: 'general',
          message: error
        }))
      );
    }
  }

  /**
   * Crea el contexto de procesamiento
   */
  private async createProcessingContext(
    request: DiscountFormRequestDTO,
    options: SubmitDiscountFormOptions
  ): Promise<DiscountRequestProcessingContext> {
    // Crear entidades de valor
    const customerEmail = new Email(request.email);
    const customerPhone = request.phoneNumber ? new PhoneNumber(request.phoneNumber) : undefined;

    // Crear submission
    const submission = FormSubmission.createDiscountRequest(
      request.sessionId,
      customerEmail,
      {
        fullName: request.fullName,
        serviceInterest: request.serviceInterest,
        companyName: request.companyName,
        companySize: request.companySize,
        budget: request.budget,
        timeline: request.timeline,
        projectDescription: request.projectDescription,
        currentSolution: request.currentSolution,
        painPoints: request.painPoints,
        goals: request.goals,
        decisionMakers: request.decisionMakers,
        additionalInfo: request.additionalInfo,
        wheelResultId: request.wheelResultId,
        discountCode: request.discountCode,
        referralSource: request.referralSource,
        agreeToMarketing: request.agreeToMarketing
      },
      customerPhone
    );

    // Marcar como en procesamiento
    submission.markAsProcessing();

    // Obtener información del servicio
    const service = await this.getServiceInfo(request.serviceInterest);

    // Validar descuento de rueda si está presente
    let wheelDiscount: WheelDiscountInfo | undefined = undefined;
    if (options.validateWheelDiscount && request.discountCode) {
      wheelDiscount = await this.validateWheelDiscount(request.discountCode, request.wheelResultId);
    }

    // Calcular descuento aplicable
    const calculatedDiscount = this.calculateDiscount(request, service, wheelDiscount);

    // Estimar valor del proyecto
    const estimatedValue = await this.estimateProjectValue(request, service, calculatedDiscount);

    // Realizar validaciones adicionales
    const validationResults = await this.performAdditionalValidations(request, service);

    return {
      submission,
      service,
      customerEmail,
      customerPhone,
      wheelDiscount,
      calculatedDiscount,
      estimatedValue,
      adminEmails: options.adminEmails || this.defaultAdminEmails,
      validationResults
    };
  }

  /**
   * Procesa la solicitud de descuento
   */
  private async processDiscountRequest(
    context: DiscountRequestProcessingContext,
    options: SubmitDiscountFormOptions
  ): Promise<void> {
    // Añadir notas sobre el descuento aplicado
    const discountNotes = this.generateDiscountNotes(context);
    context.submission.addNotes(discountNotes);

    // Determinar si necesita follow-up urgente
    if (this.requiresUrgentFollowUp(context)) {
      context.submission.scheduleFollowUp();
    }

    // Generar cotización si está habilitado
    if (options.generateQuotation) {
      await this.generateQuotation(context);
    }
  }

  /**
   * Calcula el descuento aplicable
   */
  private calculateDiscount(
    request: DiscountFormRequestDTO,
    service: ServiceInfo,
    wheelDiscount?: WheelDiscountInfo | undefined
  ): DiscountInfo {
    let percentage = 0;
    let source: DiscountInfo['source'] = 'none';
    let description = 'Sin descuento aplicable';
    let code: string | undefined = undefined;

    // Prioridad 1: Descuento de rueda
    if (wheelDiscount && wheelDiscount.isValid) {
      percentage = wheelDiscount.percentage;
      source = 'wheel';
      description = `Descuento ganado en la rueda de la suerte: ${percentage}%`;
      code = wheelDiscount.code;
    }
    // Prioridad 2: Descuento por presupuesto
    else if (request.budget === '$50k+') {
      percentage = 15;
      source = 'budget';
      description = 'Descuento por presupuesto alto (>$50k): 15%';
    }
    else if (request.budget === '$25k-$50k') {
      percentage = 10;
      source = 'budget';
      description = 'Descuento por presupuesto considerable ($25k-$50k): 10%';
    }
    // Prioridad 3: Descuento por tamaño de empresa
    else if (request.companySize === '500+') {
      percentage = 8;
      source = 'company_size';
      description = 'Descuento empresarial (>500 empleados): 8%';
    }
    else if (request.companySize === '201-500') {
      percentage = 5;
      source = 'company_size';
      description = 'Descuento empresarial (201-500 empleados): 5%';
    }
    // Prioridad 4: Descuento por urgencia
    else if (request.timeline === 'Inmediato') {
      percentage = 5;
      source = 'urgency';
      description = 'Descuento por proyecto urgente: 5%';
    }

    // Generar código si no es de rueda
    if (percentage > 0 && !code) {
      code = this.generateDiscountCode(percentage, source);
    }

    return {
      percentage,
      source,
      code,
      description,
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 días
    };
  }

  /**
   * Estima el valor del proyecto
   */
  private async estimateProjectValue(
    request: DiscountFormRequestDTO,
    service: ServiceInfo,
    discount: DiscountInfo
  ): Promise<EstimatedValue> {
    const basePrice = this.calculateBasePrice(request, service);
    const discountPercentage = new DiscountPercentage(discount.percentage);
    const discountAmount = discountPercentage.calculateDiscountAmount(basePrice);
    const finalPrice = basePrice - discountAmount;

    const breakdown = this.generatePricingBreakdown(request, service);

    return {
      basePrice,
      discountAmount,
      finalPrice,
      currency: 'USD',
      breakdown
    };
  }

  /**
   * Calcula el precio base del proyecto
   */
  private calculateBasePrice(request: DiscountFormRequestDTO, service: ServiceInfo): number {
    let basePrice = service.basePrice;

    // Ajustar por complejidad basada en descripción
    if (request.projectDescription) {
      const description = request.projectDescription.toLowerCase();
      
      if (description.includes('complejo') || description.includes('avanzado') || description.includes('enterprise')) {
        basePrice *= 1.5;
      } else if (description.includes('simple') || description.includes('básico')) {
        basePrice *= 0.8;
      }
    }

    // Ajustar por timeline
    if (request.timeline === 'Inmediato') {
      basePrice *= 1.3; // Recargo por urgencia
    } else if (request.timeline === 'Sin prisa') {
      basePrice *= 0.9; // Descuento por flexibilidad
    }

    return Math.round(basePrice);
  }

  /**
   * Genera desglose de precios
   */
  private generatePricingBreakdown(request: DiscountFormRequestDTO, service: ServiceInfo): PricingBreakdown[] {
    const breakdown: PricingBreakdown[] = [
      {
        item: service.name,
        description: `Desarrollo de ${service.name.toLowerCase()}`,
        basePrice: service.basePrice,
        quantity: 1,
        total: service.basePrice
      }
    ];

    // Añadir elementos adicionales basados en la descripción
    if (request.projectDescription?.toLowerCase().includes('mobile')) {
      breakdown.push({
        item: 'Aplicación Móvil',
        description: 'Desarrollo de app móvil complementaria',
        basePrice: 8000,
        quantity: 1,
        total: 8000
      });
    }

    if (request.projectDescription?.toLowerCase().includes('admin') || 
        request.projectDescription?.toLowerCase().includes('dashboard')) {
      breakdown.push({
        item: 'Panel de Administración',
        description: 'Dashboard administrativo personalizado',
        basePrice: 3000,
        quantity: 1,
        total: 3000
      });
    }

    return breakdown;
  }

  /**
   * Valida descuento de rueda
   */
  private async validateWheelDiscount(
    discountCode: string,
    wheelResultId?: string
  ): Promise<WheelDiscountInfo | undefined> {
    // En una implementación real, esto consultaría la base de datos
    // Por ahora, simulamos la validación
    
    if (!discountCode.startsWith('INTEL')) {
      return undefined;
    }

    const match = discountCode.match(/INTEL(\d+)/);
    if (!match || !match[1]) {
      return undefined;
    }
    const percentage = parseInt(match[1], 10);
    
    return {
      resultId: wheelResultId || 'simulated-wheel-result',
      code: discountCode,
      percentage,
      isValid: true,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 horas
    };
  }

  /**
   * Obtiene información del servicio
   */
  private async getServiceInfo(serviceName: string): Promise<ServiceInfo> {
    const services: Record<string, ServiceInfo> = {
      'Desarrollo Web': {
        id: 'web-dev',
        name: 'Desarrollo Web',
        category: 'Desarrollo',
        basePrice: 15000,
        estimatedTimeline: '2-3 meses',
        features: ['Diseño responsive', 'SEO optimizado', 'Panel admin'],
        complexity: 'medium'
      },
      'Desarrollo Mobile': {
        id: 'mobile-dev',
        name: 'Desarrollo Mobile',
        category: 'Desarrollo',
        basePrice: 25000,
        estimatedTimeline: '3-4 meses',
        features: ['iOS y Android', 'Backend incluido', 'Publicación stores'],
        complexity: 'complex'
      },
      'E-commerce': {
        id: 'ecommerce',
        name: 'E-commerce',
        category: 'Desarrollo',
        basePrice: 20000,
        estimatedTimeline: '2-3 meses',
        features: ['Carrito compras', 'Pagos online', 'Gestión productos'],
        complexity: 'medium'
      },
      'Sistemas de Gestión': {
        id: 'erp',
        name: 'Sistemas de Gestión',
        category: 'Enterprise',
        basePrice: 35000,
        estimatedTimeline: '4-6 meses',
        features: ['ERP personalizado', 'Integraciones', 'Reportes avanzados'],
        complexity: 'enterprise'
      },
      'Consultoría IT': {
        id: 'consulting',
        name: 'Consultoría IT',
        category: 'Consultoría',
        basePrice: 5000,
        estimatedTimeline: '2-4 semanas',
        features: ['Análisis técnico', 'Recomendaciones', 'Plan de acción'],
        complexity: 'simple'
      }
    };

    return services[serviceName] || {
      id: 'custom',
      name: serviceName,
      category: 'Personalizado',
      basePrice: 10000,
      estimatedTimeline: '2-3 meses',
      features: ['Desarrollo personalizado'],
      complexity: 'medium'
    };
  }

  /**
   * Genera código de descuento
   */
  private generateDiscountCode(percentage: number, source: string): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = randomGenerator.generateId(4).toUpperCase();
    const sourceCode = source.toUpperCase().substring(0, 3);
    
    return `INTEL${percentage}${sourceCode}${timestamp}${random}`.substring(0, 16);
  }

  /**
   * Realiza validaciones adicionales
   */
  private async performAdditionalValidations(
    request: DiscountFormRequestDTO,
    service: ServiceInfo
  ): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];

    // Validar presupuesto vs servicio
    if (request.budget && service.basePrice > 30000 && request.budget === '<$5k') {
      results.push({
        field: 'budget',
        isValid: false,
        message: 'El presupuesto indicado puede ser insuficiente para el servicio solicitado',
        suggestion: 'Considerar un presupuesto mayor para este tipo de proyecto'
      });
    }

    // Validar timeline vs complejidad
    if (request.timeline === 'Inmediato' && service.complexity === 'enterprise') {
      results.push({
        field: 'timeline',
        isValid: false,
        message: 'Proyectos enterprise requieren más tiempo de desarrollo',
        suggestion: 'Considerar un timeline más realista para proyectos complejos'
      });
    }

    return results;
  }

  /**
   * Genera notas sobre el descuento
   */
  private generateDiscountNotes(context: DiscountRequestProcessingContext): string {
    const notes = [
      `Análisis automático de descuento:`,
      `- Servicio solicitado: ${context.service.name}`,
      `- Precio base estimado: ${context.estimatedValue.basePrice.toLocaleString()}`,
      `- Descuento aplicado: ${context.calculatedDiscount.percentage}% (${context.calculatedDiscount.source})`,
      `- Precio final: ${context.estimatedValue.finalPrice.toLocaleString()}`,
      `- Código de descuento: ${context.calculatedDiscount.code || 'N/A'}`
    ];

    if (context.wheelDiscount) {
      notes.push(`- Descuento de rueda validado: ${context.wheelDiscount.code}`);
    }

    return notes.join('\n');
  }

  /**
   * Determina si requiere seguimiento urgente
   */
  private requiresUrgentFollowUp(context: DiscountRequestProcessingContext): boolean {
    // Follow-up urgente para proyectos de alto valor
    if (context.estimatedValue.basePrice > 50000) {
      return true;
    }

    // Follow-up urgente para timeline inmediato
    if (context.submission.formData.timeline === 'Inmediato') {
      return true;
    }

    // Follow-up urgente para empresas grandes
    if (context.submission.formData.companySize === '500+') {
      return true;
    }

    return false;
  }

  /**
   * Envía emails correspondientes
   */
  private async sendEmails(
    context: DiscountRequestProcessingContext,
    options: SubmitDiscountFormOptions
  ): Promise<{ confirmation: boolean; notification: boolean }> {
    const results = { confirmation: false, notification: false };

    try {
      // Enviar confirmación al cliente
      if (options.sendConfirmationEmail !== false) {
        await this.sendConfirmationEmail(context);
        context.submission.markEmailAsSent();
        results.confirmation = true;
      }

      // Enviar notificación a administradores
      if (options.sendNotificationEmail !== false) {
        await this.sendNotificationEmail(context);
        results.notification = true;
      }

    } catch (error) {
      logger.warn('Error al enviar emails, continuando procesamiento', {
        requestId: context.submission.id,
        error: (error as Error).message
      });
    }

    return results;
  }

  /**
   * Envía email de confirmación al cliente
   */
  private async sendConfirmationEmail(context: DiscountRequestProcessingContext): Promise<void> {
    const quotationNumber = this.generateQuotationNumber(context.submission);
    
    const emailContent = {
      to: context.customerEmail.value,
      subject: `Cotización ${quotationNumber} - ${context.service.name}`,
      html: this.generateConfirmationEmailHtml(context, quotationNumber),
      text: this.generateConfirmationEmailText(context, quotationNumber)
    };

    await this.emailService.sendEmail(emailContent);
  }

  /**
   * Envía notificación a administradores
   */
  private async sendNotificationEmail(context: DiscountRequestProcessingContext): Promise<void> {
    const quotationNumber = this.generateQuotationNumber(context.submission);
    
    const emailContent = {
      to: context.adminEmails,
      subject: `Nueva solicitud: ${context.service.name} - ${context.estimatedValue.finalPrice.toLocaleString()} - ${context.submission.formData.fullName}`,
      html: this.generateNotificationEmailHtml(context, quotationNumber),
      text: this.generateNotificationEmailText(context, quotationNumber)
    };

    await this.emailService.sendEmail(emailContent);
  }

  /**
   * Programa follow-up
   */
  private async scheduleFollowUp(context: DiscountRequestProcessingContext): Promise<void> {
    context.submission.scheduleFollowUp();
    
    logger.info('Follow-up programado para solicitud de descuento', {
      requestId: context.submission.id,
      service: context.service.name,
      urgent: this.requiresUrgentFollowUp(context)
    });
  }

  /**
   * Genera cotización formal
   */
  private async generateQuotation(context: DiscountRequestProcessingContext): Promise<void> {
    // En una implementación real, esto generaría un PDF de cotización
    logger.info('Cotización generada', {
      requestId: context.submission.id,
      service: context.service.name,
      estimatedValue: context.estimatedValue.finalPrice
    });
  }

  /**
   * Extrae warnings de validación
   */
  private extractWarnings(validationResults: ValidationResult[]): string[] {
    return validationResults
      .filter(result => !result.isValid)
      .map(result => result.message || 'Warning sin mensaje');
  }

  /**
   * Genera pasos siguientes
   */
  private generateNextSteps(context: DiscountRequestProcessingContext): string[] {
    const steps = [
      'Hemos recibido tu solicitud de cotización',
      'Nuestro equipo de ventas la está revisando'
    ];

    if (context.calculatedDiscount.percentage > 0) {
      steps.push(`Se ha aplicado un descuento del ${context.calculatedDiscount.percentage}% a tu cotización`);
    }

    if (this.requiresUrgentFollowUp(context)) {
      steps.push('Priorizaremos tu solicitud por su alto valor/urgencia');
      steps.push('Te contactaremos dentro de 24 horas');
    } else {
      steps.push('Te contactaremos dentro de 2-3 días hábiles');
    }

    steps.push('Recibirás una cotización detallada por email');

    return steps;
  }

  /**
   * Genera número de cotización
   */
  private generateQuotationNumber(submission: FormSubmission): string {
    const year = submission.timestamp.getFullYear();
    const month = (submission.timestamp.getMonth() + 1).toString().padStart(2, '0');
    const day = submission.timestamp.getDate().toString().padStart(2, '0');
    const shortId = submission.id.substring(0, 4).toUpperCase();
    return `COT${year}${month}${day}-${shortId}`;
  }

  /**
   * Convierte a DTO de respuesta
   */
  private toResponseDTO(submission: FormSubmission): DiscountFormResponseDTO {
    return {
      id: submission.id,
      sessionId: submission.sessionId,
      email: submission.email.value,
      fullName: submission.formData.fullName,
      phoneNumber: submission.phoneNumber?.value || undefined,
      serviceInterest: submission.formData.serviceInterest,
      status: submission.status,
      submittedAt: submission.timestamp.toISOString(),
      processedAt: submission.processedAt?.toISOString() || undefined,
      emailSent: submission.emailSent,
      followUpScheduled: submission.followUpScheduled,
      quotationNumber: this.generateQuotationNumber(submission),
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    };
  }

  /**
   * Genera HTML para email de confirmación
   */
  private generateConfirmationEmailHtml(
    context: DiscountRequestProcessingContext,
    quotationNumber: string
  ): string {
    return `
      <h2>Cotización de ${context.service.name} - Intelcobro</h2>
      <p>Estimado/a ${context.submission.formData.fullName},</p>
      <p>Gracias por tu interés en nuestros servicios. Hemos preparado la siguiente cotización:</p>
      
      <div style="background: #f5f5f5; padding: 20px; margin: 20px 0; border-radius: 5px;">
        <h3>Cotización #${quotationNumber}</h3>
        <p><strong>Servicio:</strong> ${context.service.name}</p>
        <p><strong>Precio base:</strong> ${context.estimatedValue.basePrice.toLocaleString()}</p>
        ${context.calculatedDiscount.percentage > 0 ? `
          <p><strong>Descuento aplicado:</strong> ${context.calculatedDiscount.percentage}% (${context.calculatedDiscount.description})</p>
          <p><strong>Ahorro:</strong> ${context.estimatedValue.discountAmount.toLocaleString()}</p>
        ` : ''}
        <p style="font-size: 18px;"><strong>Precio final: ${context.estimatedValue.finalPrice.toLocaleString()}</strong></p>
        <p><strong>Timeline estimado:</strong> ${context.service.estimatedTimeline}</p>
      </div>
      
      ${context.calculatedDiscount.code ? `
        <p><strong>Código de descuento:</strong> ${context.calculatedDiscount.code}</p>
        <p><em>Válido hasta: ${context.calculatedDiscount.validUntil.toLocaleDateString()}</em></p>
      ` : ''}
      
      <h3>Próximos pasos:</h3>
      <ul>
        <li>Nuestro equipo te contactará para afinar los detalles</li>
        <li>Prepararemos una propuesta detallada</li>
        <li>Coordinaremos una reunión para discutir el proyecto</li>
      </ul>
      
      <p>¿Tienes preguntas? Responde a este email o llámanos.</p>
      <p>Saludos,<br>Equipo de Ventas<br>Intelcobro</p>
    `;
  }

  /**
   * Genera texto plano para email de confirmación
   */
  private generateConfirmationEmailText(
    context: DiscountRequestProcessingContext,
    quotationNumber: string
  ): string {
    return `
Cotización de ${context.service.name} - Intelcobro

Estimado/a ${context.submission.formData.fullName},

Gracias por tu interés en nuestros servicios. Hemos preparado la siguiente cotización:

Cotización #${quotationNumber}
Servicio: ${context.service.name}
Precio base: ${context.estimatedValue.basePrice.toLocaleString()}
${context.calculatedDiscount.percentage > 0 ? `
Descuento aplicado: ${context.calculatedDiscount.percentage}% (${context.calculatedDiscount.description})
Ahorro: ${context.estimatedValue.discountAmount.toLocaleString()}
` : ''}
Precio final: ${context.estimatedValue.finalPrice.toLocaleString()}
Timeline estimado: ${context.service.estimatedTimeline}

${context.calculatedDiscount.code ? `
Código de descuento: ${context.calculatedDiscount.code}
Válido hasta: ${context.calculatedDiscount.validUntil.toLocaleDateString()}
` : ''}

Próximos pasos:
- Nuestro equipo te contactará para afinar los detalles
- Prepararemos una propuesta detallada
- Coordinaremos una reunión para discutir el proyecto

¿Tienes preguntas? Responde a este email o llámanos.

Saludos,
Equipo de Ventas
Intelcobro
    `.trim();
  }

  /**
   * Genera HTML para email de notificación
   */
  private generateNotificationEmailHtml(
    context: DiscountRequestProcessingContext,
    quotationNumber: string
  ): string {
    return `
      <h2>Nueva Solicitud de Descuento - ${context.service.name}</h2>
      <p><strong>Cliente:</strong> ${context.submission.formData.fullName}</p>
      <p><strong>Email:</strong> ${context.customerEmail.value}</p>
      <p><strong>Teléfono:</strong> ${context.customerPhone?.toDisplayFormat() || 'No proporcionado'}</p>
      <p><strong>Servicio:</strong> ${context.service.name}</p>
      <p><strong>Cotización:</strong> ${quotationNumber}</p>
      
      <h3>Detalles del Proyecto:</h3>
      <p><strong>Empresa:</strong> ${context.submission.formData.companyName || 'No especificada'}</p>
      <p><strong>Presupuesto:</strong> ${context.submission.formData.budget || 'No especificado'}</p>
      <p><strong>Timeline:</strong> ${context.submission.formData.timeline || 'No especificado'}</p>
      
      <h3>Análisis de Descuento:</h3>
      <p><strong>Descuento aplicado:</strong> ${context.calculatedDiscount.percentage}%</p>
      <p><strong>Precio estimado:</strong> ${context.estimatedValue.finalPrice.toLocaleString()}</p>
      <p><strong>Requiere seguimiento urgente:</strong> ${this.requiresUrgentFollowUp(context) ? 'Sí' : 'No'}</p>
      
      <hr>
      <p><em>Solicitud enviada desde el sistema de Intelcobro</em></p>
    `;
  }

  /**
   * Genera texto plano para email de notificación
   */
  private generateNotificationEmailText(
    context: DiscountRequestProcessingContext,
    quotationNumber: string
  ): string {
    return `
Nueva Solicitud de Descuento - ${context.service.name}

Cliente: ${context.submission.formData.fullName}
Email: ${context.customerEmail.value}
Teléfono: ${context.customerPhone?.toDisplayFormat() || 'No proporcionado'}
Servicio: ${context.service.name}
Cotización: ${quotationNumber}

Detalles del Proyecto:
Empresa: ${context.submission.formData.companyName || 'No especificada'}
Presupuesto: ${context.submission.formData.budget || 'No especificado'}
Timeline: ${context.submission.formData.timeline || 'No especificado'}

Análisis de Descuento:
Descuento aplicado: ${context.calculatedDiscount.percentage}%
Precio estimado: ${context.estimatedValue.finalPrice.toLocaleString()}
Requiere seguimiento urgente: ${this.requiresUrgentFollowUp(context) ? 'Sí' : 'No'}

---
Solicitud enviada desde el sistema de Intelcobro
    `.trim();
  }
}