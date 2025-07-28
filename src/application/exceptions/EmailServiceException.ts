// src/application/exceptions/EmailServiceException.ts

/**
 * Tipos de errores del servicio de email
 */
export enum EmailServiceErrorType {
  API_CONNECTION_ERROR = 'API_CONNECTION_ERROR',
  API_TIMEOUT = 'API_TIMEOUT',
  API_RATE_LIMIT = 'API_RATE_LIMIT',
  INVALID_API_KEY = 'INVALID_API_KEY',
  INVALID_EMAIL_ADDRESS = 'INVALID_EMAIL_ADDRESS',
  INVALID_SENDER = 'INVALID_SENDER',
  INVALID_RECIPIENT = 'INVALID_RECIPIENT',
  EMAIL_BLOCKED = 'EMAIL_BLOCKED',
  DOMAIN_BLOCKED = 'DOMAIN_BLOCKED',
  TEMPLATE_NOT_FOUND = 'TEMPLATE_NOT_FOUND',
  TEMPLATE_ERROR = 'TEMPLATE_ERROR',
  ATTACHMENT_TOO_LARGE = 'ATTACHMENT_TOO_LARGE',
  ATTACHMENT_INVALID = 'ATTACHMENT_INVALID',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  DELIVERY_FAILED = 'DELIVERY_FAILED',
  BOUNCE = 'BOUNCE',
  COMPLAINT = 'COMPLAINT',
  SUPPRESSED = 'SUPPRESSED',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

/**
 * Información detallada sobre el error del servicio de email
 */
export interface EmailServiceErrorDetails {
  type: EmailServiceErrorType;
  provider: string; // 'resend', 'sendgrid', 'ses', etc.
  messageId?: string;
  emailId?: string;
  recipient?: string;
  sender?: string;
  subject?: string;
  templateId?: string;
  bounceReason?: string;
  retryAfter?: number;
  originalError?: any;
  timestamp: Date;
}

/**
 * Contexto del envío de email
 */
export interface EmailSendContext {
  formSubmissionId?: string;
  sessionId?: string;
  userId?: string;
  emailType?: string; // 'welcome', 'notification', 'marketing', etc.
  recipients?: string[];
  sender?: string;
  subject?: string;
  template?: string;
  metadata?: Record<string, any>;
}

/**
 * Excepción personalizada para errores del servicio de email
 */
export class EmailServiceException extends Error {
  public readonly errorType: EmailServiceErrorType;
  public readonly details: EmailServiceErrorDetails;
  public readonly context?: EmailSendContext | undefined;
  public readonly statusCode: number;
  public readonly isRetryable: boolean;
  public readonly retryAfter?: number | undefined;

