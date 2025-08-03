// src/application/use-cases/chat/SendMessageUseCase.ts

import { ChatMessage } from '../../../domain/entities/ChatMessage';
import { MessageType, getResponseMessageType } from '../../../domain/enums/MessageType';
import { ChatMessageRequestDTO, ChatMessageResponseDTO } from '../../dto/ChatMessageDTO';
import { IAIService, AIMessageContext } from '../../interfaces/services/IAIService';
import { ITextToSpeechService } from '../../interfaces/services/ITextToSpeechService';
import { ValidationException } from '../../exceptions/ValidationException';
import { AIServiceException, AIRequestContext } from '../../exceptions/AIServiceException';
import { logger } from '../../../shared/utils/Logger';
import { randomGenerator } from '../../../shared/utils/RandomGenerator';

/**
 * Opciones para el caso de uso de envío de mensaje
 */
export interface SendMessageOptions {
  generateVoiceResponse?: boolean | undefined;
  includeContext?: boolean | undefined;
  saveMessage?: boolean | undefined;
  logInteraction?: boolean | undefined;
  maxResponseLength?: number | undefined;
  temperature?: number | undefined;
  metadata?: Record<string, any> | undefined;
}

/**
 * Resultado del envío de mensaje
 */
export interface SendMessageResult {
  userMessage: ChatMessageResponseDTO;
  assistantResponse: ChatMessageResponseDTO;
  processingTime: number;
  tokensUsed?: {
    prompt: number;
    completion: number;
    total: number;
  };
  voiceGenerated: boolean;
  contextUsed: boolean;
  confidence?: number;
  metadata?: Record<string, any>;
}

/**
 * Contexto de conversación para el usuario
 */
interface ConversationContext {
  sessionId: string;
  userId?: string | undefined;
  messageHistory: ChatMessage[];
  userProfile?: Record<string, any> | undefined;
  preferences?: {
    language: string;
    voiceEnabled: boolean;
    responseStyle: 'formal' | 'casual' | 'technical';
  } | undefined;
}

/**
 * Contexto de procesamiento del mensaje
 */
interface MessageProcessingContext {
  userMessage: ChatMessage;
  conversationContext: ConversationContext;
  aiContext: AIMessageContext;
  shouldGenerateVoice: boolean;
  responseType: MessageType;
  processingMetadata: Record<string, any>;
}

/**
 * Caso de uso para procesar mensajes del chat
 */
export class SendMessageUseCase {
  constructor(
    private readonly aiService: IAIService,
    private readonly ttsService?: ITextToSpeechService
  ) {}

  /**
   * Ejecuta el caso de uso de envío de mensaje
   */
  async execute(
    request: ChatMessageRequestDTO,
    options: SendMessageOptions = {}
  ): Promise<SendMessageResult> {
    const startTime = Date.now();
    
    try {
      // Validar entrada
      this.validateRequest(request);
      
      // Crear contexto de procesamiento
      const context = await this.createProcessingContext(request, options);
      
      // Procesar el mensaje del usuario
      const userMessage = await this.processUserMessage(context, options);
      
      // Generar respuesta del asistente
      const assistantMessage = await this.generateAssistantResponse(context, options);
      
      // Generar audio si está habilitado
      const voiceGenerated = await this.generateVoiceResponse(assistantMessage, context, options);
      
      // Guardar mensajes si está habilitado
      if (options.saveMessage !== false) {
        await this.saveMessages(userMessage, assistantMessage);
      }
      
      // Log de la interacción si está habilitado
      if (options.logInteraction !== false) {
        this.logInteraction(userMessage, assistantMessage, context);
      }
      
      const processingTime = Date.now() - startTime;
      
      return {
        userMessage: this.toResponseDTO(userMessage),
        assistantResponse: this.toResponseDTO(assistantMessage),
        processingTime,
        tokensUsed: context.processingMetadata.tokensUsed,
        voiceGenerated,
        contextUsed: context.conversationContext.messageHistory.length > 0,
        confidence: context.processingMetadata.confidence,
        metadata: {
          messageCount: context.conversationContext.messageHistory.length + 1,
          responseType: context.responseType,
          ...options.metadata
        }
      };
      
    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      logger.error('Error al procesar mensaje de chat', error as Error, {
        sessionId: request.sessionId,
        userId: request.userId,
        messageLength: request.message.length,
        processingTime
      });
      
      // Crear respuesta de error para el usuario
      const errorResponse = this.createErrorResponse(request, error as Error);
      
      return {
        userMessage: this.createUserMessageResponse(request),
        assistantResponse: errorResponse,
        processingTime,
        voiceGenerated: false,
        contextUsed: false,
        metadata: {
          error: true,
          errorType: (error as Error).constructor.name,
          errorMessage: (error as Error).message
        }
      };
    }
  }

