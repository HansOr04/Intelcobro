// src/infrastructure/web/middlewares/ValidationMiddleware.ts

import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { ValidationException, ValidationError, ValidationErrorType, ValidationContext } from '../../../application/exceptions/ValidationException';
import { logger } from '../../../shared/utils/Logger';

/**
 * Tipos de validación disponibles
 */
export type ValidationType = 'body' | 'query' | 'params' | 'headers';

/**
 * Opciones de validación
 */
export interface ValidationOptions {
  allowUnknown?: boolean;
  stripUnknown?: boolean;
  abortEarly?: boolean;
  skipOnError?: boolean;
}

/**
 * Middleware para validación de datos usando Joi
 */
export class ValidationMiddleware {
  /**
   * Middleware principal de validación
   */
  static validate(
    schema: Joi.ObjectSchema,
    type: ValidationType = 'body',
    options: ValidationOptions = {}
  ) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const defaultOptions: ValidationOptions = {
          allowUnknown: false,
          stripUnknown: true,
          abortEarly: false,
          skipOnError: false,
          ...options
        };

        // Obtener datos a validar según el tipo
        const dataToValidate = ValidationMiddleware.getDataToValidate(req, type);

        // Validar con Joi - Fix: Ensure all properties are boolean, not boolean | undefined
        const { error, value } = schema.validate(dataToValidate, {
          allowUnknown: defaultOptions.allowUnknown ?? false,
          stripUnknown: defaultOptions.stripUnknown ?? true,
          abortEarly: defaultOptions.abortEarly ?? false
        });

        if (error) {
          const validationErrors = ValidationMiddleware.convertJoiErrorsToValidationErrors(error);
          const context: ValidationContext = {
            timestamp: new Date(),
            metadata: {
              path: req.path,
              method: req.method,
              type,
              ip: req.ip,
              userAgent: req.get('User-Agent')
            }
          };
          
          logger.warn('Validation failed', {
            path: req.path,
            method: req.method,
            type,
            errors: validationErrors.map(e => e.message),
            ip: req.ip,
            userAgent: req.get('User-Agent')
          });

          throw new ValidationException(validationErrors, context);
        }

        // Actualizar request con datos validados y sanitizados
        ValidationMiddleware.updateRequestData(req, type, value);

        // Agregar metadata de validación
        req.validation = {
          type,
          validated: true,
          timestamp: new Date(),
          schema: schema.describe()
        };