  constructor(
    errorType: EmailServiceErrorType,
    message: string,
    details: Partial<EmailServiceErrorDetails>,
    context?: EmailSendContext
  ) {
    super(message);
    
    this.name = 'EmailServiceException';
    this.errorType = errorType;
    this.details = {
      type: errorType,
      provider: details.provider || 'unknown',
      timestamp: new Date(),
      ...details
    };
    this.context = context;
    this.statusCode = this.getStatusCodeForErrorType(errorType);
    this.isRetryable = this.isErrorRetryable(errorType);
    this.retryAfter = details.retryAfter;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, EmailServiceException);
    }
  }

  /**
   * Determina el código de estado HTTP basado en el tipo de error
   */
  private getStatusCodeForErrorType(errorType: EmailServiceErrorType): number {
    switch (errorType) {
      case EmailServiceErrorType.INVALID_API_KEY:
        return 401;
      case EmailServiceErrorType.API_RATE_LIMIT:
      case EmailServiceErrorType.QUOTA_EXCEEDED:
        return 429;
      case EmailServiceErrorType.INVALID_EMAIL_ADDRESS:
      case EmailServiceErrorType.INVALID_SENDER:
      case EmailServiceErrorType.INVALID_RECIPIENT:
      case EmailServiceErrorType.TEMPLATE_ERROR:
      case EmailServiceErrorType.ATTACHMENT_TOO_LARGE:
      case EmailServiceErrorType.ATTACHMENT_INVALID:
        return 400;
      case EmailServiceErrorType.TEMPLATE_NOT_FOUND:
        return 404;
      case EmailServiceErrorType.EMAIL_BLOCKED:
      case EmailServiceErrorType.DOMAIN_BLOCKED:
      case EmailServiceErrorType.SUPPRESSED:
        return 403;
      case EmailServiceErrorType.SERVICE_UNAVAILABLE:
      case EmailServiceErrorType.API_CONNECTION_ERROR:
      case EmailServiceErrorType.API_TIMEOUT:
        return 503;
      default:
        return 500;
    }
  }

  /**
   * Determina si el error es reintentable
   */
  private isErrorRetryable(errorType: EmailServiceErrorType): boolean {
    const retryableErrors = [
      EmailServiceErrorType.API_CONNECTION_ERROR,
      EmailServiceErrorType.API_TIMEOUT,
      EmailServiceErrorType.API_RATE_LIMIT,
      EmailServiceErrorType.SERVICE_UNAVAILABLE,
      EmailServiceErrorType.DELIVERY_FAILED
    ];
    return retryableErrors.includes(errorType);
  }

  /**
   * Obtiene el tiempo de espera sugerido antes del reintento
   */
  getRetryDelay(): number {
    if (!this.isRetryable) {
      return 0;
    }

    if (this.retryAfter) {
      return this.retryAfter * 1000; // Convertir a ms
    }

    // Tiempos de espera por defecto basados en el tipo de error
    switch (this.errorType) {
      case EmailServiceErrorType.API_RATE_LIMIT:
        return 300000; // 5 minutos
      case EmailServiceErrorType.API_CONNECTION_ERROR:
        return 30000; // 30 segundos
      case EmailServiceErrorType.API_TIMEOUT:
        return 60000; // 1 minuto
      case EmailServiceErrorType.SERVICE_UNAVAILABLE:
        return 300000; // 5 minutos
      case EmailServiceErrorType.DELIVERY_FAILED:
        return 600000; // 10 minutos
      default:
        return 60000;
    }
  }

  /**
   * Verifica si el error está relacionado con la entregabilidad
   */
  isDeliverabilityIssue(): boolean {
    const deliverabilityErrors = [
      EmailServiceErrorType.EMAIL_BLOCKED,
      EmailServiceErrorType.DOMAIN_BLOCKED,
      EmailServiceErrorType.BOUNCE,
      EmailServiceErrorType.COMPLAINT,
      EmailServiceErrorType.SUPPRESSED,
      EmailServiceErrorType.DELIVERY_FAILED
    ];
    return deliverabilityErrors.includes(this.errorType);
  }

  /**
   * Verifica si el error requiere acción manual
   */
  requiresManualAction(): boolean {
    const manualActionErrors = [
      EmailServiceErrorType.INVALID_API_KEY,
      EmailServiceErrorType.QUOTA_EXCEEDED,
      EmailServiceErrorType.TEMPLATE_NOT_FOUND,
      EmailServiceErrorType.BOUNCE,
      EmailServiceErrorType.COMPLAINT
    ];
    return manualActionErrors.includes(this.errorType);
  }

  /**
   * Obtiene información del destinatario afectado
   */
  getRecipientInfo(): Record<string, any> {
    return {
      recipient: this.details.recipient,
      blocked: this.errorType === EmailServiceErrorType.EMAIL_BLOCKED,
      domainBlocked: this.errorType === EmailServiceErrorType.DOMAIN_BLOCKED,
      bounced: this.errorType === EmailServiceErrorType.BOUNCE,
      complained: this.errorType === EmailServiceErrorType.COMPLAINT,
      suppressed: this.errorType === EmailServiceErrorType.SUPPRESSED
    };
  }

  /**
   * Convierte la excepción a formato JSON
   */
  toJSON(): Record<string, any> {
    return {
      name: this.name,
      message: this.message,
      type: this.errorType,
      statusCode: this.statusCode,
      isRetryable: this.isRetryable,
      retryAfter: this.retryAfter,
      isDeliverabilityIssue: this.isDeliverabilityIssue(),
      requiresManualAction: this.requiresManualAction(),
      details: this.details,
      context: this.context,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Crea una respuesta HTTP formateada
   */
  toHttpResponse(): Record<string, any> {
    return {
      success: false,
      error: {
        type: 'EmailServiceError',
        message: this.message,
        code: this.errorType,
        statusCode: this.statusCode,
        isRetryable: this.isRetryable,
        retryAfter: this.retryAfter,
        provider: this.details.provider,
        recipient: this.details.recipient
      },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Factory method para error de conexión API
   */
  static connectionError(
    provider: string,
    originalError?: any,
    context?: EmailSendContext
  ): EmailServiceException {
    return new EmailServiceException(
      EmailServiceErrorType.API_CONNECTION_ERROR,
      `No se pudo conectar al servicio de email de ${provider}`,
      {
        provider,
        originalError
      },
      context
    );
  }

  /**
   * Factory method para timeout de API
   */
  static timeout(
    provider: string,
    timeoutMs: number,
    context?: EmailSendContext
  ): EmailServiceException {
    return new EmailServiceException(
      EmailServiceErrorType.API_TIMEOUT,
      `Timeout al enviar email con ${provider} (${timeoutMs}ms)`,
      {
        provider
      },
      context
    );
  }

  /**
   * Factory method para rate limiting
   */
  static rateLimitExceeded(
    provider: string,
    retryAfter?: number,
    context?: EmailSendContext
  ): EmailServiceException {
    const details: Partial<EmailServiceErrorDetails> = { provider };
    
    if (retryAfter !== undefined) {
      details.retryAfter = retryAfter;
    }

    return new EmailServiceException(
      EmailServiceErrorType.API_RATE_LIMIT,
      `Rate limit excedido para ${provider}`,
      details,
      context
    );
  }

  /**
   * Factory method para API key inválida
   */
  static invalidApiKey(
    provider: string,
    context?: EmailSendContext
  ): EmailServiceException {
    return new EmailServiceException(
      EmailServiceErrorType.INVALID_API_KEY,
      `API key inválida para ${provider}`,
      {
        provider
      },
      context
    );
  }

  /**
   * Factory method para email inválido
   */
  static invalidEmail(
    provider: string,
    email: string,
    context?: EmailSendContext
  ): EmailServiceException {
    return new EmailServiceException(
      EmailServiceErrorType.INVALID_EMAIL_ADDRESS,
      `Dirección de email inválida: ${email}`,
      {
        provider,
        recipient: email
      },
      context
    );
  }

  /**
   * Factory method para email bloqueado
   */
  static emailBlocked(
    provider: string,
    email: string,
    reason?: string,
    context?: EmailSendContext
  ): EmailServiceException {
    const message = reason
      ? `Email bloqueado (${email}): ${reason}`
      : `Email bloqueado: ${email}`;

    return new EmailServiceException(
      EmailServiceErrorType.EMAIL_BLOCKED,
      message,
      {
        provider,
        recipient: email
      },
      context
    );
  }

  /**
   * Factory method para bounce
   */
  static bounced(
    provider: string,
    email: string,
    bounceReason?: string,
    context?: EmailSendContext
  ): EmailServiceException {
    const message = bounceReason
      ? `Email rebotado (${email}): ${bounceReason}`
      : `Email rebotado: ${email}`;

    const details: Partial<EmailServiceErrorDetails> = {
      provider,
      recipient: email
    };

    if (bounceReason) {
      details.bounceReason = bounceReason;
    }

    return new EmailServiceException(
      EmailServiceErrorType.BOUNCE,
      message,
      details,
      context
    );
  }

  /**
   * Factory method para template no encontrado
   */
  static templateNotFound(
    provider: string,
    templateId: string,
    context?: EmailSendContext
  ): EmailServiceException {
    return new EmailServiceException(
      EmailServiceErrorType.TEMPLATE_NOT_FOUND,
      `Template no encontrado: ${templateId}`,
      {
        provider,
        templateId
      },
      context
    );
  }

  /**
   * Factory method para error de template
   */
  static templateError(
    provider: string,
    templateId: string,
    error: string,
    context?: EmailSendContext
  ): EmailServiceException {
    return new EmailServiceException(
      EmailServiceErrorType.TEMPLATE_ERROR,
      `Error en template ${templateId}: ${error}`,
      {
        provider,
        templateId
      },
      context
    );
  }

  /**
   * Factory method para falla de entrega
   */
  static deliveryFailed(
    provider: string,
    email: string,
    reason?: string,
    context?: EmailSendContext
  ): EmailServiceException {
    const message = reason
      ? `Falla en entrega (${email}): ${reason}`
      : `Falla en entrega: ${email}`;

    return new EmailServiceException(
      EmailServiceErrorType.DELIVERY_FAILED,
      message,
      {
        provider,
        recipient: email
      },
      context
    );
  }

  /**
   * Factory method desde error de Resend
   */
  static fromResendError(error: any, context?: EmailSendContext): EmailServiceException {
    const provider = 'resend';
    
    // Mapear errores específicos de Resend
    if (error.name === 'validation_error') {
      return EmailServiceException.invalidEmail(provider, error.message, context);
    }
    
    if (error.name === 'rate_limit_exceeded') {
      return EmailServiceException.rateLimitExceeded(provider, undefined, context);
    }
    
    if (error.name === 'invalid_access') {
      return EmailServiceException.invalidApiKey(provider, context);
    }
    
    // Error genérico
    return new EmailServiceException(
      EmailServiceErrorType.UNKNOWN_ERROR,
      `Error de Resend: ${error.message}`,
      {
        provider,
        originalError: error
      },
      context
    );
  }

  /**
   * Crea contexto de envío desde datos del formulario
   */
  static createContext(data: {
    formSubmissionId?: string;
    sessionId?: string;
    userId?: string;
    emailType?: string;
    recipients?: string[];
    sender?: string;
    subject?: string;
    template?: string;
    metadata?: Record<string, any>;
  }): EmailSendContext {
    const context: EmailSendContext = {};
    
    if (data.formSubmissionId) context.formSubmissionId = data.formSubmissionId;
    if (data.sessionId) context.sessionId = data.sessionId;
    if (data.userId) context.userId = data.userId;
    if (data.emailType) context.emailType = data.emailType;
    if (data.recipients) context.recipients = data.recipients;
    if (data.sender) context.sender = data.sender;
    if (data.subject) context.subject = data.subject;
    if (data.template) context.template = data.template;
    if (data.metadata) context.metadata = data.metadata;

    return context;
  }
}