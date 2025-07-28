// src/application/exceptions/AIServiceException.ts

/**
 * Tipos de errores del servicio de IA
 */
export enum AIServiceErrorType {
  API_CONNECTION_ERROR = 'API_CONNECTION_ERROR',
  API_TIMEOUT = 'API_TIMEOUT',
  API_RATE_LIMIT = 'API_RATE_LIMIT',
  API_QUOTA_EXCEEDED = 'API_QUOTA_EXCEEDED',
  INVALID_API_KEY = 'INVALID_API_KEY',
  INVALID_REQUEST = 'INVALID_REQUEST',
  INVALID_RESPONSE = 'INVALID_RESPONSE',
  MODEL_NOT_AVAILABLE = 'MODEL_NOT_AVAILABLE',
  CONTENT_FILTERED = 'CONTENT_FILTERED',
  TOKEN_LIMIT_EXCEEDED = 'TOKEN_LIMIT_EXCEEDED',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

/**
 * Información detallada sobre el error del servicio de IA
 */
export interface AIServiceErrorDetails {
  type: AIServiceErrorType;
  provider: string; // 'openai', 'anthropic', etc.
  model?: string;
  endpoint?: string;
  requestId?: string;
  tokenCount?: number;
  maxTokens?: number;
  retryAfter?: number;
  originalError?: any;
  timestamp: Date;
  metadata?: Record<string, any>;
}

/**
 * Contexto de la solicitud de IA
 */
export interface AIRequestContext {
  messageId?: string;
  sessionId?: string;
  userId?: string;
  prompt?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  metadata?: Record<string, any>;
}

/**
 * Excepción personalizada para errores del servicio de IA
 */
export class AIServiceException extends Error {
  public readonly errorType: AIServiceErrorType;
  public readonly details: AIServiceErrorDetails;
  public readonly context?: AIRequestContext | undefined;
  public readonly statusCode: number;
  public readonly isRetryable: boolean;
  public readonly retryAfter?: number | undefined;

  constructor(
    errorType: AIServiceErrorType,
    message: string,
    details: Partial<AIServiceErrorDetails>,
    context?: AIRequestContext
  ) {
    super(message);
    
    this.name = 'AIServiceException';
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
      Error.captureStackTrace(this, AIServiceException);
    }
  }

  /**
   * Determina el código de estado HTTP basado en el tipo de error
   */
  private getStatusCodeForErrorType(errorType: AIServiceErrorType): number {
    switch (errorType) {
      case AIServiceErrorType.INVALID_API_KEY:
        return 401;
      case AIServiceErrorType.API_RATE_LIMIT:
      case AIServiceErrorType.API_QUOTA_EXCEEDED:
        return 429;
      case AIServiceErrorType.INVALID_REQUEST:
      case AIServiceErrorType.TOKEN_LIMIT_EXCEEDED:
      case AIServiceErrorType.CONTENT_FILTERED:
        return 400;
      case AIServiceErrorType.MODEL_NOT_AVAILABLE:
        return 404;
      case AIServiceErrorType.SERVICE_UNAVAILABLE:
      case AIServiceErrorType.API_CONNECTION_ERROR:
      case AIServiceErrorType.API_TIMEOUT:
        return 503;
      default:
        return 500;
    }
  }

  /**
   * Determina si el error es reintentable
   */
  private isErrorRetryable(errorType: AIServiceErrorType): boolean {
    const retryableErrors = [
      AIServiceErrorType.API_CONNECTION_ERROR,
      AIServiceErrorType.API_TIMEOUT,
      AIServiceErrorType.API_RATE_LIMIT,
      AIServiceErrorType.SERVICE_UNAVAILABLE
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
      case AIServiceErrorType.API_RATE_LIMIT:
        return 60000; // 1 minuto
      case AIServiceErrorType.API_CONNECTION_ERROR:
        return 5000; // 5 segundos
      case AIServiceErrorType.API_TIMEOUT:
        return 10000; // 10 segundos
      case AIServiceErrorType.SERVICE_UNAVAILABLE:
        return 30000; // 30 segundos
      default:
        return 5000;
    }
  }

