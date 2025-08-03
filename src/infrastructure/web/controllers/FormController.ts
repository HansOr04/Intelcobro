// src/infrastructure/web/controllers/FormController.ts

import { Request, Response, NextFunction } from 'express';
import { SubmitJobApplicationUseCase } from '../../../application/use-cases/forms/SubmitJobApplicationUseCase';
import { SubmitDiscountFormUseCase } from '../../../application/use-cases/forms/SubmitDiscountFormUseCase';
import { JobApplicationRequestDTO, JobApplicationResponseDTO } from '../../../application/dto/JobApplicationDTO';
import { DiscountFormRequestDTO, DiscountFormResponseDTO } from '../../../application/dto/DiscountFormDTO';
import { ValidationException } from '../../../application/exceptions/ValidationException';
import { logger } from '../../../shared/utils/Logger';

/**
 * Controlador para endpoints de formularios
 */
export class FormController {
  constructor(
    private readonly submitJobApplicationUseCase: SubmitJobApplicationUseCase,
    private readonly submitDiscountFormUseCase: SubmitDiscountFormUseCase
  ) {}

  /**
   * Procesa aplicación de trabajo
   * POST /api/forms/job-application
   */
  async submitJobApplication(req: Request, res: Response, next: NextFunction): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Extraer archivo de CV si existe
      const resumeFile = req.file;

      // Preparar request DTO
      const applicationRequest: JobApplicationRequestDTO = {
        sessionId: req.body.sessionId || `session_${Date.now()}`,
        fullName: req.body.fullName,
        email: req.body.email,
        phoneNumber: req.body.phoneNumber,
        position: req.body.position,
        experience: req.body.experience,
        skills: req.body.skills,
        education: req.body.education,
        availability: req.body.availability,
        portfolio: req.body.portfolio,
        coverLetter: req.body.coverLetter,
        salary: req.body.salary,
        relocate: req.body.relocate === 'true' || req.body.relocate === true,
        remoteWork: req.body.remoteWork === 'true' || req.body.remoteWork === true,
        startDate: req.body.startDate,
        references: req.body.references,
        linkedIn: req.body.linkedIn,
        github: req.body.github,
        resume: resumeFile ? `${resumeFile.filename}` : req.body.resume,
        additionalInfo: req.body.additionalInfo
      };

      logger.info('Processing job application', {
        position: applicationRequest.position,
        email: applicationRequest.email,
        hasResume: !!resumeFile,
        ip: req.ip
      });

      // Validaciones adicionales de negocio
      await this.validateJobApplication(applicationRequest);

      // Ejecutar caso de uso
      const result = await this.submitJobApplicationUseCase.execute(applicationRequest);

      // Preparar respuesta
      const responseData: JobApplicationResponseDTO = {
        id: result.application.id,
        sessionId: result.application.sessionId,
        email: result.application.email,
        fullName: result.application.fullName,
        phoneNumber: result.application.phoneNumber,
        position: result.application.position,
        status: result.application.status,
        submittedAt: result.application.submittedAt,
        processedAt: result.application.processedAt,
        emailSent: result.application.emailSent,
        followUpScheduled: result.application.followUpScheduled,
        applicationNumber: result.applicationNumber
      };

      logger.info('Job application processed successfully', {
        applicationId: result.application.id,
        position: result.application.position,
        status: result.application.status,
        processingTime: Date.now() - startTime,
        hasResume: !!resumeFile
      });

