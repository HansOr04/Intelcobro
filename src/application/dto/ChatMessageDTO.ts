// src/application/dto/ChatMessageDTO.ts

import { MessageType } from '../../domain/enums/MessageType';

/**
 * DTO para recibir mensajes del cliente
 */
export interface ChatMessageRequestDTO {
  sessionId: string;
  message: string;
  isVoice?: boolean;
  userId?: string;
  audioData?: string; // Base64 encoded audio data
  metadata?: Record<string, any>;
}

/**
 * DTO para enviar mensajes al cliente
 */
export interface ChatMessageResponseDTO {
  id: string;
  sessionId: string;
  type: MessageType;
  message: string;
  timestamp: string;
  isVoice: boolean;
  audioUrl?: string | undefined; // Hacer explícito que puede ser undefined
  metadata?: Record<string, any> | undefined; // Hacer explícito que puede ser undefined
  userId?: string | undefined; // Hacer explícito que puede ser undefined
}

/**
 * DTO para el historial de mensajes
 */
export interface ChatHistoryDTO {
  sessionId: string;
  messages: ChatMessageResponseDTO[];
  totalMessages: number;
  hasMore: boolean;
  lastMessageTimestamp?: string;
}

/**
 * DTO para configuración de chat
 */
export interface ChatConfigDTO {
  maxMessageLength: number;
  supportedLanguages: string[];
  voiceEnabled: boolean;
  maxHistoryMessages: number;
  sessionTimeout: number;
}

/**
 * DTO para estadísticas de chat
 */
export interface ChatStatsDTO {
  sessionId: string;
  totalMessages: number;
  userMessages: number;
  assistantMessages: number;
  averageResponseTime: number;
  sessionDuration: number;
  lastActivity: string;
}

/**
 * DTO para buscar en el historial de chat
 */
export interface ChatSearchRequestDTO {
  sessionId?: string;
  query: string;
  messageType?: MessageType;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

/**
 * DTO para resultados de búsqueda en chat
 */
export interface ChatSearchResponseDTO {
  results: ChatMessageResponseDTO[];
  totalResults: number;
  query: string;
  searchTime: number;
}

/**
 * DTO para validación de mensajes
 */
export interface MessageValidationDTO {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  sanitizedMessage?: string | undefined;
}

/**
 * DTO para configuración de voz
 */
export interface VoiceConfigDTO {
  voiceId: string;
  language: string;
  speed: number;
  pitch: number;
  volume: number;
}

/**
 * DTO para respuesta de procesamiento de voz
 */
export interface VoiceProcessingDTO {
  success: boolean;
  transcribedText?: string;
  audioUrl?: string;
  processingTime: number;
  error?: string;
}

/**
 * Funciones de validación para DTOs
 */
export class ChatMessageDTOValidator {
  /**
   * Valida un ChatMessageRequestDTO
   */
  static validateChatMessageRequest(dto: any): MessageValidationDTO {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validaciones obligatorias
    if (!dto.sessionId || typeof dto.sessionId !== 'string') {
      errors.push('sessionId es requerido y debe ser string');
    }

    if (!dto.message || typeof dto.message !== 'string') {
      errors.push('message es requerido y debe ser string');
    }

    // Validaciones de formato
    if (dto.sessionId && dto.sessionId.trim().length === 0) {
      errors.push('sessionId no puede estar vacío');
    }

    if (dto.message && dto.message.trim().length === 0) {
      errors.push('message no puede estar vacío');
    }

    if (dto.message && dto.message.length > 10000) {
      errors.push('message no puede exceder 10,000 caracteres');
    }

    // Validaciones opcionales
    if (dto.isVoice !== undefined && typeof dto.isVoice !== 'boolean') {
      warnings.push('isVoice debe ser boolean');
    }

    if (dto.userId !== undefined && typeof dto.userId !== 'string') {
      warnings.push('userId debe ser string');
    }

    if (dto.audioData !== undefined && typeof dto.audioData !== 'string') {
      warnings.push('audioData debe ser string (base64)');
    }

    if (dto.metadata !== undefined && typeof dto.metadata !== 'object') {
      warnings.push('metadata debe ser objeto');
    }

    // Sanitización del mensaje
    let sanitizedMessage: string | undefined;
    if (dto.message && typeof dto.message === 'string') {
      sanitizedMessage = dto.message.trim().replace(/\s+/g, ' ');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      sanitizedMessage
    };
  }

