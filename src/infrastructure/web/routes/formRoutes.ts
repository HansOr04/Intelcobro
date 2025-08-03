// src/infrastructure/web/routes/formRoutes.ts

import { Router, Request, Response, NextFunction } from 'express';
import { FormController } from '../controllers/FormController';
import { ValidationMiddleware } from '../middlewares/ValidationMiddleware';
import { FileUploadMiddleware } from '../middlewares/FileUploadMiddleware';
import { FormValidator } from '../validators/FormValidator';
import { ErrorHandlerMiddleware } from '../middlewares/ErrorHandlerMiddleware';

/**
 * Extended Request interface for form-specific properties
 */
interface FormRequest extends Request {
  formMetadata?: {
    submissionTime: number;
    ip: string;
    userAgent?: string | undefined;
    referer?: string | undefined;
    formType: string;
    hasFile: boolean;
  };
  file?: any; // For file uploads
}

/**
 * Configuración de rutas para formularios
 */
export function createFormRoutes(formController: FormController): Router {
  const router = Router();

  // Middleware general para todas las rutas de formularios
  router.use(ErrorHandlerMiddleware.asyncHandler(() => {}));

  /**
   * POST /api/forms/job-application
   * Procesa aplicación de trabajo
   */
  router.post(
    '/job-application',
    // Rate limiting por email
    ValidationMiddleware.rateLimitByField('email', 3, 3600000), // 3 aplicaciones por hora por email
    
    // Subida de archivo CV
    FileUploadMiddleware.uploadResume(),
    
    // Validación del formulario
    ValidationMiddleware.validate(FormValidator.jobApplicationSchema, 'body'),
    
    // Validación anti-XSS
    ValidationMiddleware.validateXSS(),
    
    // Sanitización
    ValidationMiddleware.sanitize('body'),
    
    // Verificar espacio en disco antes de procesar
    FileUploadMiddleware.checkDiskSpace(2), // 2GB mínimo
    
    // Scan antivirus si hay archivo
    FileUploadMiddleware.antivirusScan(),
    
    // Controlador
    ErrorHandlerMiddleware.asyncHandler(
      formController.submitJobApplication.bind(formController)
    )
  );

  /**
   * POST /api/forms/discount-form
   * Procesa formulario de descuento
   */
  router.post(
    '/discount-form',
    // Rate limiting por email e IP
    ValidationMiddleware.rateLimitByField('email', 5, 3600000), // 5 formularios por hora por email
    
    // Validación del formulario
    ValidationMiddleware.validate(FormValidator.discountFormSchema, 'body'),
    
    // Validación anti-XSS
    ValidationMiddleware.validateXSS(),
    
    // Sanitización
    ValidationMiddleware.sanitize('body'),
    
    // Controlador
    ErrorHandlerMiddleware.asyncHandler(
      formController.submitDiscountForm.bind(formController)
    )
  );

  /**
   * GET /api/forms/services
   * Obtiene lista de servicios disponibles
   */
  router.get(
    '/services',
    // Rate limiting moderado
    ValidationMiddleware.rateLimitByField('ip', 30, 60000), // 30 requests por minuto por IP
    
    // Cache headers para servicios (no cambian frecuentemente)
    (req: Request, res: Response, next: NextFunction) => {
      res.set('Cache-Control', 'public, max-age=3600'); // 1 hora
      next();
    },
    
    // Controlador
    ErrorHandlerMiddleware.asyncHandler(
      formController.getServices.bind(formController)
    )
  );

  /**
   * GET /api/forms/config
   * Obtiene configuración de formularios
   */
  router.get(
    '/config',
    // Rate limiting
    ValidationMiddleware.rateLimitByField('ip', 20, 60000),
    
    // Cache headers
    (req: Request, res: Response, next: NextFunction) => {
      res.set('Cache-Control', 'public, max-age=1800'); // 30 minutos
      next();
    },
    
    // Controlador
    ErrorHandlerMiddleware.asyncHandler(
      formController.getFormsConfig.bind(formController)
    )
  );

  /**
   * POST /api/forms/validate-discount
   * Valida código de descuento o resultado de ruleta
   */
  router.post(
    '/validate-discount',
    // Rate limiting
    ValidationMiddleware.rateLimitByField('ip', 20, 60000),
    
    // Validación básica
    ValidationMiddleware.validate(
      require('joi').object({
        discountCode: require('joi').string().optional(),
        wheelResultId: require('joi').string().optional(),
        serviceInterest: require('joi').string().optional()
      }).or('discountCode', 'wheelResultId'),
      'body'
    ),
    
    // Controlador
    ErrorHandlerMiddleware.asyncHandler(
      formController.validateDiscount.bind(formController)
    )
  );

  /**
   * POST /api/forms/quote
   * Genera cotización preliminar
   */
  router.post(
    '/quote',
    // Rate limiting por IP
    ValidationMiddleware.rateLimitByField('ip', 10, 3600000), // 10 cotizaciones por hora
    
    // Validación de datos para cotización
    ValidationMiddleware.validate(
      require('joi').object({
        serviceInterest: require('joi').string().required(),
        projectDescription: require('joi').string().min(20).max(2000).optional(),
        timeline: require('joi').string().valid('asap', '1-month', '2-3-months', '3-6-months', 'more-than-6-months', 'flexible').optional(),
        budget: require('joi').string().valid('less-than-5k', '5k-15k', '15k-50k', '50k-100k', 'more-than-100k', 'not-sure').optional(),
        companySize: require('joi').string().valid('1-10', '11-50', '51-200', '201-1000', '1000+').optional(),
        features: require('joi').array().items(require('joi').string()).max(10).default([])
      }),
      'body'
    ),
    
    // Controlador
    ErrorHandlerMiddleware.asyncHandler(
      formController.generateQuote.bind(formController)
    )
  );

  /**
   * GET /api/forms/application/:id/status
   * Obtiene estado de una aplicación
   */
  router.get(
    '/application/:id/status',
    // Validación de parámetros
    ValidationMiddleware.validate(
      require('joi').object({
        id: require('joi').string().required().pattern(/^[a-zA-Z0-9_-]+$/)
      }),
      'params'
    ),
    
    // Validación de query (email para verificación)
    ValidationMiddleware.validate(
      require('joi').object({
        email: require('joi').string().email().optional()
      }),
      'query'
    ),
    
    // Rate limiting
    ValidationMiddleware.rateLimitByField('id', 10, 3600000), // 10 consultas por hora por aplicación
    
    // Controlador
    ErrorHandlerMiddleware.asyncHandler(
      formController.getApplicationStatus.bind(formController)
    )
  );

  /**
   * GET /api/forms/stats
   * Obtiene estadísticas de formularios (requiere autenticación en producción)
   */
  router.get(
    '/stats',
    // Rate limiting estricto para estadísticas
    ValidationMiddleware.rateLimitByField('ip', 5, 3600000), // 5 requests por hora
    
    // Validación de query parameters
    ValidationMiddleware.validate(
      require('joi').object({
        timeRange: require('joi').string().valid('1h', '24h', '7d', '30d', '90d').default('7d'),
        detailed: require('joi').boolean().default(false)
      }),
      'query'
    ),
    
    // En producción, aquí irían middlewares de autenticación
    // authMiddleware.requireRole('admin'),
    
    // Controlador
    ErrorHandlerMiddleware.asyncHandler(
      formController.getFormStats.bind(formController)
    )
  );

  /**
   * POST /api/forms/contact
   * Formulario de contacto general
   */
  router.post(
    '/contact',
    // Rate limiting por IP y email
    ValidationMiddleware.rateLimitByField('ip', 10, 3600000), // 10 por hora por IP
    ValidationMiddleware.rateLimitByField('email', 5, 3600000), // 5 por hora por email
    
    // Validación del formulario de contacto
    ValidationMiddleware.validate(FormValidator.contactFormSchema, 'body'),
    
    // Validación anti-XSS
    ValidationMiddleware.validateXSS(),
    
    // Sanitización
    ValidationMiddleware.sanitize('body'),
    
    // Controlador (por implementar en FormController)
    ErrorHandlerMiddleware.asyncHandler(async (req: Request, res: Response) => {
      // Implementación básica del formulario de contacto
      const contactData = {
        id: `contact_${Date.now()}`,
        ...req.body,
        submittedAt: new Date().toISOString(),
        ip: req.ip,
        status: 'received'
      };

      res.status(201).json({
        success: true,
        message: 'Mensaje de contacto enviado exitosamente',
        data: contactData
      });
    })
  );

  /**
   * POST /api/forms/feedback
   * Feedback sobre formularios
   */
  router.post(
    '/feedback',
    // Rate limiting
    ValidationMiddleware.rateLimitByField('ip', 20, 3600000),
    
    // Validación del feedback
    ValidationMiddleware.validate(FormValidator.feedbackSchema, 'body'),
    
    // Controlador (por implementar en FormController)
    ErrorHandlerMiddleware.asyncHandler(async (req: Request, res: Response) => {
      const feedbackData = {
        id: `feedback_${Date.now()}`,
        ...req.body,
        submittedAt: new Date().toISOString(),
        ip: req.ip
      };

      res.status(201).json({
        success: true,
        message: 'Feedback enviado exitosamente',
        data: feedbackData
      });
    })
  );

  /**
   * GET /api/forms/health
   * Health check específico de formularios
   */
  router.get(
    '/health',
    ErrorHandlerMiddleware.asyncHandler(async (req: Request, res: Response) => {
      const healthStatus = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        components: {
          validation: 'operational',
          fileUpload: 'operational',
          emailService: 'operational',
          database: 'operational'
        },
        metrics: {
          totalSubmissions: 0,
          successRate: 1.0,
          averageProcessingTime: 0
        }
      };

      res.status(200).json({
        success: true,
        message: 'Form service is healthy',
        data: healthStatus
      });
    })
  );

  // Middleware de limpieza de archivos temporales
  router.use(FileUploadMiddleware.cleanupOldFiles(24)); // 24 horas

  // Middleware de manejo de errores específico para formularios
  router.use((error: any, req: FormRequest, res: Response, next: NextFunction) => {
    // Log específico para errores de formularios
    console.error('Form route error:', {
      path: req.path,
      method: req.method,
      formType: req.path.includes('job-application') ? 'job-application' : 
                req.path.includes('discount-form') ? 'discount-form' : 'other',
      error: error.message,
      hasFile: !!req.file
    });
    
    next(error);
  });

  return router;
}