      res.status(201).json({
        success: true,
        message: 'Aplicación enviada exitosamente',
        data: responseData,
        metadata: {
          processingTime: Date.now() - startTime,
          timestamp: new Date().toISOString(),
          nextSteps: result.nextSteps,
          warnings: result.validationWarnings
        }
      });

    } catch (error) {
      logger.error('Error processing job application', error instanceof Error ? error : undefined, {
        position: req.body.position,
        email: req.body.email,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        processingTime: Date.now() - startTime,
        ip: req.ip
      });

      // Limpiar archivo subido en caso de error
      if (req.file) {
        try {
          const fs = require('fs');
          if (fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
          }
        } catch (cleanupError) {
          logger.warn('Error cleaning up uploaded file', {
            path: req.file.path,
            error: cleanupError instanceof Error ? cleanupError.message : 'Unknown error'
          });
        }
      }

      next(error);
    }
  }

  /**
   * Procesa formulario de descuento
   * POST /api/forms/discount-form
   */
  async submitDiscountForm(req: Request, res: Response, next: NextFunction): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Preparar request DTO
      const discountRequest: DiscountFormRequestDTO = {
        sessionId: req.body.sessionId || `session_${Date.now()}`,
        fullName: req.body.fullName,
        email: req.body.email,
        phoneNumber: req.body.phoneNumber,
        serviceInterest: req.body.serviceInterest,
        companyName: req.body.companyName,
        companySize: req.body.companySize,
        budget: req.body.budget,
        timeline: req.body.timeline,
        projectDescription: req.body.projectDescription,
        currentSolution: req.body.currentSolution,
        painPoints: req.body.painPoints,
        goals: req.body.goals,
        decisionMakers: req.body.decisionMakers,
        additionalInfo: req.body.additionalInfo,
        wheelResultId: req.body.wheelResultId,
        discountCode: req.body.discountCode,
        referralSource: req.body.referralSource,
        agreeToMarketing: req.body.agreeToMarketing === 'true' || req.body.agreeToMarketing === true
      };

      logger.info('Processing discount form', {
        serviceInterest: discountRequest.serviceInterest,
        email: discountRequest.email,
        hasWheelResult: !!discountRequest.wheelResultId,
        ip: req.ip
      });

      // Validaciones adicionales de negocio
      await this.validateDiscountForm(discountRequest);

      // Ejecutar caso de uso
      const result = await this.submitDiscountFormUseCase.execute(discountRequest);

      // Preparar respuesta
      const responseData: DiscountFormResponseDTO = {
        id: result.request.id,
        sessionId: result.request.sessionId,
        email: result.request.email,
        fullName: result.request.fullName,
        phoneNumber: result.request.phoneNumber,
        serviceInterest: result.request.serviceInterest,
        status: result.request.status,
        submittedAt: result.request.submittedAt,
        processedAt: result.request.processedAt,
        emailSent: result.request.emailSent,
        followUpScheduled: result.request.followUpScheduled,
        discountApplied: result.discountApplied.description,
        quotationNumber: result.quotationNumber,
        estimatedValue: result.estimatedValue.finalPrice,
        validUntil: result.discountApplied.validUntil.toISOString()
      };

      logger.info('Discount form processed successfully', {
        formId: result.request.id,
        serviceInterest: result.request.serviceInterest,
        status: result.request.status,
        discountApplied: result.discountApplied.percentage,
        processingTime: Date.now() - startTime
      });

      res.status(201).json({
        success: true,
        message: 'Formulario enviado exitosamente',
        data: responseData,
        metadata: {
          processingTime: Date.now() - startTime,
          timestamp: new Date().toISOString(),
          nextSteps: result.nextSteps,
          warnings: result.validationWarnings
        }
      });

    } catch (error) {
      logger.error('Error processing discount form', error instanceof Error ? error : undefined, {
        serviceInterest: req.body.serviceInterest,
        email: req.body.email,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        processingTime: Date.now() - startTime,
        ip: req.ip
      });

      next(error);
    }
  }

  /**
   * Obtiene información de servicios disponibles
   * GET /api/forms/services
   */
  async getServices(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      logger.debug('Fetching available services', { ip: req.ip });

      // Servicios disponibles (en una implementación real vendrían de BD)
      const services = [
        {
          id: 'web-development',
          name: 'Desarrollo Web',
          category: 'Desarrollo',
          description: 'Desarrollo de sitios web y aplicaciones web personalizadas',
          basePrice: 15000,
          currency: 'USD',
          features: ['Diseño responsive', 'SEO optimizado', 'Panel de administración'],
          estimatedTimeline: '2-3 meses',
          isActive: true
        },
        {
          id: 'mobile-development',
          name: 'Desarrollo Mobile',
          category: 'Desarrollo',
          description: 'Aplicaciones móviles nativas e híbridas',
          basePrice: 25000,
          currency: 'USD',
          features: ['iOS y Android', 'Backend incluido', 'Publicación en stores'],
          estimatedTimeline: '3-4 meses',
          isActive: true
        },
        {
          id: 'ecommerce',
          name: 'E-commerce',
          category: 'Desarrollo',
          description: 'Tiendas online completas con gestión de inventario',
          basePrice: 20000,
          currency: 'USD',
          features: ['Carrito de compras', 'Pagos en línea', 'Gestión de productos'],
          estimatedTimeline: '2-3 meses',
          isActive: true
        },
        {
          id: 'consulting',
          name: 'Consultoría Tech',
          category: 'Consultoría',
          description: 'Asesoría tecnológica y arquitectura de sistemas',
          basePrice: 5000,
          currency: 'USD',
          features: ['Auditoría técnica', 'Recomendaciones', 'Plan de implementación'],
          estimatedTimeline: '2-4 semanas',
          isActive: true
        }
      ];

      res.status(200).json({
        success: true,
        message: 'Servicios obtenidos exitosamente',
        data: {
          services,
          categories: [...new Set(services.map(s => s.category))],
          totalServices: services.length,
          activeServices: services.filter(s => s.isActive).length
        }
      });

    } catch (error) {
      logger.error('Error fetching services', error instanceof Error ? error : undefined, {
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        ip: req.ip
      });

      next(error);
    }
  }

  /**
   * Obtiene estadísticas de formularios
   * GET /api/forms/stats
   */
  async getFormStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const timeRange = req.query.timeRange as string || '7d';
      
      logger.debug('Fetching form statistics', {
        timeRange,
        ip: req.ip
      });

      // Simulación de estadísticas
      const stats = {
        timeRange,
        generatedAt: new Date().toISOString(),
        jobApplications: {
          total: 0,
          pending: 0,
          reviewed: 0,
          rejected: 0,
          topPositions: [] as Array<{ position: string; count: number }>
        },
        discountForms: {
          total: 0,
          withWheelResult: 0,
          averageDiscount: 0,
          topServices: [] as Array<{ service: string; count: number }>
        },
        conversion: {
          jobApplicationToInterview: 0.0,
          discountFormToQuotation: 0.0,
          wheelToForm: 0.0
        },
        performance: {
          averageSubmissionTime: 0,
          completionRate: 0.0,
          bounceRate: 0.0
        }
      };

      res.status(200).json({
        success: true,
        message: 'Estadísticas obtenidas exitosamente',
        data: stats
      });

    } catch (error) {
      logger.error('Error fetching form stats', error instanceof Error ? error : undefined, {
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        ip: req.ip
      });

      next(error);
    }
  }

  /**
   * Valida código de descuento
   * POST /api/forms/validate-discount
   */
  async validateDiscount(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { discountCode, wheelResultId, serviceInterest } = req.body;

      logger.debug('Validating discount code', {
        discountCode,
        wheelResultId,
        serviceInterest,
        ip: req.ip
      });

      // Validar entrada
      if (!discountCode && !wheelResultId) {
        throw new ValidationException('Se requiere código de descuento o ID de resultado de ruleta');
      }

      // En una implementación real, verificarías en la base de datos
      const validationResult = {
        isValid: true,
        discountPercentage: 20,
        description: 'Descuento de ruleta',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 días
        applicableServices: ['web-development', 'mobile-development', 'ecommerce'],
        minimumAmount: 5000,
        maxDiscount: 10000,
        usageLimit: 1,
        usageCount: 0
      };

      // Verificar si el servicio es aplicable
      if (serviceInterest && !validationResult.applicableServices.includes(serviceInterest)) {
        validationResult.isValid = false;
      }

      res.status(200).json({
        success: true,
        message: validationResult.isValid ? 'Descuento válido' : 'Descuento no válido',
        data: validationResult
      });

    } catch (error) {
      logger.error('Error validating discount', error instanceof Error ? error : undefined, {
        discountCode: req.body.discountCode,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        ip: req.ip
      });

      next(error);
    }
  }

  /**
   * Obtiene estado de aplicación
   * GET /api/forms/application/:id/status
   */
  async getApplicationStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { email } = req.query;

      logger.debug('Fetching application status', {
        applicationId: id,
        email,
        ip: req.ip
      });

      // En una implementación real, buscarías en la base de datos
      const applicationStatus = {
        id,
        type: 'job-application',
        status: 'pending',
        submittedAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        timeline: [
          {
            status: 'submitted',
            timestamp: new Date().toISOString(),
            description: 'Aplicación enviada exitosamente'
          }
        ],
        estimatedNextUpdate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 días
        contactInfo: {
          email: 'hr@intelcobro.com',
          phone: '+1-555-0123'
        }
      };

      res.status(200).json({
        success: true,
        message: 'Estado obtenido exitosamente',
        data: applicationStatus
      });

    } catch (error) {
      logger.error('Error fetching application status', error instanceof Error ? error : undefined, {
        applicationId: req.params.id,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        ip: req.ip
      });

      next(error);
    }
  }

  /**
   * Genera cotización preliminar
   * POST /api/forms/quote
   */
  async generateQuote(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const {
        serviceInterest,
        projectDescription,
        timeline,
        budget,
        companySize,
        features
      } = req.body;

      logger.info('Generating preliminary quote', {
        serviceInterest,
        timeline,
        budget,
        companySize,
        ip: req.ip
      });

      // Validar datos mínimos
      if (!serviceInterest) {
        throw new ValidationException('Servicio de interés es requerido');
      }

      // Calcular cotización base (lógica simplificada)
      const baseQuote = await this.calculateBaseQuote(serviceInterest, {
        projectDescription,
        timeline,
        budget,
        companySize,
        features: features || []
      });

      const quote = {
        id: `quote_${Date.now()}`,
        serviceInterest,
        estimatedValue: baseQuote.estimatedValue,
        priceRange: baseQuote.priceRange,
        timeline: baseQuote.timeline,
        breakdown: baseQuote.breakdown,
        assumptions: baseQuote.assumptions,
        nextSteps: [
          'Agendar llamada de descubrimiento',
          'Definir requerimientos específicos',
          'Crear propuesta formal',
          'Negociar términos y condiciones'
        ],
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 días
        contactInfo: {
          email: 'sales@intelcobro.com',
          phone: '+1-555-0123',
          calendar: 'https://calendly.com/intelcobro/discovery-call'
        },
        generatedAt: new Date().toISOString()
      };

      res.status(201).json({
        success: true,
        message: 'Cotización preliminar generada exitosamente',
        data: quote
      });

    } catch (error) {
      logger.error('Error generating quote', error instanceof Error ? error : undefined, {
        serviceInterest: req.body.serviceInterest,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        ip: req.ip
      });

      next(error);
    }
  }

  /**
   * Obtiene formularios disponibles y sus configuraciones
   * GET /api/forms/config
   */
  async getFormsConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      logger.debug('Fetching forms configuration', { ip: req.ip });

      const formsConfig = {
        jobApplication: {
          fields: [
            { name: 'fullName', type: 'text', required: true, maxLength: 100 },
            { name: 'email', type: 'email', required: true, maxLength: 100 },
            { name: 'phoneNumber', type: 'tel', required: true, pattern: '^\\+?[1-9]\\d{7,14}$' },
            { name: 'position', type: 'text', required: true, maxLength: 100 },
            { name: 'experience', type: 'textarea', required: true, maxLength: 2000 },
            { name: 'skills', type: 'array', required: true, minItems: 1, maxItems: 20 },
            { name: 'linkedIn', type: 'url', required: false },
            { name: 'github', type: 'url', required: false },
            { name: 'portfolio', type: 'url', required: false },
            { name: 'salary', type: 'text', required: false },
            { name: 'startDate', type: 'date', required: false },
            { name: 'availability', type: 'select', required: false, options: ['remote', 'onsite', 'hybrid'] },
            { name: 'additionalInfo', type: 'textarea', required: false, maxLength: 1000 },
            { name: 'resume', type: 'file', required: false, accept: '.pdf,.doc,.docx', maxSize: '5MB' }
          ],
          positions: [
            'Desarrollador Frontend',
            'Desarrollador Backend',
            'Desarrollador Full Stack',
            'Diseñador UX/UI',
            'DevOps Engineer',
            'QA Engineer',
            'Project Manager',
            'Otro'
          ]
        },
        discountForm: {
          fields: [
            { name: 'fullName', type: 'text', required: true, maxLength: 100 },
            { name: 'email', type: 'email', required: true, maxLength: 100 },
            { name: 'phoneNumber', type: 'tel', required: true, pattern: '^\\+?[1-9]\\d{7,14}$' },
            { name: 'serviceInterest', type: 'select', required: true, options: ['web-development', 'mobile-development', 'ecommerce', 'consulting', 'design', 'marketing', 'other'] },
            { name: 'companyName', type: 'text', required: false, maxLength: 100 },
            { name: 'companySize', type: 'select', required: false, options: ['1-10', '11-50', '51-200', '201-1000', '1000+'] },
            { name: 'budget', type: 'select', required: false, options: ['less-than-5k', '5k-15k', '15k-50k', '50k-100k', 'more-than-100k', 'not-sure'] },
            { name: 'timeline', type: 'select', required: false, options: ['asap', '1-month', '2-3-months', '3-6-months', 'more-than-6-months', 'flexible'] },
            { name: 'projectDescription', type: 'textarea', required: false, maxLength: 2000 },
            { name: 'wheelResultId', type: 'text', required: false },
            { name: 'discountCode', type: 'text', required: false },
            { name: 'referralSource', type: 'select', required: false, options: ['google', 'social-media', 'referral', 'advertising', 'event', 'other'] },
            { name: 'agreeToMarketing', type: 'boolean', required: false }
          ],
          services: [
            { id: 'web-development', name: 'Desarrollo Web', category: 'Desarrollo' },
            { id: 'mobile-development', name: 'Desarrollo Mobile', category: 'Desarrollo' },
            { id: 'ecommerce', name: 'E-commerce', category: 'Desarrollo' },
            { id: 'consulting', name: 'Consultoría Tech', category: 'Consultoría' },
            { id: 'design', name: 'Diseño UX/UI', category: 'Diseño' },
            { id: 'marketing', name: 'Marketing Digital', category: 'Marketing' }
          ]
        },
        validation: {
          rateLimit: {
            windowMs: 900000, // 15 minutos
            maxRequests: 5
          },
          fileUpload: {
            maxSize: 5242880, // 5MB
            allowedTypes: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
          }
        }
      };

      res.status(200).json({
        success: true,
        message: 'Configuración de formularios obtenida exitosamente',
        data: formsConfig
      });

    } catch (error) {
      logger.error('Error fetching forms config', error instanceof Error ? error : undefined, {
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        ip: req.ip
      });

      next(error);
    }
  }

  // ===============================
  // MÉTODOS PRIVADOS DE VALIDACIÓN
  // ===============================

  /**
   * Validaciones adicionales para aplicación de trabajo
   */
  private async validateJobApplication(request: JobApplicationRequestDTO): Promise<void> {
    const errors: string[] = [];

    // Validar email único (en una implementación real verificarías en BD)
    if (await this.isEmailAlreadyUsed(request.email, 'job-application')) {
      errors.push('Este email ya tiene una aplicación activa');
    }

    // Validar experiencia mínima para ciertas posiciones
    const seniorPositions = ['Senior Developer', 'Tech Lead', 'Architect'];
    if (seniorPositions.some(pos => request.position.toLowerCase().includes(pos.toLowerCase()))) {
      if (request.experience.length < 100) {
        errors.push('Posiciones senior requieren descripción detallada de experiencia (mínimo 100 caracteres)');
      }
    }

    // Validar URLs si están presentes
    if (request.linkedIn && !this.isValidLinkedInUrl(request.linkedIn)) {
      errors.push('URL de LinkedIn inválida');
    }

    if (request.github && !this.isValidGitHubUrl(request.github)) {
      errors.push('URL de GitHub inválida');
    }

    if (errors.length > 0) {
      throw new ValidationException('Aplicación de trabajo inválida', {
        timestamp: new Date(),
        entity: 'JobApplication',
        operation: 'validation'
      });
    }
  }

  /**
   * Validaciones adicionales para formulario de descuento
   */
  private async validateDiscountForm(request: DiscountFormRequestDTO): Promise<void> {
    const errors: string[] = [];

    // Validar email único
    if (await this.isEmailAlreadyUsed(request.email, 'discount-form')) {
      errors.push('Este email ya tiene un formulario de descuento activo');
    }

    // Validar resultado de ruleta si está presente
    if (request.wheelResultId) {
      const isValidWheelResult = await this.validateWheelResult(request.wheelResultId);
      if (!isValidWheelResult) {
        errors.push('Resultado de ruleta inválido o expirado');
      }
    }

    // Validar código de descuento si está presente
    if (request.discountCode) {
      const isValidCode = await this.validateDiscountCode(request.discountCode);
      if (!isValidCode) {
        errors.push('Código de descuento inválido o expirado');
      }
    }

    // Validar descripción de proyecto para servicios específicos
    const detailedServices = ['web-development', 'mobile-development', 'ecommerce'];
    if (detailedServices.includes(request.serviceInterest)) {
      if (!request.projectDescription || request.projectDescription.length < 50) {
        errors.push('Este servicio requiere descripción detallada del proyecto (mínimo 50 caracteres)');
      }
    }

    // Validar presupuesto razonable
    if (request.budget === 'less-than-5k' && ['mobile-development', 'ecommerce'].includes(request.serviceInterest)) {
      errors.push('El presupuesto seleccionado puede ser insuficiente para este tipo de servicio');
    }

    if (errors.length > 0) {
      throw new ValidationException('Formulario de descuento inválido', {
        timestamp: new Date(),
        entity: 'DiscountForm',
        operation: 'validation'
      });
    }
  }

  // ===============================
  // MÉTODOS PRIVADOS DE UTILIDAD
  // ===============================

  /**
   * Verifica si el email ya fue usado
   */
  private async isEmailAlreadyUsed(email: string, formType: string): Promise<boolean> {
    // En una implementación real, consultarías la base de datos
    // Por ahora, simulamos que no hay duplicados
    return false;
  }

  /**
   * Valida URL de LinkedIn
   */
  private isValidLinkedInUrl(url: string): boolean {
    const linkedinRegex = /^https?:\/\/(www\.)?linkedin\.com\/in\/[a-zA-Z0-9-]+\/?$/;
    return linkedinRegex.test(url);
  }

  /**
   * Valida URL de GitHub
   */
  private isValidGitHubUrl(url: string): boolean {
    const githubRegex = /^https?:\/\/(www\.)?github\.com\/[a-zA-Z0-9-]+\/?$/;
    return githubRegex.test(url);
  }

  /**
   * Valida resultado de ruleta
   */
  private async validateWheelResult(wheelResultId: string): Promise<boolean> {
    // En una implementación real, verificarías en la base de datos
    // Verificar que existe, no está expirado y no fue usado
    return wheelResultId.startsWith('wheel_result_');
  }

  /**
   * Valida código de descuento
   */
  private async validateDiscountCode(discountCode: string): Promise<boolean> {
    // En una implementación real, verificarías en la base de datos
    const validCodePattern = /^WHEEL\d{4}$/;
    return validCodePattern.test(discountCode);
  }

  /**
   * Calcula cotización base
   */
  private async calculateBaseQuote(serviceInterest: string, details: {
    projectDescription?: string;
    timeline?: string;
    budget?: string;
    companySize?: string;
    features: string[];
  }): Promise<{
    estimatedValue: number;
    priceRange: { min: number; max: number };
    timeline: string;
    breakdown: Array<{ item: string; cost: number; description: string }>;
    assumptions: string[];
  }> {
    // Precios base por servicio
    const basePrices: Record<string, number> = {
      'web-development': 15000,
      'mobile-development': 25000,
      'ecommerce': 20000,
      'consulting': 5000,
      'design': 8000,
      'marketing': 10000
    };

    const basePrice = basePrices[serviceInterest] || 10000;
    
    // Factores de ajuste
    let multiplier = 1.0;
    
    // Ajuste por timeline
    if (details.timeline === 'asap') multiplier += 0.3; // Rush job
    else if (details.timeline === 'flexible') multiplier += 0.1; // Discount for flexibility
    
    // Ajuste por tamaño de empresa
    if (details.companySize === '1000+') multiplier += 0.2; // Enterprise
    else if (details.companySize === '1-10') multiplier -= 0.1; // Startup discount
    
    // Ajuste por características adicionales
    const featureMultiplier = 1 + (details.features.length * 0.1);
    multiplier *= featureMultiplier;

    const estimatedValue = Math.round(basePrice * multiplier);
    const variance = 0.2; // 20% de varianza
    
    return {
      estimatedValue,
      priceRange: {
        min: Math.round(estimatedValue * (1 - variance)),
        max: Math.round(estimatedValue * (1 + variance))
      },
      timeline: this.calculateTimeline(serviceInterest, details.timeline),
      breakdown: [
        {
          item: 'Desarrollo base',
          cost: Math.round(basePrice * 0.6),
          description: 'Desarrollo principal de la funcionalidad'
        },
        {
          item: 'Diseño y UX',
          cost: Math.round(basePrice * 0.2),
          description: 'Diseño de interfaz y experiencia de usuario'
        },
        {
          item: 'Testing y QA',
          cost: Math.round(basePrice * 0.1),
          description: 'Pruebas y aseguramiento de calidad'
        },
        {
          item: 'Deployment y documentación',
          cost: Math.round(basePrice * 0.1),
          description: 'Puesta en producción y documentación técnica'
        }
      ],
      assumptions: [
        'Precios aproximados basados en información preliminar',
        'Cotización final puede variar según requerimientos específicos',
        'Incluye hasta 3 rondas de revisiones',
        'No incluye mantenimiento post-lanzamiento',
        'Válido por 30 días'
      ]
    };
  }

  /**
   * Calcula timeline estimado
   */
  private calculateTimeline(serviceInterest: string, requestedTimeline?: string): string {
    const baseTimelines: Record<string, string> = {
      'web-development': '2-3 meses',
      'mobile-development': '3-4 meses',
      'ecommerce': '2-3 meses',
      'consulting': '2-4 semanas',
      'design': '3-6 semanas',
      'marketing': '1-2 meses'
    };

    let timeline = baseTimelines[serviceInterest] || '1-2 meses';
    
    if (requestedTimeline === 'asap') {
      timeline = timeline.replace(/(\d+)-(\d+)/, (match, min, max) => {
        const newMin = Math.max(1, parseInt(min) - 1);
        const newMax = Math.max(parseInt(min), parseInt(max) - 1);
        return `${newMin}-${newMax}`;
      });
      timeline += ' (rush)';
    }
    
    return timeline;
  }
}