        next();

      } catch (error) {
        if (error instanceof ValidationException) {
          next(error);
        } else {
          logger.error('Unexpected validation error', undefined, {
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
            requestPath: req.path,
            method: req.method,
            type
          });
          
          const validationError: ValidationError = {
            type: ValidationErrorType.BUSINESS_RULE_VIOLATION,
            field: 'general',
            message: 'Error interno de validación'
          };

          const context: ValidationContext = {
            timestamp: new Date(),
            metadata: {
              path: req.path,
              method: req.method,
              type
            }
          };

          next(new ValidationException(validationError, context));
        }
      }
    };
  }

  /**
   * Middleware para validar múltiples esquemas
   */
  static validateMultiple(validations: Array<{
    schema: Joi.ObjectSchema;
    type: ValidationType;
    options?: ValidationOptions;
  }>) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const allErrors: ValidationError[] = [];

        for (const validation of validations) {
          const dataToValidate = ValidationMiddleware.getDataToValidate(req, validation.type);
          const { error, value } = validation.schema.validate(dataToValidate, {
            allowUnknown: validation.options?.allowUnknown ?? false,
            stripUnknown: validation.options?.stripUnknown ?? true,
            abortEarly: validation.options?.abortEarly ?? false
          });

          if (error) {
            const validationErrors = ValidationMiddleware.convertJoiErrorsToValidationErrors(error);
            allErrors.push(...validationErrors);
          } else {
            // Actualizar datos validados
            ValidationMiddleware.updateRequestData(req, validation.type, value);
          }
        }

        if (allErrors.length > 0) {
          const context: ValidationContext = {
            timestamp: new Date(),
            metadata: {
              path: req.path,
              method: req.method,
              ip: req.ip,
              validationType: 'multiple'
            }
          };

          logger.warn('Multiple validation failed', {
            path: req.path,
            method: req.method,
            errors: allErrors.map(e => e.message),
            ip: req.ip
          });

          throw new ValidationException(allErrors, context);
        }

        req.validation = {
          type: 'multiple',
          validated: true,
          timestamp: new Date(),
          validationCount: validations.length
        };

        next();

      } catch (error) {
        next(error);
      }
    };
  }

  /**
   * Middleware para validación condicional
   */
  static validateConditional(
    condition: (req: Request) => boolean,
    schema: Joi.ObjectSchema,
    type: ValidationType = 'body',
    options: ValidationOptions = {}
  ) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        // Evaluar condición
        if (!condition(req)) {
          // Si no se cumple la condición, continuar sin validar
          next();
          return;
        }

        // Si se cumple, aplicar validación normal
        const validationMiddleware = ValidationMiddleware.validate(schema, type, options);
        await validationMiddleware(req, res, next);

      } catch (error) {
        next(error);
      }
    };
  }

  /**
   * Middleware para sanitización de datos
   */
  static sanitize(type: ValidationType = 'body') {
    return (req: Request, res: Response, next: NextFunction): void => {
      try {
        const data = ValidationMiddleware.getDataToValidate(req, type);
        const sanitizedData = ValidationMiddleware.sanitizeData(data);
        
        ValidationMiddleware.updateRequestData(req, type, sanitizedData);
        
        logger.debug('Data sanitized', {
          path: req.path,
          method: req.method,
          type,
          fieldsCount: Object.keys(sanitizedData || {}).length
        });

        next();

      } catch (error) {
        logger.error('Sanitization error', undefined, {
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
          requestPath: req.path,
          method: req.method,
          type
        });
        next(error);
      }
    };
  }

  /**
   * Middleware para rate limiting basado en validación
   */
  static rateLimitByField(
    fieldName: string,
    maxAttempts: number = 5,
    windowMs: number = 15 * 60 * 1000, // 15 minutos
    type: ValidationType = 'body'
  ) {
    const attempts = new Map<string, { count: number; resetTime: number }>();

    return (req: Request, res: Response, next: NextFunction): void => {
      try {
        const data = ValidationMiddleware.getDataToValidate(req, type);
        const fieldValue = data[fieldName];

        if (!fieldValue) {
          next();
          return;
        }

        const key = `${fieldName}:${fieldValue}`;
        const now = Date.now();
        const current = attempts.get(key);

        if (current && now < current.resetTime) {
          if (current.count >= maxAttempts) {
            logger.warn('Rate limit exceeded for field', {
              field: fieldName,
              value: fieldValue,
              attempts: current.count,
              ip: req.ip
            });

            res.status(429).json({
              success: false,
              error: 'Demasiados intentos',
              message: `Demasiados intentos para ${fieldName}. Intente más tarde.`,
              retryAfter: Math.ceil((current.resetTime - now) / 1000)
            });
            return;
          }

          attempts.set(key, {
            count: current.count + 1,
            resetTime: current.resetTime
          });
        } else {
          attempts.set(key, {
            count: 1,
            resetTime: now + windowMs
          });
        }

        next();

      } catch (error) {
        next(error);
      }
    };
  }

  /**
   * Middleware para validar CSRF token
   */
  static validateCSRF() {
    return (req: Request, res: Response, next: NextFunction): void => {
      try {
        // Solo para métodos que modifican datos
        if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
          next();
          return;
        }

        const token = req.headers['x-csrf-token'] || req.body._csrf || req.query._csrf;
        const sessionToken = req.session?.csrfToken;

        if (!token || !sessionToken || token !== sessionToken) {
          logger.warn('CSRF validation failed', {
            path: req.path,
            method: req.method,
            hasToken: !!token,
            hasSessionToken: !!sessionToken,
            ip: req.ip
          });

          res.status(403).json({
            success: false,
            error: 'CSRF token inválido',
            message: 'Token de seguridad inválido o faltante'
          });
          return;
        }

        next();

      } catch (error) {
        next(error);
      }
    };
  }

  /**
   * Obtiene datos a validar según el tipo
   */
  private static getDataToValidate(req: Request, type: ValidationType): any {
    switch (type) {
      case 'body':
        return req.body || {};
      case 'query':
        return req.query || {};
      case 'params':
        return req.params || {};
      case 'headers':
        return req.headers || {};
      default:
        return {};
    }
  }

  /**
   * Actualiza los datos del request con valores validados
   */
  private static updateRequestData(req: Request, type: ValidationType, value: any): void {
    switch (type) {
      case 'body':
        req.body = value;
        break;
      case 'query':
        req.query = value;
        break;
      case 'params':
        req.params = value;
        break;
      case 'headers':
        // No actualizar headers por seguridad
        break;
    }
  }

  /**
   * Convierte errores de Joi a ValidationError[]
   */
  private static convertJoiErrorsToValidationErrors(error: Joi.ValidationError): ValidationError[] {
    return error.details.map(detail => {
      const field = detail.path.join('.') || 'root';
      const message = detail.message.replace(/"/g, '');
      
      // Mapear tipos de error de Joi a nuestros tipos
      let type: ValidationErrorType;
      switch (detail.type) {
        case 'any.required':
          type = ValidationErrorType.REQUIRED_FIELD;
          break;
        case 'string.email':
          type = ValidationErrorType.INVALID_EMAIL;
          break;
        case 'string.min':
        case 'string.max':
        case 'string.length':
          type = ValidationErrorType.INVALID_LENGTH;
          break;
        case 'number.min':
        case 'number.max':
          type = ValidationErrorType.INVALID_RANGE;
          break;
        case 'string.pattern.base':
          type = ValidationErrorType.INVALID_FORMAT;
          break;
        default:
          type = ValidationErrorType.INVALID_TYPE;
      }

      const validationError: ValidationError = {
        type,
        field,
        message,
        value: detail.context?.value
      };

      // Only add constraints if there's actual context data
      if (detail.context && Object.keys(detail.context).length > 0) {
        validationError.constraints = { ...detail.context };
      }

      return validationError;
    });
  }

  /**
   * Formatea errores de Joi a array de strings (mantenido para compatibilidad)
   */
  private static formatJoiErrors(error: Joi.ValidationError): string[] {
    return error.details.map(detail => {
      const path = detail.path.join('.');
      const message = detail.message.replace(/"/g, '');
      return path ? `${path}: ${message}` : message;
    });
  }

  /**
   * Sanitiza datos de entrada
   */
  private static sanitizeData(data: any): any {
    if (typeof data !== 'object' || data === null) {
      return data;
    }

    if (Array.isArray(data)) {
      return data.map(item => ValidationMiddleware.sanitizeData(item));
    }

    const sanitized: any = {};

    Object.entries(data).forEach(([key, value]) => {
      if (typeof value === 'string') {
        // Remover caracteres de control
        let clean = value.replace(/[\x00-\x1F\x7F-\x9F]/g, '');
        
        // Normalizar espacios en blanco
        clean = clean.replace(/\s+/g, ' ').trim();
        
        // Limitar longitud extrema
        if (clean.length > 10000) {
          clean = clean.substring(0, 10000);
        }
        
        sanitized[key] = clean;
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = ValidationMiddleware.sanitizeData(value);
      } else {
        sanitized[key] = value;
      }
    });

    return sanitized;
  }

  /**
   * Valida contenido para XSS básico
   */
  static validateXSS() {
    return (req: Request, res: Response, next: NextFunction): void => {
      try {
        const suspicious = ValidationMiddleware.detectXSS(req.body);
        
        if (suspicious.length > 0) {
          logger.warn('Potential XSS detected', {
            path: req.path,
            method: req.method,
            suspicious,
            ip: req.ip,
            userAgent: req.get('User-Agent')
          });

          res.status(400).json({
            success: false,
            error: 'Contenido sospechoso detectado',
            message: 'El contenido enviado contiene patrones no permitidos'
          });
          return;
        }

        next();

      } catch (error) {
        next(error);
      }
    };
  }

  /**
   * Detecta posibles ataques XSS
   */
  private static detectXSS(data: any, path: string = ''): string[] {
    const suspicious: string[] = [];

    if (typeof data === 'string') {
      const xssPatterns = [
        /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
        /javascript:/gi,
        /vbscript:/gi,
        /onload\s*=/gi,
        /onerror\s*=/gi,
        /onclick\s*=/gi,
        /onmouseover\s*=/gi,
        /<iframe\b[^>]*>/gi,
        /<object\b[^>]*>/gi,
        /<embed\b[^>]*>/gi
      ];

      xssPatterns.forEach(pattern => {
        if (pattern.test(data)) {
          suspicious.push(path || 'root');
        }
      });
    } else if (Array.isArray(data)) {
      data.forEach((item, index) => {
        const itemSuspicious = ValidationMiddleware.detectXSS(item, `${path}[${index}]`);
        suspicious.push(...itemSuspicious);
      });
    } else if (typeof data === 'object' && data !== null) {
      Object.entries(data).forEach(([key, value]) => {
        const keyPath = path ? `${path}.${key}` : key;
        const keySuspicious = ValidationMiddleware.detectXSS(value, keyPath);
        suspicious.push(...keySuspicious);
      });
    }

    return [...new Set(suspicious)]; // Remove duplicates
  }
}

/**
 * Extender Request para incluir información de validación
 */
declare global {
  namespace Express {
    interface Request {
      validation?: {
        type: string;
        validated: boolean;
        timestamp: Date;
        schema?: any;
        validationCount?: number;
      };
      session?: {
        csrfToken?: string;
        [key: string]: any;
      };
    }
  }
}