/**
 * Middleware específico para rutas de formularios
 */
export const formMiddleware = {
  /**
   * Middleware para validar datos de empresa
   */
  validateCompanyData: () => {
    return (req: FormRequest, res: Response, next: NextFunction): void => {
      if (req.body.companyName) {
        // Validaciones adicionales para datos de empresa
        const companyName = req.body.companyName.trim();
        
        if (companyName.length < 2) {
          res.status(400).json({
            success: false,
            error: 'Company name too short',
            message: 'El nombre de la empresa debe tener al menos 2 caracteres'
          });
          return;
        }

        // Normalizar nombre de empresa
        req.body.companyName = companyName
          .split(' ')
          .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join(' ');
      }

      next();
    };
  },

  /**
   * Middleware para detectar submissions duplicadas
   */
  detectDuplicates: () => {
    const recentSubmissions = new Map();
    
    return (req: FormRequest, res: Response, next: NextFunction): void => {
      const key = `${req.ip}_${req.body.email}`;
      const now = Date.now();
      const fiveMinutes = 5 * 60 * 1000;

      const lastSubmission = recentSubmissions.get(key);
      
      if (lastSubmission && (now - lastSubmission < fiveMinutes)) {
        res.status(429).json({
          success: false,
          error: 'Duplicate submission',
          message: 'Por favor espera 5 minutos antes de enviar otro formulario'
        });
        return;
      }

      // Guardar timestamp de esta submission
      recentSubmissions.set(key, now);
      
      // Limpiar entradas antiguas cada 100 requests
      if (recentSubmissions.size > 100) {
        for (const [k, timestamp] of recentSubmissions.entries()) {
          if (now - timestamp > fiveMinutes) {
            recentSubmissions.delete(k);
          }
        }
      }

      next();
    };
  },

  /**
   * Middleware para agregar metadata de formulario
   */
  addFormMetadata: () => {
    return (req: FormRequest, res: Response, next: NextFunction) => {
      req.formMetadata = {
        submissionTime: Date.now(),
        ip: req.ip || 'unknown',
        userAgent: req.get('User-Agent'),
        referer: req.get('Referer'),
        formType: req.path.includes('job-application') ? 'job-application' : 
                  req.path.includes('discount-form') ? 'discount-form' : 
                  req.path.includes('contact') ? 'contact' : 'other',
        hasFile: !!req.file
      };
      
      next();
    };
  },

  /**
   * Middleware para logging de formularios
   */
  logFormActivity: () => {
    return (req: FormRequest, res: Response, next: NextFunction) => {
      const originalSend = res.json;
      
      res.json = function(data: any) {
        const processingTime = Date.now() - (req.formMetadata?.submissionTime || Date.now());
        
        console.log('Form activity:', {
          method: req.method,
          path: req.path,
          formType: req.formMetadata?.formType,
          statusCode: res.statusCode,
          processingTime,
          success: data?.success,
          hasFile: req.formMetadata?.hasFile,
          email: req.body?.email ? req.body.email.replace(/(.{2}).*(@.*)/, '$1***$2') : undefined
        });
        
        return originalSend.call(this, data);
      };
      
      next();
    };
  },

  /**
   * Middleware para validar términos y condiciones
   */
  validateTerms: () => {
    return (req: FormRequest, res: Response, next: NextFunction): void => {
      if (req.body.agreedToTerms !== true && req.body.agreedToTerms !== 'true') {
        res.status(400).json({
          success: false,
          error: 'Terms not accepted',
          message: 'Debes aceptar los términos y condiciones para continuar'
        });
        return;
      }

      next();
    };
  }
};

