// src/infrastructure/web/validators/ChatValidator.ts

import Joi from 'joi';

/**
 * Validador para endpoints de chat
 */
export class ChatValidator {
  /**
   * Schema para validar envío de mensajes
   */
  static sendMessageSchema = Joi.object({
    sessionId: Joi.string()
      .required()
      .min(1)
      .max(100)
      .pattern(/^[a-zA-Z0-9_-]+$/)
      .messages({
        'string.empty': 'Session ID es requerido',
        'string.min': 'Session ID debe tener al menos 1 caracter',
        'string.max': 'Session ID no puede exceder 100 caracteres',
        'string.pattern.base': 'Session ID solo puede contener letras, números, guiones y guiones bajos'
      }),

    message: Joi.string()
      .required()
      .min(1)
      .max(1000)
      .trim()
      .messages({
        'string.empty': 'Mensaje es requerido',
        'string.min': 'Mensaje debe tener al menos 1 caracter',
        'string.max': 'Mensaje no puede exceder 1000 caracteres'
      }),

    isVoice: Joi.boolean()
      .default(false)
      .messages({
        'boolean.base': 'isVoice debe ser un valor booleano'
      }),

    userId: Joi.string()
      .optional()
      .min(1)
      .max(100)
      .pattern(/^[a-zA-Z0-9_-]+$/)
      .messages({
        'string.min': 'User ID debe tener al menos 1 caracter',
        'string.max': 'User ID no puede exceder 100 caracteres',
        'string.pattern.base': 'User ID solo puede contener letras, números, guiones y guiones bajos'
      }),

    audioData: Joi.string()
      .optional()
      .base64()
      .messages({
        'string.base64': 'audioData debe ser una cadena base64 válida'
      }),

    metadata: Joi.object()
      .optional()
      .messages({
        'object.base': 'metadata debe ser un objeto válido'
      })
  });

  /**
   * Schema para validar obtención de historial
   */
  static getHistorySchema = Joi.object({
    sessionId: Joi.string()
      .required()
      .min(1)
      .max(100)
      .pattern(/^[a-zA-Z0-9_-]+$/)
      .messages({
        'string.empty': 'Session ID es requerido',
        'string.min': 'Session ID debe tener al menos 1 caracter',
        'string.max': 'Session ID no puede exceder 100 caracteres',
        'string.pattern.base': 'Session ID solo puede contener letras, números, guiones y guiones bajos'
      }),

    limit: Joi.number()
      .optional()
      .integer()
      .min(1)
      .max(100)
      .default(20)
      .messages({
        'number.base': 'limit debe ser un número',
        'number.integer': 'limit debe ser un número entero',
        'number.min': 'limit debe ser al menos 1',
        'number.max': 'limit no puede exceder 100'
      }),

    offset: Joi.number()
      .optional()
      .integer()
      .min(0)
      .default(0)
      .messages({
        'number.base': 'offset debe ser un número',
        'number.integer': 'offset debe ser un número entero',
        'number.min': 'offset debe ser 0 o mayor'
      })
  });

  /**
   * Schema para validar health check
   */
  static healthCheckSchema = Joi.object({
    detailed: Joi.boolean()
      .optional()
      .default(false)
      .messages({
        'boolean.base': 'detailed debe ser un valor booleano'
      })
  });

  /**
   * Schema para validar parámetros de sesión
   */
  static sessionParamsSchema = Joi.object({
    sessionId: Joi.string()
      .required()
      .min(1)
      .max(100)
      .pattern(/^[a-zA-Z0-9_-]+$/)
      .messages({
        'string.empty': 'Session ID es requerido',
        'string.min': 'Session ID debe tener al menos 1 caracter',
        'string.max': 'Session ID no puede exceder 100 caracteres',
        'string.pattern.base': 'Session ID solo puede contener letras, números, guiones y guiones bajos'
      })
  });

  /**
   * Schema para validar configuración de chat
   */
  static chatConfigSchema = Joi.object({
    language: Joi.string()
      .optional()
      .valid('es', 'en', 'fr', 'de', 'it', 'pt')
      .default('es')
      .messages({
        'any.only': 'language debe ser uno de: es, en, fr, de, it, pt'
      }),

    enableVoice: Joi.boolean()
      .optional()
      .default(false)
      .messages({
        'boolean.base': 'enableVoice debe ser un valor booleano'
      }),

    temperature: Joi.number()
      .optional()
      .min(0)
      .max(2)
      .default(0.7)
      .messages({
        'number.base': 'temperature debe ser un número',
        'number.min': 'temperature debe ser al menos 0',
        'number.max': 'temperature no puede exceder 2'
      }),

    maxTokens: Joi.number()
      .optional()
      .integer()
      .min(1)
      .max(4000)
      .default(1000)
      .messages({
        'number.base': 'maxTokens debe ser un número',
        'number.integer': 'maxTokens debe ser un número entero',
        'number.min': 'maxTokens debe ser al menos 1',
        'number.max': 'maxTokens no puede exceder 4000'
      })
  });