  /**
   * Valida la solicitud de mensaje
   */
  private validateRequest(request: ChatMessageRequestDTO): void {
    if (!request.sessionId || request.sessionId.trim().length === 0) {
      throw ValidationException.requiredField('sessionId');
    }

    if (!request.message || request.message.trim().length === 0) {
      throw ValidationException.requiredField('message');
    }

    if (request.message.length > 10000) {
      throw ValidationException.invalidLength('message', undefined, 10000, request.message.length);
    }

    if (request.sessionId.length > 100) {
      throw ValidationException.invalidLength('sessionId', undefined, 100, request.sessionId.length);
    }
  }

  /**
   * Crea el contexto de procesamiento
   */
  private async createProcessingContext(
    request: ChatMessageRequestDTO,
    options: SendMessageOptions
  ): Promise<MessageProcessingContext> {
    // Crear mensaje del usuario
    const messageId = randomGenerator.generateId(16);
    const messageType = request.isVoice ? MessageType.USER_VOICE : MessageType.USER_TEXT;
    
    const userMessage = new ChatMessage(
      messageId,
      request.sessionId,
      messageType,
      request.message,
      request.isVoice || false,
      {
        audioData: request.audioData,
        originalRequest: true,
        ...request.metadata
      },
      request.userId,
      undefined, // audioUrl se generará después si es necesario
      request.audioData ? Buffer.from(request.audioData, 'base64') : undefined
    );

    // Cargar contexto de conversación
    const conversationContext = await this.loadConversationContext(request);
    
    // Crear contexto de IA
    const aiContext = this.createAIContext(request, conversationContext);
    
    // Determinar tipo de respuesta
    const responseType = getResponseMessageType(messageType);
    const shouldGenerateVoice = (options.generateVoiceResponse !== false && 
                               (request.isVoice || conversationContext.preferences?.voiceEnabled)) || false;

    return {
      userMessage,
      conversationContext,
      aiContext,
      shouldGenerateVoice,
      responseType,
      processingMetadata: {
        requestReceived: new Date().toISOString(),
        options
      }
    };
  }

  /**
   * Procesa el mensaje del usuario
   */
  private async processUserMessage(
    context: MessageProcessingContext,
    options: SendMessageOptions
  ): Promise<ChatMessage> {
    // El mensaje ya está creado en el contexto
    const message = context.userMessage;
    
    // Añadir al historial de conversación
    context.conversationContext.messageHistory.push(message);
    
    // Análisis adicional del mensaje si es necesario
    if (options.includeContext !== false) {
      try {
        const sentiment = await this.aiService.analyzeSentiment(message.message);
        context.processingMetadata.sentiment = sentiment;
      } catch (error) {
        logger.warn('Error analizando sentimiento del mensaje', {
          messageId: message.id,
          error: (error as Error).message
        });
      }
    }

    return message;
  }

  /**
   * Genera la respuesta del asistente
   */
  private async generateAssistantResponse(
    context: MessageProcessingContext,
    options: SendMessageOptions
  ): Promise<ChatMessage> {
    try {
      const aiResponse = await this.aiService.generateResponse(
        context.userMessage.message,
        context.aiContext,
        {
          temperature: options.temperature || 0.7,
          maxTokens: options.maxResponseLength || 1000
        }
      );

      // Almacenar información de tokens usados
      context.processingMetadata.tokensUsed = aiResponse.tokensUsed;
      context.processingMetadata.confidence = aiResponse.confidence;

      // Crear mensaje de respuesta
      const responseId = randomGenerator.generateId(16);
      const assistantMessage = new ChatMessage(
        responseId,
        context.userMessage.sessionId,
        context.responseType,
        aiResponse.content,
        context.shouldGenerateVoice,
        {
          originalMessageId: context.userMessage.id,
          responseToUser: context.userMessage.userId,
          aiModel: aiResponse.model,
          tokensUsed: aiResponse.tokensUsed,
          confidence: aiResponse.confidence,
          generatedAt: new Date().toISOString()
        },
        undefined, // userId no aplica para respuestas del asistente
        undefined, // audioUrl se generará después si es necesario
        undefined  // audioData se generará después si es necesario
      );

      // Añadir al historial
      context.conversationContext.messageHistory.push(assistantMessage);

      return assistantMessage;

    } catch (error) {
      if (error instanceof AIServiceException) {
        throw error;
      }
      
      const aiContext: AIRequestContext = {
        messageId: context.userMessage.id,
        sessionId: context.userMessage.sessionId,
        ...(context.userMessage.userId && { userId: context.userMessage.userId })
      };

      throw AIServiceException.unknown('openai', error, aiContext);
    }
  }

