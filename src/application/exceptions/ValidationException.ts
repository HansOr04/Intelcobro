// src/application/exceptions/ValidationException.ts

/**
 * Tipos de errores de validación
 */
export enum ValidationErrorType {
  REQUIRED_FIELD = 'REQUIRED_FIELD',
  INVALID_FORMAT = 'INVALID_FORMAT',
  INVALID_LENGTH = 'INVALID_LENGTH',
  INVALID_RANGE = 'INVALID_RANGE',
  INVALID_TYPE = 'INVALID_TYPE',
  INVALID_EMAIL = 'INVALID_EMAIL',
  INVALID_PHONE = 'INVALID_PHONE',
  INVALID_URL = 'INVALID_URL',
  INVALID_DATE = 'INVALID_DATE',
  BUSINESS_RULE_VIOLATION = 'BUSINESS_RULE_VIOLATION',
  DUPLICATE_VALUE = 'DUPLICATE_VALUE',
  UNAUTHORIZED_ACCESS = 'UNAUTHORIZED_ACCESS',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  INVALID_STATE = 'INVALID_STATE'
}

/**
 * Información detallada sobre un error de validación
 */
export interface ValidationError {
  type: ValidationErrorType;
  field: string;
  message: string;
  value?: any;
  constraints?: Record<string, any>;
  code?: string;
}

/**
 * Contexto adicional para la validación
 */
export interface ValidationContext {
  entity?: string;
  operation?: string;
  userId?: string;
  sessionId?: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

/**
 * Excepción personalizada para errores de validación
 */
export class ValidationException extends Error {
  public readonly errors: ValidationError[];
  public readonly context?: ValidationContext | undefined;
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(
    errors: ValidationError[] | ValidationError | string,
    context?: ValidationContext,
    statusCode: number = 400
  ) {
    // Crear mensaje principal
    const errorMessage = ValidationException.createErrorMessage(errors);
    super(errorMessage);

    // Configurar propiedades
    this.name = 'ValidationException';
    this.errors = Array.isArray(errors) ? errors : 
                  typeof errors === 'string' ? [ValidationException.createSimpleError(errors)] : 
                  [errors];
    this.context = context;
    this.statusCode = statusCode;
    this.isOperational = true;

    // Mantener stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ValidationException);
    }
  }

  /**
   * Crea un mensaje de error principal basado en los errores
   */
  private static createErrorMessage(errors: ValidationError[] | ValidationError | string): string {
    if (typeof errors === 'string') {
      return errors;
    }

    if (!Array.isArray(errors)) {
      return errors.message;
    }

    if (errors.length === 1) {
      return errors[0]?.message || 'Error de validación';
    }

    return `Validation failed with ${errors.length} errors: ${errors.map(e => e.field).join(', ')}`;
  }

  /**
   * Crea un error simple desde un string
   */
  private static createSimpleError(message: string): ValidationError {
    return {
      type: ValidationErrorType.BUSINESS_RULE_VIOLATION,
      field: 'general',
      message
    };
  }

  /**
   * Obtiene todos los campos que tienen errores
   */
  getErrorFields(): string[] {
    return [...new Set(this.errors.map(error => error.field))];
  }

  /**
   * Obtiene errores por campo específico
   */
  getErrorsForField(field: string): ValidationError[] {
    return this.errors.filter(error => error.field === field);
  }

  /**
   * Obtiene errores por tipo
   */
  getErrorsByType(type: ValidationErrorType): ValidationError[] {
    return this.errors.filter(error => error.type === type);
  }

  /**
   * Verifica si hay errores de un tipo específico
   */
  hasErrorType(type: ValidationErrorType): boolean {
    return this.errors.some(error => error.type === type);
  }

  /**
   * Verifica si hay errores en un campo específico
   */
  hasErrorInField(field: string): boolean {
    return this.errors.some(error => error.field === field);
  }

  /**
   * Obtiene un resumen de errores agrupados por campo
   */
  getErrorSummary(): Record<string, string[]> {
    const summary: Record<string, string[]> = {};
    
    this.errors.forEach(error => {
      if (!summary[error.field]) {
        summary[error.field] = [];
      }
      summary[error.field]?.push(error.message);
    });

    return summary;
  }

  /**
   * Convierte la excepción a formato JSON para APIs
   */
  toJSON(): Record<string, any> {
    return {
      name: this.name,
      message: this.message,
      statusCode: this.statusCode,
      errors: this.errors,
      context: this.context,
      timestamp: new Date().toISOString(),
      errorCount: this.errors.length,
      fields: this.getErrorFields()
    };
  }