  /**
   * Valida que el sessionId esté presente en headers o body
   */
  static validateSessionId = Joi.alternatives().try(
    Joi.object({
      'x-session-id': Joi.string()
        .required()
        .min(1)
        .max(100)
        .pattern(/^[a-zA-Z0-9_-]+$/)
    }).unknown(true),
    Joi.object({
      sessionId: Joi.string()
        .required()
        .min(1)
        .max(100)
        .pattern(/^[a-zA-Z0-9_-]+$/)
    }).unknown(true)
  );

  /**
   * Schema para validar archivos de audio
   */
  static audioFileSchema = Joi.object({
    mimetype: Joi.string()
      .valid('audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/ogg', 'audio/webm')
      .required()
      .messages({
        'any.only': 'Tipo de archivo no soportado. Use: mp3, wav, ogg, webm'
      }),

    size: Joi.number()
      .max(10 * 1024 * 1024) // 10MB max
      .required()
      .messages({
        'number.max': 'El archivo de audio no puede exceder 10MB'
      }),

    fieldname: Joi.string()
      .valid('audio')
      .required()
      .messages({
        'any.only': 'El campo debe llamarse "audio"'
      })
  });

  /**
   * Valida formato de mensaje de texto
   */
  static validateMessageContent(message: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validar longitud
    if (!message || message.trim().length === 0) {
      errors.push('El mensaje no puede estar vacío');
    }

    if (message.length > 1000) {
      errors.push('El mensaje no puede exceder 1000 caracteres');
    }

    // Validar contenido potencialmente peligroso
    const dangerousPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /javascript:/gi,
      /data:text\/html/gi,
      /vbscript:/gi,
      /onload=/gi,
      /onerror=/gi
    ];

    dangerousPatterns.forEach(pattern => {
      if (pattern.test(message)) {
        errors.push('El mensaje contiene contenido no permitido');
      }
    });

    // Validar exceso de caracteres especiales (posible spam)
    const specialCharCount = (message.match(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/g) || []).length;
    const totalLength = message.length;
    
    if (totalLength > 10 && specialCharCount / totalLength > 0.5) {
      errors.push('El mensaje contiene demasiados caracteres especiales');
    }

    // Validar repetición excesiva de caracteres
    const repeatedChars = /(.)\1{10,}/g;
    if (repeatedChars.test(message)) {
      errors.push('El mensaje contiene repeticiones excesivas de caracteres');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Valida configuración de sesión
   */
  static validateSessionConfig(config: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (config.maxMessages && (config.maxMessages < 1 || config.maxMessages > 1000)) {
      errors.push('maxMessages debe estar entre 1 y 1000');
    }

    if (config.timeoutMinutes && (config.timeoutMinutes < 1 || config.timeoutMinutes > 1440)) {
      errors.push('timeoutMinutes debe estar entre 1 y 1440 (24 horas)');
    }

    if (config.allowedOrigins && !Array.isArray(config.allowedOrigins)) {
      errors.push('allowedOrigins debe ser un array');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Schema para validar parámetros de búsqueda en historial
   */
  static searchHistorySchema = Joi.object({
    sessionId: Joi.string()
      .required()
      .min(1)
      .max(100)
      .pattern(/^[a-zA-Z0-9_-]+$/),

    query: Joi.string()
      .optional()
      .min(1)
      .max(100)
      .trim(),

    messageType: Joi.string()
      .optional()
      .valid('USER', 'ASSISTANT', 'SYSTEM', 'SERVICE_INFO', 'QUESTION', 'GENERAL'),

    fromDate: Joi.date()
      .optional()
      .iso(),

    toDate: Joi.date()
      .optional()
      .iso()
      .min(Joi.ref('fromDate')),

    limit: Joi.number()
      .optional()
      .integer()
      .min(1)
      .max(100)
      .default(20),

    offset: Joi.number()
      .optional()
      .integer()
      .min(0)
      .default(0)
  });
}