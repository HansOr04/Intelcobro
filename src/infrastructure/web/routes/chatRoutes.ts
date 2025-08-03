// src/infrastructure/web/routes/chatRoutes.ts

import { Router } from 'express';
import { ChatController } from '../controllers/ChatController';
import { ValidationMiddleware } from '../middlewares/ValidationMiddleware';
import { FileUploadMiddleware } from '../middlewares/FileUploadMiddleware';
import { ChatValidator } from '../validators/ChatValidator';
import { ErrorHandlerMiddleware } from '../middlewares/ErrorHandlerMiddleware';

/**
 * Configuración de rutas para el chat
 */
export function createChatRoutes(chatController: ChatController): Router {
  const router = Router();

  // Middleware general para todas las rutas de chat
  router.use(ErrorHandlerMiddleware.asyncHandler(() => {}));

  /**
   * POST /api/chat/message
   * Envía un mensaje al chat y obtiene respuesta de IA
   */
  router.post(
    '/message',
    // Rate limiting específico para mensajes
    ValidationMiddleware.rateLimitByField('sessionId', 30, 60000), // 30 msgs por minuto por sesión
    
    // Validación de entrada
    ValidationMiddleware.validate(ChatValidator.sendMessageSchema, 'body'),
    
    // Validación anti-XSS
    ValidationMiddleware.validateXSS(),
    
    // Sanitización
    ValidationMiddleware.sanitize('body'),
    
    // Controlador
    ErrorHandlerMiddleware.asyncHandler(
      chatController.sendMessage.bind(chatController)
    )
  );

  /**
   * POST /api/chat/message/voice
   * Envía mensaje de voz al chat
   */
  router.post(
    '/message/voice',
    // Rate limiting más estricto para voz
    ValidationMiddleware.rateLimitByField('sessionId', 10, 60000), // 10 msgs de voz por minuto
    
    // Subida de archivo de audio
    FileUploadMiddleware.uploadAudio(),
    
    // Validación del cuerpo
    ValidationMiddleware.validate(ChatValidator.sendMessageSchema, 'body'),
    
    // Controlador
    ErrorHandlerMiddleware.asyncHandler(
      chatController.sendMessage.bind(chatController)
    )
  );

  /**
   * GET /api/chat/history/:sessionId
   * Obtiene historial de mensajes de una sesión
   */
  router.get(
    '/history/:sessionId',
    // Validación de parámetros
    ValidationMiddleware.validate(ChatValidator.sessionParamsSchema, 'params'),
    
    // Validación de query parameters
    ValidationMiddleware.validate(ChatValidator.getHistorySchema, 'query'),
    
    // Controlador
    ErrorHandlerMiddleware.asyncHandler(
      chatController.getHistory.bind(chatController)
    )
  );

  /**
   * DELETE /api/chat/history/:sessionId
   * Limpia el historial de una sesión
   */
  router.delete(
    '/history/:sessionId',
    // Validación de parámetros
    ValidationMiddleware.validate(ChatValidator.sessionParamsSchema, 'params'),
    
    // Rate limiting para evitar abuse
    ValidationMiddleware.rateLimitByField('sessionId', 3, 300000), // 3 limpiezas cada 5 minutos
    
    // Controlador
    ErrorHandlerMiddleware.asyncHandler(
      chatController.clearHistory.bind(chatController)
    )
  );

  /**
   * GET /api/chat/stats/:sessionId
   * Obtiene estadísticas de la sesión
   */
  router.get(
    '/stats/:sessionId',
    // Validación de parámetros
    ValidationMiddleware.validate(ChatValidator.sessionParamsSchema, 'params'),
    
    // Controlador
    ErrorHandlerMiddleware.asyncHandler(
      chatController.getSessionStats.bind(chatController)
    )
  );

  /**
   * POST /api/chat/configure/:sessionId
   * Configura parámetros de la sesión de chat
   */
  router.post(
    '/configure/:sessionId',
    // Validación de parámetros
    ValidationMiddleware.validate(ChatValidator.sessionParamsSchema, 'params'),
    
    // Validación de configuración
    ValidationMiddleware.validate(ChatValidator.chatConfigSchema, 'body'),
    
    // Rate limiting
    ValidationMiddleware.rateLimitByField('sessionId', 5, 300000), // 5 configuraciones cada 5 minutos
    
    // Controlador
    ErrorHandlerMiddleware.asyncHandler(
      chatController.configureSession.bind(chatController)
    )
  );

  /**
   * GET /api/chat/search/:sessionId
   * Busca en el historial de mensajes
   */
  router.get(
    '/search/:sessionId',
    // Validación de parámetros y query
    ValidationMiddleware.validate(ChatValidator.sessionParamsSchema, 'params'),
    ValidationMiddleware.validate(ChatValidator.searchHistorySchema, 'query'),
    
    // Controlador
    ErrorHandlerMiddleware.asyncHandler(
      chatController.searchHistory.bind(chatController)
    )
  );

  /**
   * GET /api/chat/export/:sessionId
   * Exporta historial de chat
   */
  router.get(
    '/export/:sessionId',
    // Validación de parámetros
    ValidationMiddleware.validate(ChatValidator.sessionParamsSchema, 'params'),
    
    // Rate limiting estricto para exportaciones
    ValidationMiddleware.rateLimitByField('sessionId', 2, 3600000), // 2 exportaciones por hora
    
    // Controlador
    ErrorHandlerMiddleware.asyncHandler(
      chatController.exportHistory.bind(chatController)
    )
  );

  /**
   * POST /api/chat/feedback
   * Envía feedback sobre una respuesta del chat
   */
  router.post(
    '/feedback',
    // Validación de entrada
    ValidationMiddleware.validate(
      ChatValidator.sendMessageSchema.keys({
        messageId: ChatValidator.sendMessageSchema.extract('sessionId').required(),
        rating: require('joi').number().integer().min(1).max(5).required(),
        feedback: require('joi').string().max(1000).optional(),
        category: require('joi').string().valid('helpful', 'unhelpful', 'inappropriate', 'inaccurate', 'other').optional()
      }),
      'body'
    ),
    
    // Rate limiting
    ValidationMiddleware.rateLimitByField('messageId', 1, 300000), // 1 feedback por mensaje cada 5 minutos
    
    // Controlador
    ErrorHandlerMiddleware.asyncHandler(
      chatController.submitFeedback.bind(chatController)
    )
  );

  /**
   * POST /api/chat/regenerate/:messageId
   * Regenera respuesta de un mensaje
   */
  router.post(
    '/regenerate/:messageId',
    // Validación de entrada
    ValidationMiddleware.validate(
      require('joi').object({
        sessionId: ChatValidator.sendMessageSchema.extract('sessionId').required()
      }),
      'body'
    ),
    
    // Rate limiting
    ValidationMiddleware.rateLimitByField('messageId', 3, 600000), // 3 regeneraciones por mensaje cada 10 minutos
    
    // Controlador
    ErrorHandlerMiddleware.asyncHandler(
      chatController.regenerateResponse.bind(chatController)
    )
  );

  /**
   * GET /api/chat/suggestions/:sessionId
   * Obtiene sugerencias de respuesta
   */
  router.get(
    '/suggestions/:sessionId',
    // Validación de parámetros
    ValidationMiddleware.validate(ChatValidator.sessionParamsSchema, 'params'),
    
    // Rate limiting moderado
    ValidationMiddleware.rateLimitByField('sessionId', 20, 60000), // 20 requests por minuto
    
    // Controlador
    ErrorHandlerMiddleware.asyncHandler(
      chatController.getSuggestions.bind(chatController)
    )
  );

  /**
   * GET /api/chat/health
   * Health check específico del chat
   */
  router.get(
    '/health',
    // Sin rate limiting para health checks
    
    // Validación opcional de query parameters
    ValidationMiddleware.validate(ChatValidator.healthCheckSchema, 'query'),
    
    // Controlador
    ErrorHandlerMiddleware.asyncHandler(
      chatController.getHealth.bind(chatController)
    )
  );

  /**
   * GET /api/chat/metrics
   * Obtiene métricas de performance del chat
   */
  router.get(
    '/metrics',
    // Rate limiting para métricas
    ValidationMiddleware.rateLimitByField('ip', 10, 60000),
    
    // Controlador
    ErrorHandlerMiddleware.asyncHandler(
      chatController.getMetrics.bind(chatController)
    )
  );

  // Middleware de manejo de errores específico para rutas de chat
  router.use((error: any, req: any, res: any, next: any) => {
    // Log específico para errores de chat
    console.error('Chat route error:', {
      path: req.path,
      method: req.method,
      sessionId: req.params.sessionId || req.body.sessionId,
      error: error.message
    });
    
    // Pasar al manejador global
    next(error);
  });

  return router;
}