  /**
   * Valida un ChatSearchRequestDTO
   */
  static validateChatSearchRequest(dto: any): MessageValidationDTO {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Query es obligatorio
    if (!dto.query || typeof dto.query !== 'string') {
      errors.push('query es requerido y debe ser string');
    }

    if (dto.query && dto.query.trim().length === 0) {
      errors.push('query no puede estar vacío');
    }

    if (dto.query && dto.query.length > 500) {
      errors.push('query no puede exceder 500 caracteres');
    }

    // Validaciones opcionales
    if (dto.sessionId !== undefined && typeof dto.sessionId !== 'string') {
      warnings.push('sessionId debe ser string');
    }

    if (dto.messageType !== undefined && !Object.values(MessageType).includes(dto.messageType)) {
      warnings.push('messageType no es válido');
    }

    if (dto.limit !== undefined && (typeof dto.limit !== 'number' || dto.limit < 1 || dto.limit > 100)) {
      warnings.push('limit debe ser número entre 1 y 100');
    }

    if (dto.offset !== undefined && (typeof dto.offset !== 'number' || dto.offset < 0)) {
      warnings.push('offset debe ser número mayor o igual a 0');
    }

    // Validar fechas
    if (dto.startDate !== undefined) {
      const startDate = new Date(dto.startDate);
      if (isNaN(startDate.getTime())) {
        warnings.push('startDate debe ser fecha válida');
      }
    }

    if (dto.endDate !== undefined) {
      const endDate = new Date(dto.endDate);
      if (isNaN(endDate.getTime())) {
        warnings.push('endDate debe ser fecha válida');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Sanitiza un mensaje de chat
   */
  static sanitizeMessage(message: string): string {
    if (!message || typeof message !== 'string') {
      return '';
    }

    return message
      .trim()
      .replace(/\s+/g, ' ') // Múltiples espacios a uno solo
      .replace(/[^\w\s.,;:!?¿¡áéíóúñü\-()]/gi, '') // Solo caracteres permitidos
      .substring(0, 10000); // Limitar longitud
  }

  /**
   * Genera un sessionId válido si no se proporciona
   */
  static generateSessionId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 12);
    return `chat_${timestamp}_${random}`;
  }
}

/**
 * Funciones helper para trabajar con DTOs
 */
export class ChatMessageDTOHelper {
  /**
   * Convierte ChatMessageRequestDTO a formato normalizado
   */
  static normalizeChatMessageRequest(dto: ChatMessageRequestDTO): ChatMessageRequestDTO {
    const normalized: ChatMessageRequestDTO = {
      sessionId: dto.sessionId.trim(),
      message: ChatMessageDTOValidator.sanitizeMessage(dto.message),
      isVoice: dto.isVoice || false,
      metadata: dto.metadata || {}
    };

    if (dto.userId?.trim()) {
      normalized.userId = dto.userId.trim();
    }

    if (dto.audioData?.trim()) {
      normalized.audioData = dto.audioData.trim();
    }

    return normalized;
  }

  /**
   * Convierte datos de entidad a ChatMessageResponseDTO
   */
  static toResponseDTO(messageData: {
    id: string;
    sessionId: string;
    type: MessageType;
    message: string;
    timestamp: Date;
    isVoice: boolean;
    audioUrl?: string;
    metadata?: Record<string, any>;
    userId?: string;
  }): ChatMessageResponseDTO {
    const response: ChatMessageResponseDTO = {
      id: messageData.id,
      sessionId: messageData.sessionId,
      type: messageData.type,
      message: messageData.message,
      timestamp: messageData.timestamp.toISOString(),
      isVoice: messageData.isVoice
    };

    if (messageData.audioUrl) {
      response.audioUrl = messageData.audioUrl;
    }

    if (messageData.metadata) {
      response.metadata = messageData.metadata;
    }

    if (messageData.userId) {
      response.userId = messageData.userId;
    }

    return response;
  }

  /**
   * Crea un DTO de error estándar
   */
  static createErrorResponse(sessionId: string, errorMessage: string): ChatMessageResponseDTO {
    return {
      id: `error_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      sessionId,
      type: MessageType.ERROR,
      message: errorMessage,
      timestamp: new Date().toISOString(),
      isVoice: false,
      metadata: {
        isError: true,
        generatedAt: new Date().toISOString()
      }
    };
  }

  /**
   * Crea configuración por defecto de chat
   */
  static getDefaultChatConfig(): ChatConfigDTO {
    return {
      maxMessageLength: 10000,
      supportedLanguages: ['es', 'en'],
      voiceEnabled: true,
      maxHistoryMessages: 50,
      sessionTimeout: 30 * 60 * 1000 // 30 minutos
    };
  }

  /**
   * Crea configuración por defecto de voz
   */
  static getDefaultVoiceConfig(): VoiceConfigDTO {
    return {
      voiceId: 'default',
      language: 'es-ES',
      speed: 1.0,
      pitch: 1.0,
      volume: 1.0
    };
  }
}