  /**
   * Genera respuesta de voz si está habilitado
   */
  private async generateVoiceResponse(
    assistantMessage: ChatMessage,
    context: MessageProcessingContext,
    options: SendMessageOptions
  ): Promise<boolean> {
    if (!context.shouldGenerateVoice || !this.ttsService) {
      return false;
    }

    try {
      const voiceConfig = {
        voice: {
          voiceId: 'es-ES-default',
          language: 'es-ES',
          gender: 'female' as const,
          style: 'conversational' as const
        },
        speed: 1.0,
        pitch: 1.0,
        volume: 1.0,
        format: 'mp3' as const,
        sampleRate: 22050
      };

      const ttsResult = await this.ttsService.synthesize({
        text: assistantMessage.message,
        config: voiceConfig,
        metadata: {
          messageId: assistantMessage.id,
          sessionId: assistantMessage.sessionId
        }
      });

      // En una implementación real, aquí guardarías el audio en un servicio de archivos
      // y obtendrías una URL. Por ahora, simulamos la URL.
      const audioUrl = `https://audio.intelcobro.com/${assistantMessage.id}.mp3`;
      
      // Actualizar el mensaje con la información de audio
      context.processingMetadata.audioGenerated = true;
      context.processingMetadata.audioUrl = audioUrl;
      context.processingMetadata.audioDuration = ttsResult.duration;

      return true;

    } catch (error) {
      logger.warn('Error generando respuesta de voz', {
        messageId: assistantMessage.id,
        error: (error as Error).message
      });
      return false;
    }
  }

  /**
   * Guarda los mensajes en el almacenamiento
   */
  private async saveMessages(userMessage: ChatMessage, assistantMessage: ChatMessage): Promise<void> {
    // En una implementación real, esto guardaría en base de datos
    logger.debug('Mensajes guardados', {
      userMessageId: userMessage.id,
      assistantMessageId: assistantMessage.id,
      sessionId: userMessage.sessionId
    });
  }

  /**
   * Registra la interacción
   */
  private logInteraction(
    userMessage: ChatMessage,
    assistantMessage: ChatMessage,
    context: MessageProcessingContext
  ): void {
    logger.info('Interacción de chat procesada', {
      sessionId: userMessage.sessionId,
      userId: userMessage.userId,
      userMessageLength: userMessage.message.length,
      assistantMessageLength: assistantMessage.message.length,
      messageType: userMessage.type,
      responseType: assistantMessage.type,
      tokensUsed: context.processingMetadata.tokensUsed?.total,
      confidence: context.processingMetadata.confidence,
      voiceGenerated: context.processingMetadata.audioGenerated || false
    });
  }

  /**
   * Carga el contexto de conversación
   */
  private async loadConversationContext(request: ChatMessageRequestDTO): Promise<ConversationContext> {
    // En una implementación real, esto cargaría desde base de datos
    return {
      sessionId: request.sessionId,
      userId: request.userId || undefined,
      messageHistory: [], // Se cargaría el historial real
      userProfile: undefined,
      preferences: {
        language: 'es',
        voiceEnabled: request.isVoice || false,
        responseStyle: 'casual'
      }
    };
  }

  /**
   * Crea el contexto para el servicio de IA
   */
  private createAIContext(
    request: ChatMessageRequestDTO,
    conversationContext: ConversationContext
  ): AIMessageContext {
    const aiMessages = conversationContext.messageHistory.map(msg => ({
      role: msg.isUserMessage() ? 'user' as const : 'assistant' as const,
      content: msg.message,
      timestamp: msg.timestamp
    }));

    return {
      sessionId: request.sessionId,
      userId: request.userId,
      messageHistory: aiMessages,
      userProfile: conversationContext.userProfile,
      businessContext: 'Eres un asistente virtual para Intelcobro, una empresa de desarrollo de software. Ayuda a los usuarios con información sobre nuestros servicios, precios, y procesos. Sé amigable y profesional.',
      language: conversationContext.preferences?.language,
      metadata: {
        isVoiceMessage: request.isVoice,
        conversationLength: conversationContext.messageHistory.length,
        timestamp: new Date().toISOString()
      }
    };
  }

  /**
   * Crea una respuesta de error
   */
  private createErrorResponse(request: ChatMessageRequestDTO, error: Error): ChatMessageResponseDTO {
    const errorId = randomGenerator.generateId(16);
    let errorMessage = 'Lo siento, ha ocurrido un error procesando tu mensaje.';

    if (error instanceof ValidationException) {
      errorMessage = 'Por favor, verifica que tu mensaje sea válido.';
    } else if (error instanceof AIServiceException) {
      if (error.isRetryable) {
        errorMessage = 'El servicio está temporalmente no disponible. Por favor, inténtalo de nuevo.';
      } else {
        errorMessage = 'No pude procesar tu solicitud en este momento.';
      }
    }

    return {
      id: errorId,
      sessionId: request.sessionId,
      type: MessageType.ERROR,
      message: errorMessage,
      timestamp: new Date().toISOString(),
      isVoice: false,
      metadata: {
        isError: true,
        originalError: error.constructor.name,
        generatedAt: new Date().toISOString()
      }
    };
  }

