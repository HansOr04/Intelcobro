// src/infrastructure/web/middlewares/ErrorHandlerMiddleware.ts

import { Request, Response, NextFunction } from 'express';
import { ValidationException } from '../../../application/exceptions/ValidationException';
import { AIServiceException, AIServiceErrorType } from '../../../application/exceptions/AIServiceException';
import { EmailServiceException, EmailServiceErrorType } from '../../../application/exceptions/EmailServiceException';
import { logger } from '../../../shared/utils/Logger';

/**
 * Extended Request interface to include optional id property
 */
interface ExtendedRequest extends Request {
  id?: string;
}

/**
 * Interface para errores customizados
 */
export interface CustomError extends Error {
  statusCode?: number;
  code?: string;
  details?: any;
  context?: Record<string, any>;
}

/**
 * Interface para respuesta de error estandarizada
 */
export interface ErrorResponse {
  success: false;
  error: string;
  message: string;
  code?: string | undefined;
  details?: any;
  timestamp: string;
  path: string;
  method: string;
  requestId?: string | undefined;
}

/**
 * Middleware para manejo centralizado de errores
 */
export class ErrorHandlerMiddleware {
  /**
   * Middleware principal de manejo de errores
   */
  static handle() {
    return (error: any, req: ExtendedRequest, res: Response, next: NextFunction): void => {
      // Si la respuesta ya fue enviada, delegar a Express
      if (res.headersSent) {
        return next(error);
      }

      try {
        const errorResponse = ErrorHandlerMiddleware.processError(error, req);
        
        // Log del error
        ErrorHandlerMiddleware.logError(error, req, errorResponse);

        // Enviar respuesta
        res.status(errorResponse.statusCode || 500).json({
          success: false,
          error: errorResponse.error,
          message: errorResponse.message,
          code: errorResponse.code,
          details: errorResponse.details,
          timestamp: errorResponse.timestamp,
          path: errorResponse.path,
          method: errorResponse.method,
          requestId: errorResponse.requestId
        });

      } catch (handlingError) {
        // Error al manejar el error original
        logger.error('Error in error handler', undefined, {
          originalError: error?.message || 'Unknown',
          handlingError: handlingError instanceof Error ? handlingError.message : 'Unknown',
          path: req.path,
          method: req.method
        });

        // Respuesta de emergencia
        res.status(500).json({
          success: false,
          error: 'Internal Server Error',
          message: 'Ha ocurrido un error interno del servidor',
          timestamp: new Date().toISOString(),
          path: req.path,
          method: req.method
        });
      }
    };
  }

  /**
   * Middleware para errores 404 (Not Found)
   */
  static notFound() {
    return (req: Request, res: Response, next: NextFunction): void => {
      const error = new Error(`Ruta no encontrada: ${req.originalUrl}`);
      (error as CustomError).statusCode = 404;
      (error as CustomError).code = 'ROUTE_NOT_FOUND';
      
      next(error);
    };
  }

  /**
   * Middleware para timeout de requests
   */
  static timeout(timeoutMs: number = 30000) {
    return (req: Request, res: Response, next: NextFunction): void => {
      const timer = setTimeout(() => {
        if (!res.headersSent) {
          const error = new Error('Request timeout');
          (error as CustomError).statusCode = 408;
          (error as CustomError).code = 'REQUEST_TIMEOUT';
          
          next(error);
        }
      }, timeoutMs);

      // Limpiar timer cuando la respuesta termine
      res.on('finish', () => clearTimeout(timer));
      res.on('close', () => clearTimeout(timer));

      next();
    };
  }