  /**
   * Crea una respuesta HTTP formateada
   */
  toHttpResponse(): Record<string, any> {
    return {
      success: false,
      error: {
        type: 'ValidationError',
        message: this.message,
        details: this.getErrorSummary(),
        fields: this.getErrorFields(),
        code: this.statusCode
      },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Factory method para error de campo requerido
   */
  static requiredField(field: string, customMessage?: string): ValidationException {
    const error: ValidationError = {
      type: ValidationErrorType.REQUIRED_FIELD,
      field,
      message: customMessage || `El campo '${field}' es requerido`,
      code: 'REQUIRED'
    };
    return new ValidationException(error);
  }

  /**
   * Factory method para error de formato inválido
   */
  static invalidFormat(field: string, expectedFormat: string, value?: any): ValidationException {
    const error: ValidationError = {
      type: ValidationErrorType.INVALID_FORMAT,
      field,
      message: `El campo '${field}' debe tener el formato: ${expectedFormat}`,
      value,
      code: 'INVALID_FORMAT'
    };
    return new ValidationException(error);
  }

  /**
   * Factory method para error de email inválido
   */
  static invalidEmail(field: string = 'email', value?: string): ValidationException {
    const error: ValidationError = {
      type: ValidationErrorType.INVALID_EMAIL,
      field,
      message: `El email '${value || 'proporcionado'}' no tiene un formato válido`,
      value,
      code: 'INVALID_EMAIL'
    };
    return new ValidationException(error);
  }

  /**
   * Factory method para error de teléfono inválido
   */
  static invalidPhone(field: string = 'phoneNumber', value?: string): ValidationException {
    const error: ValidationError = {
      type: ValidationErrorType.INVALID_PHONE,
      field,
      message: `El número de teléfono '${value || 'proporcionado'}' no tiene un formato válido`,
      value,
      code: 'INVALID_PHONE'
    };
    return new ValidationException(error);
  }

  /**
   * Factory method para error de longitud inválida
   */
  static invalidLength(
    field: string, 
    min?: number, 
    max?: number, 
    actual?: number
  ): ValidationException {
    let message = `El campo '${field}' tiene una longitud inválida`;
    
    if (min !== undefined && max !== undefined) {
      message += ` (debe tener entre ${min} y ${max} caracteres)`;
    } else if (min !== undefined) {
      message += ` (debe tener al menos ${min} caracteres)`;
    } else if (max !== undefined) {
      message += ` (no puede exceder ${max} caracteres)`;
    }

    if (actual !== undefined) {
      message += `. Longitud actual: ${actual}`;
    }

    const error: ValidationError = {
      type: ValidationErrorType.INVALID_LENGTH,
      field,
      message,
      constraints: { min, max, actual },
      code: 'INVALID_LENGTH'
    };
    return new ValidationException(error);
  }

  /**
   * Factory method para error de rango inválido
   */
  static invalidRange(
    field: string,
    min?: number,
    max?: number,
    value?: number
  ): ValidationException {
    let message = `El valor del campo '${field}' está fuera del rango permitido`;
    
    if (min !== undefined && max !== undefined) {
      message += ` (${min} - ${max})`;
    } else if (min !== undefined) {
      message += ` (mínimo: ${min})`;
    } else if (max !== undefined) {
      message += ` (máximo: ${max})`;
    }

    if (value !== undefined) {
      message += `. Valor actual: ${value}`;
    }

    const error: ValidationError = {
      type: ValidationErrorType.INVALID_RANGE,
      field,
      message,
      value,
      constraints: { min, max },
      code: 'INVALID_RANGE'
    };
    return new ValidationException(error);
  }

  /**
   * Factory method para violación de regla de negocio
   */
  static businessRuleViolation(
    rule: string,
    field: string = 'general',
    details?: string
  ): ValidationException {
    const message = details ? `${rule}: ${details}` : rule;
    const error: ValidationError = {
      type: ValidationErrorType.BUSINESS_RULE_VIOLATION,
      field,
      message,
      code: 'BUSINESS_RULE'
    };
    return new ValidationException(error);
  }

  /**
   * Factory method para errores múltiples
   */
  static multiple(errors: ValidationError[], context?: ValidationContext): ValidationException {
    return new ValidationException(errors, context);
  }

  /**
   * Factory method para rate limiting
   */
  static rateLimitExceeded(
    field: string = 'general',
    limit?: number,
    timeWindow?: string
  ): ValidationException {
    let message = 'Se ha excedido el límite de solicitudes';
    if (limit && timeWindow) {
      message += ` (${limit} solicitudes por ${timeWindow})`;
    }

    const error: ValidationError = {
      type: ValidationErrorType.RATE_LIMIT_EXCEEDED,
      field,
      message,
      constraints: { limit, timeWindow },
      code: 'RATE_LIMIT'
    };
    return new ValidationException(error, undefined, 429);
  }

  /**
   * Factory method para estado inválido
   */
  static invalidState(
    currentState: string,
    expectedState: string,
    field: string = 'status'
  ): ValidationException {
    const error: ValidationError = {
      type: ValidationErrorType.INVALID_STATE,
      field,
      message: `Estado inválido. Estado actual: '${currentState}', esperado: '${expectedState}'`,
      constraints: { currentState, expectedState },
      code: 'INVALID_STATE'
    };
    return new ValidationException(error);
  }
}