  /**
   * Obtiene información sobre límites y uso
   */
  getUsageInfo(): Record<string, any> {
    return {
      tokenCount: this.details.tokenCount,
      maxTokens: this.details.maxTokens,
      model: this.details.model,
      provider: this.details.provider,
      rateLimited: this.errorType === AIServiceErrorType.API_RATE_LIMIT,
      quotaExceeded: this.errorType === AIServiceErrorType.API_QUOTA_EXCEEDED
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
        type: 'AIServiceError',
        message: this.message,
        code: this.errorType,
        statusCode: this.statusCode,
        isRetryable: this.isRetryable,
        retryAfter: this.retryAfter,
        provider: this.details.provider,
        model: this.details.model
      },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Factory method para error de conexión API
   */
  static connectionError(
    provider: string,
    endpoint?: string,
    originalError?: any,
    context?: AIRequestContext
  ): AIServiceException {
    const details: Partial<AIServiceErrorDetails> = {
      provider,
      originalError
    };
    
    if (endpoint) {
      details.endpoint = endpoint;
    }

    return new AIServiceException(
      AIServiceErrorType.API_CONNECTION_ERROR,
      `No se pudo conectar al servicio de IA de ${provider}`,
      details,
      context
    );
  }

  /**
   * Factory method para timeout de API
   */
  static timeout(
    provider: string,
    timeoutMs: number,
    context?: AIRequestContext
  ): AIServiceException {
    return new AIServiceException(
      AIServiceErrorType.API_TIMEOUT,
      `Timeout al conectar con ${provider} (${timeoutMs}ms)`,
      {
        provider,
        metadata: { timeoutMs }
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
    context?: AIRequestContext
  ): AIServiceException {
    const details: Partial<AIServiceErrorDetails> = { provider };
    
    if (retryAfter !== undefined) {
      details.retryAfter = retryAfter;
    }

    return new AIServiceException(
      AIServiceErrorType.API_RATE_LIMIT,
      `Rate limit excedido para ${provider}`,
      details,
      context
    );
  }

  /**
   * Factory method para quota excedida
   */
  static quotaExceeded(
    provider: string,
    context?: AIRequestContext
  ): AIServiceException {
    return new AIServiceException(
      AIServiceErrorType.API_QUOTA_EXCEEDED,
      `Quota de API excedida para ${provider}`,
      {
        provider
      },
      context
    );
  }

  /**
   * Factory method para API key inválida
   */
  static invalidApiKey(
    provider: string,
    context?: AIRequestContext
  ): AIServiceException {
    return new AIServiceException(
      AIServiceErrorType.INVALID_API_KEY,
      `API key inválida para ${provider}`,
      {
        provider
      },
      context
    );
  }

  /**
   * Factory method para límite de tokens excedido
   */
  static tokenLimitExceeded(
    provider: string,
    tokenCount: number,
    maxTokens: number,
    context?: AIRequestContext
  ): AIServiceException {
    return new AIServiceException(
      AIServiceErrorType.TOKEN_LIMIT_EXCEEDED,
      `Límite de tokens excedido: ${tokenCount}/${maxTokens}`,
      {
        provider,
        tokenCount,
        maxTokens
      },
      context
    );
  }

  /**
   * Factory method para contenido filtrado
   */
  static contentFiltered(
    provider: string,
    reason?: string,
    context?: AIRequestContext
  ): AIServiceException {
    const message = reason 
      ? `Contenido filtrado por ${provider}: ${reason}`
      : `Contenido filtrado por ${provider}`;
    
    return new AIServiceException(
      AIServiceErrorType.CONTENT_FILTERED,
      message,
      {
        provider,
        metadata: { filterReason: reason }
      },
      context
    );
  }

  /**
   * Factory method para modelo no disponible
   */
  static modelNotAvailable(
    provider: string,
    model: string,
    context?: AIRequestContext
  ): AIServiceException {
    return new AIServiceException(
      AIServiceErrorType.MODEL_NOT_AVAILABLE,
      `Modelo '${model}' no disponible en ${provider}`,
      {
        provider,
        model
      },
      context
    );
  }

  /**
   * Factory method para respuesta inválida
   */
  static invalidResponse(
    provider: string,
    reason?: string,
    context?: AIRequestContext
  ): AIServiceException {
    const message = reason
      ? `Respuesta inválida de ${provider}: ${reason}`
      : `Respuesta inválida de ${provider}`;

    return new AIServiceException(
      AIServiceErrorType.INVALID_RESPONSE,
      message,
      {
        provider,
        metadata: { reason }
      },
      context
    );
  }

  /**
   * Factory method para servicio no disponible
   */
  static serviceUnavailable(
    provider: string,
    context?: AIRequestContext
  ): AIServiceException {
    return new AIServiceException(
      AIServiceErrorType.SERVICE_UNAVAILABLE,
      `Servicio de ${provider} temporalmente no disponible`,
      {
        provider
      },
      context
    );
  }

  /**
   * Factory method para errores desconocidos
   */
  static unknown(
    provider: string,
    originalError?: any,
    context?: AIRequestContext
  ): AIServiceException {
    const message = originalError?.message 
      ? `Error desconocido en ${provider}: ${originalError.message}`
      : `Error desconocido en ${provider}`;

    return new AIServiceException(
      AIServiceErrorType.UNKNOWN_ERROR,
      message,
      {
        provider,
        originalError
      },
      context
    );
  }

  /**
   * Factory method desde error de OpenAI
   */
  static fromOpenAIError(error: any, context?: AIRequestContext): AIServiceException {
    const provider = 'openai';
    
    // Mapear errores específicos de OpenAI
    if (error.code === 'rate_limit_exceeded') {
      return AIServiceException.rateLimitExceeded(provider, error.retry_after, context);
    }
    
    if (error.code === 'insufficient_quota') {
      return AIServiceException.quotaExceeded(provider, context);
    }
    
    if (error.code === 'invalid_api_key') {
      return AIServiceException.invalidApiKey(provider, context);
    }
    
    if (error.code === 'model_not_found') {
      return AIServiceException.modelNotAvailable(provider, error.model, context);
    }
    
    if (error.code === 'content_filter') {
      return AIServiceException.contentFiltered(provider, error.message, context);
    }
    
    if (error.code === 'context_length_exceeded') {
      return AIServiceException.tokenLimitExceeded(
        provider,
        error.usage?.total_tokens || 0,
        error.max_tokens || 0,
        context
      );
    }
    
    // Error genérico
    return AIServiceException.unknown(provider, error, context);
  }

  /**
   * Crea contexto de request desde datos del mensaje
   */
  static createContext(data: {
    messageId?: string;
    sessionId?: string;
    userId?: string;
    prompt?: string;
    model?: string;
    temperature?: number;
    maxTokens?: number;
    metadata?: Record<string, any>;
  }): AIRequestContext {
    const context: AIRequestContext = {};
    
    if (data.messageId) context.messageId = data.messageId;
    if (data.sessionId) context.sessionId = data.sessionId;
    if (data.userId) context.userId = data.userId;
    if (data.prompt) context.prompt = data.prompt.substring(0, 100); // Solo los primeros 100 caracteres para logs
    if (data.model) context.model = data.model;
    if (data.temperature !== undefined) context.temperature = data.temperature;
    if (data.maxTokens !== undefined) context.maxTokens = data.maxTokens;
    if (data.metadata) context.metadata = data.metadata;

    return context;
  }
}