  /**
   * Crea respuesta del mensaje del usuario
   */
  private createUserMessageResponse(request: ChatMessageRequestDTO): ChatMessageResponseDTO {
    const messageId = randomGenerator.generateId(16);
    return {
      id: messageId,
      sessionId: request.sessionId,
      type: request.isVoice ? MessageType.USER_VOICE : MessageType.USER_TEXT,
      message: request.message,
      timestamp: new Date().toISOString(),
      isVoice: request.isVoice || false,
      userId: request.userId,
      metadata: request.metadata
    };
  }

  /**
   * Convierte mensaje a DTO de respuesta
   */
  private toResponseDTO(message: ChatMessage): ChatMessageResponseDTO {
    const response: ChatMessageResponseDTO = {
      id: message.id,
      sessionId: message.sessionId,
      type: message.type,
      message: message.message,
      timestamp: message.timestamp.toISOString(),
      isVoice: message.isVoice
    };

    // Solo agregar propiedades opcionales si existen
    if (message.audioUrl) {
      response.audioUrl = message.audioUrl;
    }

    if (message.metadata) {
      response.metadata = message.metadata;
    }

    if (message.userId) {
      response.userId = message.userId;
    }

    return response;
  }

  /**
   * Obtiene el historial de mensajes de una sesión
   */
  async getMessageHistory(
    sessionId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<{
    messages: ChatMessageResponseDTO[];
    totalMessages: number;
    hasMore: boolean;
  }> {
    // En una implementación real, esto consultaría la base de datos
    logger.info('Historial de mensajes solicitado', {
      sessionId,
      limit,
      offset
    });

    return {
      messages: [],
      totalMessages: 0,
      hasMore: false
    };
  }

  /**
   * Elimina una sesión de chat
   */
  async deleteSession(sessionId: string): Promise<void> {
    // En una implementación real, esto eliminaría de base de datos
    logger.info('Sesión de chat eliminada', { sessionId });
  }

  /**
   * Obtiene estadísticas de chat
   */
  async getChatStats(sessionId: string): Promise<{
    totalMessages: number;
    userMessages: number;
    assistantMessages: number;
    averageResponseTime: number;
    sessionDuration: number;
    lastActivity: string;
  }> {
    // En una implementación real, esto calcularía estadísticas reales
    return {
      totalMessages: 0,
      userMessages: 0,
      assistantMessages: 0,
      averageResponseTime: 0,
      sessionDuration: 0,
      lastActivity: new Date().toISOString()
    };
  }

  /**
   * Busca en el historial de mensajes
   */
  async searchMessages(
    sessionId: string,
    query: string,
    limit: number = 20
  ): Promise<{
    results: ChatMessageResponseDTO[];
    totalResults: number;
    searchTime: number;
  }> {
    const startTime = Date.now();
    
    // En una implementación real, esto haría búsqueda en base de datos
    logger.info('Búsqueda en mensajes', {
      sessionId,
      query: query.substring(0, 50), // Solo los primeros 50 caracteres para logs
      limit
    });

    const searchTime = Date.now() - startTime;

    return {
      results: [],
      totalResults: 0,
      searchTime
    };
  }

  /**
   * Configura preferencias de usuario para el chat
   */
  async updateUserPreferences(
    sessionId: string,
    userId: string | undefined,
    preferences: {
      language?: string;
      voiceEnabled?: boolean;
      responseStyle?: 'formal' | 'casual' | 'technical';
    }
  ): Promise<void> {
    // En una implementación real, esto actualizaría las preferencias en base de datos
    logger.info('Preferencias de usuario actualizadas', {
      sessionId,
      userId: userId || 'anonymous',
      preferences
    });
  }

  /**
   * Obtiene sugerencias de respuesta rápida
   */
  async getQuickReplies(
    sessionId: string,
    lastMessage?: string
  ): Promise<string[]> {
    const defaultReplies = [
      '¿Qué servicios ofrecen?',
      '¿Cuáles son sus precios?',
      '¿Cómo puedo contactarlos?',
      'Quiero una cotización',
      'Información sobre desarrollo web'
    ];

    // En una implementación real, esto podría usar IA para generar respuestas contextuales
    return defaultReplies;
  }
}