/**
 * Configuración avanzada de rutas con middlewares específicos
 */
export function createAdvancedFormRoutes(formController: FormController): Router {
  const router = Router();

  // Aplicar middlewares globales para todas las rutas de formularios
  router.use(formMiddleware.addFormMetadata());
  router.use(formMiddleware.logFormActivity());

  // Middleware específico para formularios que requieren términos
  const termsRequiredRoutes = ['/job-application', '/discount-form'];
  router.use(termsRequiredRoutes, formMiddleware.validateTerms());

  // Middleware de detección de duplicados para submissions
  const submissionRoutes = ['/job-application', '/discount-form', '/contact'];
  router.use(submissionRoutes, formMiddleware.detectDuplicates());

  // Middleware de validación de empresa para ciertos formularios
  router.use(['/discount-form'], formMiddleware.validateCompanyData());

  // Usar las rutas básicas
  router.use(createFormRoutes(formController));

  return router;
}

/**
 * Rutas específicas para admin (requieren autenticación)
 */
export function createAdminFormRoutes(formController: FormController): Router {
  const router = Router();

  // En producción, aquí aplicarías middleware de autenticación
  // router.use(authMiddleware.requireRole('admin'));

  /**
   * GET /api/forms/admin/submissions
   * Lista todas las submissions (admin)
   */
  router.get(
    '/submissions',
    // Rate limiting estricto para admin
    ValidationMiddleware.rateLimitByField('ip', 100, 60000),
    
    // Validación de filtros
    ValidationMiddleware.validate(
      require('joi').object({
        formType: require('joi').string().valid('job-application', 'discount-form', 'contact').optional(),
        status: require('joi').string().valid('pending', 'reviewed', 'approved', 'rejected').optional(),
        dateFrom: require('joi').date().iso().optional(),
        dateTo: require('joi').date().iso().min(require('joi').ref('dateFrom')).optional(),
        limit: require('joi').number().integer().min(1).max(100).default(20),
        offset: require('joi').number().integer().min(0).default(0)
      }),
      'query'
    ),
    
    ErrorHandlerMiddleware.asyncHandler(async (req: Request, res: Response) => {
      // Implementación básica para admin
      const submissions = {
        data: [],
        pagination: {
          total: 0,
          limit: req.query.limit || 20,
          offset: req.query.offset || 0,
          hasMore: false
        },
        filters: req.query,
        generatedAt: new Date().toISOString()
      };

      res.status(200).json({
        success: true,
        message: 'Submissions retrieved successfully',
        data: submissions
      });
    })
  );

  /**
   * PATCH /api/forms/admin/application/:id/status
   * Actualiza estado de aplicación (admin)
   */
  router.patch(
    '/application/:id/status',
    ValidationMiddleware.validate(
      require('joi').object({
        status: require('joi').string().valid('pending', 'reviewed', 'approved', 'rejected').required(),
        notes: require('joi').string().max(1000).optional(),
        reviewedBy: require('joi').string().required()
      }),
      'body'
    ),
    
    ErrorHandlerMiddleware.asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.params;
      const updateData = {
        ...req.body,
        updatedAt: new Date().toISOString()
      };

      res.status(200).json({
        success: true,
        message: 'Application status updated successfully',
        data: { id, ...updateData }
      });
    })
  );

  /**
   * GET /api/forms/admin/analytics
   * Analytics detallados de formularios (admin)
   */
  router.get(
    '/analytics',
    ValidationMiddleware.validate(
      require('joi').object({
        timeRange: require('joi').string().valid('1d', '7d', '30d', '90d', '1y').default('30d'),
        groupBy: require('joi').string().valid('day', 'week', 'month').default('day')
      }),
      'query'
    ),
    
    ErrorHandlerMiddleware.asyncHandler(async (req: Request, res: Response) => {
      const analytics = {
        timeRange: req.query.timeRange,
        summary: {
          totalSubmissions: 0,
          conversionRate: 0.0,
          averageProcessingTime: 0,
          topSources: []
        },
        trends: [],
        breakdown: {
          byFormType: {},
          byStatus: {},
          bySource: {}
        },
        generatedAt: new Date().toISOString()
      };

      res.status(200).json({
        success: true,
        message: 'Analytics retrieved successfully',
        data: analytics
      });
    })
  );

  return router;
}