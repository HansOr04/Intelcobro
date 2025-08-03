// src/infrastructure/web/routes/wheelRoutes.ts

import { Router, Request, Response, NextFunction } from 'express';
import { WheelController } from '../controllers/WheelController';
import { ValidationMiddleware } from '../middlewares/ValidationMiddleware';
import { ErrorHandlerMiddleware } from '../middlewares/ErrorHandlerMiddleware';

/**
 * Extended Request interface for wheel-specific properties
 */
interface WheelRequest extends Request {
  wheelMetadata?: {
    spinTime: number;
    ip: string;
    userAgent?: string | undefined;
    referer?: string | undefined;
    sessionId?: string | undefined;
  };
}

/**
 * Configuración de rutas para la ruleta de descuentos
 */
export function createWheelRoutes(wheelController: WheelController): Router {
  const router = Router();

  // Middleware general para todas las rutas de ruleta
  router.use(ErrorHandlerMiddleware.asyncHandler(() => {}));

  /**
   * POST /api/wheel/spin
   * Gira la ruleta de descuentos
   */
  router.post(
    '/spin',
    // Rate limiting estricto para evitar abuse de la ruleta
    ValidationMiddleware.rateLimitByField('ip', 5, 300000), // 5 giros cada 5 minutos por IP
    ValidationMiddleware.rateLimitByField('sessionId', 3, 300000), // 3 giros cada 5 minutos por sesión
    
    // Validación del request
    ValidationMiddleware.validate(
      require('joi').object({
        sessionId: require('joi').string().pattern(/^[a-zA-Z0-9_-]+$/).optional(),
        userId: require('joi').string().pattern(/^[a-zA-Z0-9_-]+$/).optional(),
        metadata: require('joi').object().optional()
      }),
      'body'
    ),
    
    // Sanitización
    ValidationMiddleware.sanitize('body'),
    
    // Controlador
    ErrorHandlerMiddleware.asyncHandler(
      wheelController.spin.bind(wheelController)
    )
  );

  /**
   * GET /api/wheel/status/:sessionId
   * Obtiene el estado actual de la ruleta para una sesión
   */
  router.get(
    '/status/:sessionId',
    // Rate limiting moderado
    ValidationMiddleware.rateLimitByField('sessionId', 20, 60000), // 20 consultas por minuto
    
    // Validación de sessionId
    ValidationMiddleware.validate(
      require('joi').object({
        sessionId: require('joi').string().pattern(/^[a-zA-Z0-9_-]+$/).required()
      }),
      'params'
    ),
    
    // Controlador
    ErrorHandlerMiddleware.asyncHandler(
      wheelController.getStatus.bind(wheelController)
    )
  );

  /**
   * GET /api/wheel/history/:sessionId
   * Obtiene el historial de giros de una sesión
   */
  router.get(
    '/history/:sessionId',
    // Rate limiting
    ValidationMiddleware.rateLimitByField('sessionId', 15, 60000), // 15 consultas por minuto
    
    // Validación de parámetros
    ValidationMiddleware.validate(
      require('joi').object({
        sessionId: require('joi').string().pattern(/^[a-zA-Z0-9_-]+$/).required()
      }),
      'params'
    ),
    
    // Validación de query parameters
    ValidationMiddleware.validate(
      require('joi').object({
        limit: require('joi').number().integer().min(1).max(50).default(10),
        offset: require('joi').number().integer().min(0).default(0)
      }),
      'query'
    ),
    
    // Controlador
    ErrorHandlerMiddleware.asyncHandler(
      wheelController.getHistory.bind(wheelController)
    )
  );

  /**
   * GET /api/wheel/config
   * Obtiene la configuración de la ruleta
   */
  router.get(
    '/config',
    // Rate limiting suave para configuración
    ValidationMiddleware.rateLimitByField('ip', 30, 60000),
    
    // Cache headers (configuración no cambia frecuentemente)
    (req: Request, res: Response, next: NextFunction) => {
      res.set('Cache-Control', 'public, max-age=3600'); // 1 hora
      next();
    },
    
    // Controlador
    ErrorHandlerMiddleware.asyncHandler(
      wheelController.getConfig.bind(wheelController)
    )
  );

  /**
   * POST /api/wheel/validate
   * Valida un resultado de ruleta o código de descuento
   */
  router.post(
    '/validate',
    // Rate limiting para validaciones
    ValidationMiddleware.rateLimitByField('ip', 30, 60000),
    
    // Validación del request
    ValidationMiddleware.validate(
      require('joi').object({
        resultId: require('joi').string().pattern(/^wheel_result_[a-zA-Z0-9]+$/).optional(),
        discountCode: require('joi').string().pattern(/^WHEEL\d{4}$/).optional()
      }).or('resultId', 'discountCode'),
      'body'
    ),
    
    // Controlador
    ErrorHandlerMiddleware.asyncHandler(
      wheelController.validateResult.bind(wheelController)
    )
  );

  /**
   * GET /api/wheel/stats
   * Obtiene estadísticas de la ruleta
   */
  router.get(
    '/stats',
    // Rate limiting para estadísticas
    ValidationMiddleware.rateLimitByField('ip', 10, 60000), // 10 consultas por minuto
    
    // Validación de query parameters
    ValidationMiddleware.validate(
      require('joi').object({
        timeRange: require('joi').string().valid('1h', '24h', '7d', '30d', '90d').default('24h'),
        detailed: require('joi').boolean().default(false)
      }),
      'query'
    ),
    
    // En producción, aquí podrías requerir autenticación para stats detalladas
    // authMiddleware.requireRole('admin'),
    
    // Controlador
    ErrorHandlerMiddleware.asyncHandler(
      wheelController.getStats.bind(wheelController)
    )
  );

  /**
   * GET /api/wheel/leaderboard
   * Obtiene leaderboard de descuentos ganados
   */
  router.get(
    '/leaderboard',
    // Rate limiting
    ValidationMiddleware.rateLimitByField('ip', 20, 60000),
    
    // Validación de query parameters
    ValidationMiddleware.validate(
      require('joi').object({
        timeRange: require('joi').string().valid('24h', '7d', '30d', '90d').default('7d'),
        limit: require('joi').number().integer().min(5).max(50).default(10)
      }),
      'query'
    ),
    
    // Cache headers para leaderboard
    (req: Request, res: Response, next: NextFunction) => {
      res.set('Cache-Control', 'public, max-age=300'); // 5 minutos
      next();
    },
    
    // Controlador
    ErrorHandlerMiddleware.asyncHandler(
      wheelController.getLeaderboard.bind(wheelController)
    )
  );

  /**
   * GET /api/wheel/daily-special
   * Obtiene el premio especial del día
   */
  router.get(
    '/daily-special',
    // Rate limiting suave
    ValidationMiddleware.rateLimitByField('ip', 50, 60000),
    
    // Cache headers (cambia diariamente)
    (req: Request, res: Response, next: NextFunction) => {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      
      const secondsUntilTomorrow = Math.floor((tomorrow.getTime() - now.getTime()) / 1000);
      res.set('Cache-Control', `public, max-age=${secondsUntilTomorrow}`);
      next();
    },
    
    // Controlador
    ErrorHandlerMiddleware.asyncHandler(
      wheelController.getDailySpecial.bind(wheelController)
    )
  );

  /**
   * POST /api/wheel/reset/:sessionId
   * Reinicia una sesión de ruleta (admin)
   */
  router.post(
    '/reset/:sessionId',
    // Rate limiting estricto para resets
    ValidationMiddleware.rateLimitByField('ip', 5, 3600000), // 5 resets por hora
    
    // Validación de parámetros
    ValidationMiddleware.validate(
      require('joi').object({
        sessionId: require('joi').string().pattern(/^[a-zA-Z0-9_-]+$/).required()
      }),
      'params'
    ),
    
    // Validación del body
    ValidationMiddleware.validate(
      require('joi').object({
        reason: require('joi').string().min(5).max(200).required()
      }),
      'body'
    ),
    
    // En producción, requiere autenticación de admin
    // authMiddleware.requireRole('admin'),
    
    // Controlador
    ErrorHandlerMiddleware.asyncHandler(
      wheelController.resetSession.bind(wheelController)
    )
  );

  /**
   * GET /api/wheel/export
   * Exporta datos de la ruleta (admin)
   */
  router.get(
    '/export',
    // Rate limiting muy estricto para exportaciones
    ValidationMiddleware.rateLimitByField('ip', 2, 3600000), // 2 exportaciones por hora
    
    // Validación de query parameters
    ValidationMiddleware.validate(
      require('joi').object({
        format: require('joi').string().valid('json', 'csv').default('json'),
        dateFrom: require('joi').date().iso().optional(),
        dateTo: require('joi').date().iso().min(require('joi').ref('dateFrom')).optional()
      }),
      'query'
    ),
    
    // En producción, requiere autenticación de admin
    // authMiddleware.requireRole('admin'),
    
    // Controlador
    ErrorHandlerMiddleware.asyncHandler(
      wheelController.exportData.bind(wheelController)
    )
  );

  /**
   * POST /api/wheel/ab-test
   * Configura A/B testing para la ruleta (admin)
   */
  router.post(
    '/ab-test',
    // Rate limiting para A/B tests
    ValidationMiddleware.rateLimitByField('ip', 3, 3600000), // 3 configuraciones por hora
    
    // Validación de configuración de A/B test
    ValidationMiddleware.validate(
      require('joi').object({
        testName: require('joi').string().min(3).max(50).required(),
        variants: require('joi').array().items(
          require('joi').object({
            name: require('joi').string().required(),
            config: require('joi').object().required(),
            weight: require('joi').number().min(0).max(100).required()
          })
        ).min(2).max(5).required(),
        trafficSplit: require('joi').object().pattern(
          require('joi').string(),
          require('joi').number().min(0).max(100)
        ).optional(),
        startDate: require('joi').date().iso().optional(),
        endDate: require('joi').date().iso().min(require('joi').ref('startDate')).optional()
      }),
      'body'
    ),
    
    // En producción, requiere autenticación de admin
    // authMiddleware.requireRole('admin'),
    
    // Controlador
    ErrorHandlerMiddleware.asyncHandler(
      wheelController.configureABTest.bind(wheelController)
    )
  );

  /**
   * GET /api/wheel/health
   * Health check específico de la ruleta
   */
  router.get(
    '/health',
    // Sin rate limiting para health checks
    
    // Validación opcional de query parameters
    ValidationMiddleware.validate(
      require('joi').object({
        detailed: require('joi').boolean().default(false)
      }),
      'query'
    ),
    
    // Controlador
    ErrorHandlerMiddleware.asyncHandler(
      wheelController.getHealth.bind(wheelController)
    )
  );

  // Middleware de manejo de errores específico para ruleta
  router.use((error: any, req: WheelRequest, res: Response, next: NextFunction) => {
    console.error('Wheel route error:', {
      path: req.path,
      method: req.method,
      sessionId: req.params.sessionId || req.body.sessionId,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
    
    next(error);
  });

  return router;
}

/**
 * Middleware específico para rutas de ruleta
 */
export const wheelMiddleware = {
  /**
   * Middleware para verificar cooldown de sesión
   */
  checkCooldown: () => {
    const sessionCooldowns = new Map<string, number>();
    
    return (req: WheelRequest, res: Response, next: NextFunction) => {
      // Solo aplicar a rutas de spin
      if (!req.path.includes('/spin')) {
        return next();
      }

      const sessionId = req.body.sessionId || req.params.sessionId;
      if (!sessionId) {
        return next();
      }

      const now = Date.now();
      const lastSpin = sessionCooldowns.get(sessionId);
      const cooldownMs = 5 * 60 * 1000; // 5 minutos

      if (lastSpin && (now - lastSpin < cooldownMs)) {
        const remainingMs = cooldownMs - (now - lastSpin);
        const remainingMinutes = Math.ceil(remainingMs / 60000);

        return res.status(429).json({
          success: false,
          error: 'Cooldown active',
          message: `Debes esperar ${remainingMinutes} minuto(s) antes de girar nuevamente`,
          data: {
            remainingMs,
            nextSpinAvailableAt: new Date(lastSpin + cooldownMs).toISOString()
          }
        });
      }

      // Actualizar timestamp del último spin
      sessionCooldowns.set(sessionId, now);

      // Limpiar entradas antiguas
      if (sessionCooldowns.size > 1000) {
        for (const [key, timestamp] of sessionCooldowns.entries()) {
          if (now - timestamp > cooldownMs) {
            sessionCooldowns.delete(key);
          }
        }
      }

      next();
    };
  },

  /**
   * Middleware para limitar spins por sesión
   */
  checkSpinLimit: () => {
    const sessionSpins = new Map<string, { count: number; resetTime: number }>();
    
    return (req: WheelRequest, res: Response, next: NextFunction) => {
      if (!req.path.includes('/spin')) {
        return next();
      }

      const sessionId = req.body.sessionId || req.params.sessionId;
      if (!sessionId) {
        return next();
      }

      const now = Date.now();
      const dayMs = 24 * 60 * 60 * 1000;
      const maxSpinsPerDay = 3;

      const sessionData = sessionSpins.get(sessionId);

      if (sessionData) {
        // Reset contador si ha pasado un día
        if (now > sessionData.resetTime) {
          sessionSpins.set(sessionId, { count: 0, resetTime: now + dayMs });
        } else if (sessionData.count >= maxSpinsPerDay) {
          const hoursUntilReset = Math.ceil((sessionData.resetTime - now) / (60 * 60 * 1000));

          return res.status(429).json({
            success: false,
            error: 'Daily limit exceeded',
            message: `Has alcanzado el límite diario de ${maxSpinsPerDay} giros`,
            data: {
              spinsUsed: sessionData.count,
              maxSpins: maxSpinsPerDay,
              resetIn: `${hoursUntilReset} horas`,
              resetTime: new Date(sessionData.resetTime).toISOString()
            }
          });
        }
      } else {
        sessionSpins.set(sessionId, { count: 0, resetTime: now + dayMs });
      }

      next();
    };
  },

  /**
   * Middleware para agregar metadata de ruleta
   */
  addWheelMetadata: () => {
    return (req: WheelRequest, res: Response, next: NextFunction) => {
      req.wheelMetadata = {
        spinTime: Date.now(),
        ip: req.ip || 'unknown',
        userAgent: req.get('User-Agent'),
        referer: req.get('Referer'),
        sessionId: req.body.sessionId || req.params.sessionId
      };
      
      next();
    };
  },

  /**
   * Middleware para logging específico de ruleta
   */
  logWheelActivity: () => {
    return (req: WheelRequest, res: Response, next: NextFunction) => {
      const originalSend = res.json;
      
      res.json = function(data: any) {
        const processingTime = Date.now() - (req.wheelMetadata?.spinTime || Date.now());
        
        console.log('Wheel activity:', {
          method: req.method,
          path: req.path,
          sessionId: req.wheelMetadata?.sessionId,
          statusCode: res.statusCode,
          processingTime,
          success: data?.success,
          isWinner: data?.data?.isWinner,
          discountPercentage: data?.data?.discountPercentage
        });
        
        return originalSend.call(this, data);
      };
      
      next();
    };
  }
};

/**
 * Configuración avanzada de rutas con middlewares específicos
 */
export function createAdvancedWheelRoutes(wheelController: WheelController): Router {
  const router = Router();

  // Aplicar middlewares globales para todas las rutas de ruleta
  router.use(wheelMiddleware.addWheelMetadata());
  router.use(wheelMiddleware.logWheelActivity());

  // Middlewares específicos para spin
  router.use('/spin', wheelMiddleware.checkCooldown());
  router.use('/spin', wheelMiddleware.checkSpinLimit());

  // Usar las rutas básicas
  router.use(createWheelRoutes(wheelController));

  return router;
}

/**
 * Rutas específicas para analytics de ruleta (admin)
 */
export function createWheelAnalyticsRoutes(wheelController: WheelController): Router {
  const router = Router();

  // En producción, aplicar middleware de autenticación de admin
  // router.use(authMiddleware.requireRole('admin'));

  /**
   * GET /api/wheel/analytics/conversion
   * Analytics de conversión de ruleta a formularios
   */
  router.get(
    '/conversion',
    ValidationMiddleware.validate(
      require('joi').object({
        timeRange: require('joi').string().valid('1d', '7d', '30d', '90d').default('7d'),
        segmentBy: require('joi').string().valid('section', 'discount', 'day', 'hour').default('section')
      }),
      'query'
    ),
    
    ErrorHandlerMiddleware.asyncHandler(async (req: Request, res: Response) => {
      const conversionData = {
        timeRange: req.query.timeRange,
        overall: {
          totalSpins: 0,
          totalWins: 0,
          totalFormSubmissions: 0,
          conversionRate: 0.0,
          averageDiscount: 0.0
        },
        segments: [],
        trends: [],
        generatedAt: new Date().toISOString()
      };

      res.status(200).json({
        success: true,
        message: 'Conversion analytics retrieved successfully',
        data: conversionData
      });
    })
  );

  /**
   * GET /api/wheel/analytics/performance
   * Analytics de performance de la ruleta
   */
  router.get(
    '/performance',
    ErrorHandlerMiddleware.asyncHandler(async (req: Request, res: Response) => {
      const performanceData = {
        responseTime: {
          average: 0,
          p50: 0,
          p95: 0,
          p99: 0
        },
        errorRate: 0.0,
        uptime: 99.9,
        throughput: 0,
        cacheHitRate: 0.0,
        generatedAt: new Date().toISOString()
      };

      res.status(200).json({
        success: true,
        message: 'Performance analytics retrieved successfully',
        data: performanceData
      });
    })
  );

  return router;
}