/**
 * Middleware específico para rutas de chat
 */
export const chatMiddleware = {
  /**
   * Middleware para verificar que la sesión existe y es válida
   */
  validateSession: () => {
    return async (req: any, res: any, next: any) => {
      const sessionId = req.params.sessionId || req.body.sessionId;
      
      if (!sessionId) {
        return res.status(400).json({
          success: false,
          error: 'Session ID requerido',
          message: 'Se requiere un ID de sesión válido'
        });
      }

      // En una implementación real, verificarías que la sesión existe
      // Por ahora, solo validamos el formato
      if (!/^[a-zA-Z0-9_-]+$/.test(sessionId)) {
        return res.status(400).json({
          success: false,
          error: 'Session ID inválido',
          message: 'El formato del ID de sesión no es válido'
        });
      }

      next();
    };
  },

  /**
   * Middleware para agregar metadata de chat al request
   */
  addChatMetadata: () => {
    return (req: any, res: any, next: any) => {
      req.chatMetadata = {
        startTime: Date.now(),
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        referer: req.get('Referer'),
        sessionId: req.params.sessionId || req.body.sessionId
      };
      
      next();
    };
  },

  /**
   * Middleware para logging específico de chat
   */
  logChatActivity: () => {
    return (req: any, res: any, next: any) => {
      const originalSend = res.json;
      
      res.json = function(data: any) {
        const processingTime = Date.now() - (req.chatMetadata?.startTime || Date.now());
        
        console.log('Chat activity:', {
          method: req.method,
          path: req.path,
          sessionId: req.chatMetadata?.sessionId,
          statusCode: res.statusCode,
          processingTime,
          success: data?.success
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
export function createAdvancedChatRoutes(chatController: ChatController): Router {
  const router = Router();

  // Aplicar middlewares globales para todas las rutas de chat
  router.use(chatMiddleware.addChatMetadata());
  router.use(chatMiddleware.logChatActivity());

  // Usar las rutas básicas
  router.use(createChatRoutes(chatController));

  return router;
}