  /**
   * Middleware para capturar errores no manejados
   */
  static catchUnhandled() {
    process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
      logger.error('Unhandled Promise Rejection', undefined, {
        reason: reason?.message || reason,
        stack: reason?.stack,
        promise: promise.toString()
      });

      // En producción, podrías querer cerrar el servidor gracefully
      if (process.env.NODE_ENV === 'production') {
        process.exit(1);
      }
    });

    process.on('uncaughtException', (error: Error) => {
      logger.error('Uncaught Exception', error, {
        message: error.message,
        stack: error.stack,
        name: error.name
      });

      // Cerrar servidor gracefully
      process.exit(1);
    });
  }

  /**
   * Procesa y clasifica errores
   */
  private static processError(error: any, req: ExtendedRequest): ErrorResponse & { statusCode: number } {
    const requestId = (req.headers['x-request-id'] as string) || req.id;
    
    const baseResponse = {
      success: false as const,
      timestamp: new Date().toISOString(),
      path: req.path,
      method: req.method,
      ...(requestId && { requestId })
    };

    // Errores de validación
    if (error instanceof ValidationException) {
      return {
        ...baseResponse,
        statusCode: 400,
        error: 'Validation Error',
        message: error.message,
        ...(error.errors && { details: error.errors }),
        ...(typeof 'VALIDATION_FAILED' === 'string' && { code: 'VALIDATION_FAILED' })
      };
    }

    // Errores de servicio de IA
    if (error instanceof AIServiceException) {
      return {
        ...baseResponse,
        statusCode: ErrorHandlerMiddleware.getAIServiceStatusCode(error),
        error: 'AI Service Error',
        message: error.message,
        ...(error.errorType && { code: error.errorType }),
        ...(process.env.NODE_ENV === 'development' && error.context && { details: error.context })
      };
    }

    // Errores de servicio de email
    if (error instanceof EmailServiceException) {
      return {
        ...baseResponse,
        statusCode: ErrorHandlerMiddleware.getEmailServiceStatusCode(error),
        error: 'Email Service Error',
        message: error.message,
        ...(error.errorType && { code: error.errorType }),
        ...(process.env.NODE_ENV === 'development' && error.context && { details: error.context })
      };
    }

    // Errores HTTP conocidos
    if (error.statusCode || error.status) {
      const statusCode = error.statusCode || error.status;
      return {
        ...baseResponse,
        statusCode,
        error: ErrorHandlerMiddleware.getErrorName(statusCode),
        message: error.message || ErrorHandlerMiddleware.getDefaultMessage(statusCode),
        ...(error.code && { code: error.code }),
        ...(!error.code && { code: `HTTP_${statusCode}` }),
        ...(process.env.NODE_ENV === 'development' && error.details && { details: error.details })
      };
    }

    // Errores de base de datos (si se implementa en el futuro)
    if (error.name === 'MongoError' || error.name === 'SequelizeError') {
      return {
        ...baseResponse,
        statusCode: 500,
        error: 'Database Error',
        message: 'Error en la base de datos',
        code: 'DATABASE_ERROR',
        ...(process.env.NODE_ENV === 'development' && error.message && { details: error.message })
      };
    }

    // Errores de JWT (si se implementa en el futuro)
    if (error.name === 'JsonWebTokenError') {
      return {
        ...baseResponse,
        statusCode: 401,
        error: 'Authentication Error',
        message: 'Token de autenticación inválido',
        code: 'INVALID_TOKEN'
      };
    }

    if (error.name === 'TokenExpiredError') {
      return {
        ...baseResponse,
        statusCode: 401,
        error: 'Authentication Error',
        message: 'Token de autenticación expirado',
        code: 'EXPIRED_TOKEN'
      };
    }

    // Errores de multer (subida de archivos)
    if (error.code === 'LIMIT_FILE_SIZE') {
      return {
        ...baseResponse,
        statusCode: 413,
        error: 'File Too Large',
        message: 'El archivo es demasiado grande',
        code: 'FILE_TOO_LARGE',
        details: { maxSize: '5MB' }
      };
    }

    if (error.code === 'LIMIT_FILE_COUNT') {
      return {
        ...baseResponse,
        statusCode: 400,
        error: 'Too Many Files',
        message: 'Demasiados archivos',
        code: 'TOO_MANY_FILES'
      };
    }

    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return {
        ...baseResponse,
        statusCode: 400,
        error: 'Unexpected File',
        message: 'Archivo no esperado',
        code: 'UNEXPECTED_FILE'
      };
    }

    // Errores de sintaxis JSON
    if (error instanceof SyntaxError && 'body' in error) {
      return {
        ...baseResponse,
        statusCode: 400,
        error: 'Bad Request',
        message: 'JSON inválido en el cuerpo de la solicitud',
        code: 'INVALID_JSON'
      };
    }

    // Errores de rate limiting
    if (error.type === 'entity.too.large') {
      return {
        ...baseResponse,
        statusCode: 413,
        error: 'Payload Too Large',
        message: 'El cuerpo de la solicitud es demasiado grande',
        code: 'PAYLOAD_TOO_LARGE'
      };
    }

    // Error genérico
    const genericDetails = process.env.NODE_ENV === 'development' ? {
      name: error.name,
      stack: error.stack
    } : undefined;

    return {
      ...baseResponse,
      statusCode: 500,
      error: 'Internal Server Error',
      message: process.env.NODE_ENV === 'development' 
        ? error.message || 'Ha ocurrido un error interno' 
        : 'Ha ocurrido un error interno del servidor',
      code: 'INTERNAL_ERROR',
      ...(genericDetails && { details: genericDetails })
    };
  }

  /**
   * Determina el código de estado HTTP para errores de AI Service
   */
  private static getAIServiceStatusCode(error: AIServiceException): number {
    switch (error.errorType) {
      case AIServiceErrorType.API_RATE_LIMIT:
        return 429;
      case AIServiceErrorType.API_QUOTA_EXCEEDED:
        return 402; // Payment Required
      case AIServiceErrorType.INVALID_API_KEY:
        return 401;
      case AIServiceErrorType.MODEL_NOT_AVAILABLE:
      case AIServiceErrorType.SERVICE_UNAVAILABLE:
        return 503;
      case AIServiceErrorType.TOKEN_LIMIT_EXCEEDED:
      case AIServiceErrorType.INVALID_REQUEST:
        return 400;
      case AIServiceErrorType.CONTENT_FILTERED:
        return 422; // Unprocessable Entity
      default:
        return 500;
    }
  }

  /**
   * Determina el código de estado HTTP para errores de Email Service
   */
  private static getEmailServiceStatusCode(error: EmailServiceException): number {
    switch (error.errorType) {
      case EmailServiceErrorType.API_RATE_LIMIT:
        return 429;
      case EmailServiceErrorType.QUOTA_EXCEEDED:
        return 402;
      case EmailServiceErrorType.INVALID_API_KEY:
        return 401;
      case EmailServiceErrorType.INVALID_RECIPIENT:
      case EmailServiceErrorType.INVALID_EMAIL_ADDRESS:
        return 400;
      case EmailServiceErrorType.TEMPLATE_NOT_FOUND:
        return 404;
      case EmailServiceErrorType.SERVICE_UNAVAILABLE:
        return 503;
      default:
        return 500;
    }
  }

  /**
   * Obtiene nombre del error basado en código de estado
   */
  private static getErrorName(statusCode: number): string {
    const errorNames: Record<number, string> = {
      400: 'Bad Request',
      401: 'Unauthorized',
      402: 'Payment Required',
      403: 'Forbidden',
      404: 'Not Found',
      405: 'Method Not Allowed',
      408: 'Request Timeout',
      409: 'Conflict',
      410: 'Gone',
      413: 'Payload Too Large',
      415: 'Unsupported Media Type',
      422: 'Unprocessable Entity',
      429: 'Too Many Requests',
      500: 'Internal Server Error',
      501: 'Not Implemented',
      502: 'Bad Gateway',
      503: 'Service Unavailable',
      504: 'Gateway Timeout'
    };

    return errorNames[statusCode] || 'Unknown Error';
  }

  /**
   * Obtiene mensaje por defecto basado en código de estado
   */
  private static getDefaultMessage(statusCode: number): string {
    const defaultMessages: Record<number, string> = {
      400: 'La solicitud contiene datos inválidos',
      401: 'Se requiere autenticación',
      402: 'Se requiere pago',
      403: 'Acceso denegado',
      404: 'Recurso no encontrado',
      405: 'Método no permitido',
      408: 'Tiempo de espera agotado',
      409: 'Conflicto con el estado actual del recurso',
      410: 'El recurso ya no está disponible',
      413: 'El contenido de la solicitud es demasiado grande',
      415: 'Tipo de contenido no soportado',
      422: 'Los datos no pueden ser procesados',
      429: 'Demasiadas solicitudes',
      500: 'Error interno del servidor',
      501: 'Funcionalidad no implementada',
      502: 'Error de gateway',
      503: 'Servicio no disponible',
      504: 'Timeout de gateway'
    };

    return defaultMessages[statusCode] || 'Ha ocurrido un error';
  }

  /**
   * Registra el error en los logs
   */
  private static logError(error: any, req: ExtendedRequest, errorResponse: ErrorResponse & { statusCode: number }): void {
    const logData = {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: error.code
      },
      request: {
        method: req.method,
        url: req.originalUrl,
        path: req.path,
        query: req.query,
        params: req.params,
        headers: {
          'user-agent': req.get('User-Agent'),
          'content-type': req.get('Content-Type'),
          'x-forwarded-for': req.get('X-Forwarded-For'),
          'referer': req.get('Referer')
        },
        ip: req.ip,
        body: req.method !== 'GET' ? ErrorHandlerMiddleware.sanitizeLogData(req.body) : undefined
      },
      response: {
        statusCode: errorResponse.statusCode,
        error: errorResponse.error,
        code: errorResponse.code
      },
      timestamp: errorResponse.timestamp,
      requestId: errorResponse.requestId
    };

    // Determinar nivel de log basado en código de estado
    if (errorResponse.statusCode >= 500) {
      logger.error('Server Error', undefined, logData);
    } else if (errorResponse.statusCode >= 400) {
      logger.warn('Client Error', logData);
    } else {
      logger.info('Request Error', logData);
    }
  }

  /**
   * Sanitiza datos sensibles para logging
   */
  private static sanitizeLogData(data: any): any {
    if (!data || typeof data !== 'object') {
      return data;
    }

    const sensitiveFields = [
      'password',
      'token',
      'secret',
      'key',
      'authorization',
      'cookie',
      'session',
      'credit_card',
      'creditCard',
      'ssn',
      'social_security'
    ];

    const sanitized = { ...data };

    Object.keys(sanitized).forEach(key => {
      const lowerKey = key.toLowerCase();
      
      if (sensitiveFields.some(field => lowerKey.includes(field))) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
        sanitized[key] = ErrorHandlerMiddleware.sanitizeLogData(sanitized[key]);
      }
    });

    return sanitized;
  }

  /**
   * Middleware para development que muestra errores detallados
   */
  static developmentErrorHandler() {
    return (error: any, req: Request, res: Response, next: NextFunction): void => {
      if (process.env.NODE_ENV !== 'development') {
        return next(error);
      }

      const errorDetails = {
        success: false,
        error: error.name || 'Error',
        message: error.message,
        stack: error.stack,
        details: error.details || error,
        timestamp: new Date().toISOString(),
        path: req.path,
        method: req.method,
        query: req.query,
        params: req.params,
        body: req.body,
        headers: req.headers
      };

      res.status(error.statusCode || 500).json(errorDetails);
    };
  }

  /**
   * Crea error personalizado
   */
  static createError(
    message: string,
    statusCode: number = 500,
    code?: string | undefined,
    details?: any
  ): CustomError {
    const error = new Error(message) as CustomError;
    error.statusCode = statusCode;
    if (code !== undefined) {
      error.code = code;
    }
    if (details !== undefined) {
      error.details = details;
    }
    return error;
  }

  /**
   * Middleware para manejar errores async sin try/catch
   */
  static asyncHandler(fn: Function) {
    return (req: Request, res: Response, next: NextFunction): void => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  }

  /**
   * Middleware para limitar tamaño de respuesta de error
   */
  static limitErrorResponse() {
    return (error: any, req: Request, res: Response, next: NextFunction): void => {
      // Limitar stack trace en producción
      if (process.env.NODE_ENV === 'production' && error.stack) {
        delete error.stack;
      }

      // Limitar detalles si son muy grandes
      if (error.details && JSON.stringify(error.details).length > 1000) {
        error.details = { message: 'Detalles demasiado grandes para mostrar' };
      }

      next(error);
    };
  }
}