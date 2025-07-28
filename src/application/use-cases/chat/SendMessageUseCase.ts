// src/application/use-cases/chat/SendMessageUseCase.ts

import { ChatMessage } from '../../../domain/entities/ChatMessage';
import { MessageType, getResponseMessageType } from '../../../domain/enums/MessageType';
import { ChatMessageRequestDTO, ChatMessageResponseDTO } from '../../dto/ChatMessageDTO';
import { IAIService, AIMessageContext, AIMessage } from '../../interfaces/services/IAIService';
import { ITextToSpeechService, SpeechSynthesisConfig } from '../../interfaces/services/ITextToSpeechService';
import { ValidationException } from '../../exceptions/ValidationException';
import { AIServiceException } from '../../exceptions/AIServiceException';
import { logger } from '../../../shared/utils/Logger';
import { randomGenerator } from '../../../shared/utils/RandomGenerator';

/**
 * Opciones para el caso de uso de envío de mensaje
 */
export interface SendMessageOptions {
  generateAudio?: boolean;
  saveToHistory?: boolean;
  includeContext?: boolean;
  maxHistoryMessages?: number;
  customPrompt?: string;
  metadata?: Record<string, any>;
}

/**
 * Resultado del envío de mensaje
 */
export interface SendMessageResult {
  userMessage: ChatMessageResponseDTO;
  assistantMessage: ChatMessageResponseDTO;
  audioUrl?: string | undefined;
  processingTime: number;
  tokensUsed?: number | undefined;
  confidence?: number | undefined;
  metadata?: Record<string, any> | undefined;
}

/**
 * Contexto para el procesamiento del mensaje
 */
interface MessageProcessingContext {
  sessionId: string;
  userId?: string | undefined;
  messageHistory: ChatMessage[];
  userProfile?: Record<string, any> | undefined;
  businessContext: string;
  language: string;
  isVoiceMessage: boolean;
  audioData?: Buffer | undefined;
}

/**
 * Caso de uso para enviar y procesar mensajes del chat
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
      
      // Crear mensaje del usuario
      const userMessage = this.createUserMessage(request, context);
      
      // Generar respuesta de IA
      const aiResponse = await this.generateAIResponse(userMessage, context, options);
      
      // Crear mensaje del asistente
      const assistantMessage = this.createAssistantMessage(aiResponse, context);
      
      // Generar audio si es necesario
      const audioUrl = await this.generateAudioIfNeeded(
        assistantMessage,
        context,
        options
      );
      
      // Calcular tiempo de procesamiento
      const processingTime = Date.now() - startTime;
      
      // Log del resultado
      logger.info('Mensaje procesado exitosamente', {
        sessionId: request.sessionId,
        userId: request.userId,
        processingTime,
        tokensUsed: aiResponse.tokensUsed?.total,
        hasAudio: !!audioUrl
      });
      
      return {
        userMessage: this.toResponseDTO(userMessage),
        assistantMessage: this.toResponseDTO(assistantMessage, audioUrl),
        audioUrl: audioUrl || undefined,
        processingTime,
        tokensUsed: aiResponse.tokensUsed?.total || undefined,
        confidence: aiResponse.confidence || undefined,
        metadata: {
          aiModel: aiResponse.model,
          finishReason: aiResponse.finishReason,
          messageId: assistantMessage.id,
          ...options.metadata
        }
      };
      
    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      // Log del error
      logger.error('Error al procesar mensaje', error as Error, {
        sessionId: request.sessionId,
        userId: request.userId,
        processingTime,
        errorType: error instanceof AIServiceException ? 'AI_SERVICE' : 'UNKNOWN'
      });
      
      // Re-lanzar el error
      throw error;
    }
  }

  /**
   * Valida la solicitud de entrada
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

    if (request.isVoice && !request.audioData) {
      throw ValidationException.businessRuleViolation(
        'Los mensajes de voz requieren datos de audio',
        'audioData'
      );
    }
  }

  /**
   * Crea el contexto de procesamiento del mensaje
   */
  private async createProcessingContext(
    request: ChatMessageRequestDTO,
    options: SendMessageOptions
  ): Promise<MessageProcessingContext> {
    // En una implementación real, esto vendría de un repositorio
    const messageHistory: ChatMessage[] = [];
    
    const context: MessageProcessingContext = {
      sessionId: request.sessionId,
      userId: request.userId || undefined,
      messageHistory,
      businessContext: this.getBusinessContext(),
      language: 'es',
      isVoiceMessage: request.isVoice || false,
      audioData: request.audioData ? Buffer.from(request.audioData, 'base64') : undefined
    };

    // Cargar perfil de usuario si está disponible
    if (request.userId) {
      context.userProfile = await this.loadUserProfile(request.userId);
    }

    return context;
  }

  /**
   * Crea el mensaje del usuario
   */
  private createUserMessage(
    request: ChatMessageRequestDTO,
    context: MessageProcessingContext
  ): ChatMessage {
    const messageId = randomGenerator.generateId(12);
    const messageType = request.isVoice ? MessageType.USER_VOICE : MessageType.USER_TEXT;

    return new ChatMessage(
      messageId,
      request.sessionId,
      messageType,
      request.message,
      request.isVoice || false,
      {
        ...request.metadata,
        userAgent: context.userProfile?.userAgent,
        processingStarted: new Date().toISOString()
      },
      request.userId,
      undefined,
      context.audioData
    );
  }

  /**
   * Genera respuesta usando el servicio de IA
   */
  private async generateAIResponse(
    userMessage: ChatMessage,
    context: MessageProcessingContext,
    options: SendMessageOptions
  ) {
    // Crear contexto para IA
    const aiContext: AIMessageContext = {
      sessionId: context.sessionId,
      userId: context.userId || undefined,
      messageHistory: this.convertToAIMessages(context.messageHistory),
      userProfile: context.userProfile || undefined,
      businessContext: options.customPrompt || context.businessContext,
      language: context.language,
      metadata: {
        isVoiceMessage: context.isVoiceMessage,
        messageType: userMessage.type
      }
    };

    try {
      return await this.aiService.generateResponse(
        userMessage.message,
        aiContext,
        {
          temperature: 0.7,
          maxTokens: 1000,
          model: 'gpt-3.5-turbo'
        }
      );
    } catch (error) {
      if (error instanceof AIServiceException) {
        throw error;
      }
      
      throw AIServiceException.unknown('openai', error, {
        messageId: userMessage.id,
        sessionId: context.sessionId,
        userId: context.userId || undefined,
        prompt: userMessage.message.substring(0, 100)
      });
    }
  }

  /**
   * Crea el mensaje del asistente
   */
  private createAssistantMessage(
    aiResponse: any,
    context: MessageProcessingContext
  ): ChatMessage {
    const messageId = randomGenerator.generateId(12);
    const responseType = getResponseMessageType(
      context.isVoiceMessage ? MessageType.USER_VOICE : MessageType.USER_TEXT
    );

    return new ChatMessage(
      messageId,
      context.sessionId,
      responseType,
      aiResponse.content,
      responseType === MessageType.ASSISTANT_VOICE,
      {
        aiModel: aiResponse.model,
        tokensUsed: aiResponse.tokensUsed?.total,
        confidence: aiResponse.confidence,
        finishReason: aiResponse.finishReason,
        generatedAt: new Date().toISOString()
      }
    );
  }

  /**
   * Genera audio si es necesario
   */
  private async generateAudioIfNeeded(
    assistantMessage: ChatMessage,
    context: MessageProcessingContext,
    options: SendMessageOptions
  ): Promise<string | undefined> {
    if (!options.generateAudio || !this.ttsService) {
      return undefined;
    }

    if (!assistantMessage.isVoice) {
      return undefined;
    }

    try {
      const ttsConfig: SpeechSynthesisConfig = {
        voice: {
          voiceId: 'es-ES-female-1',
          language: 'es-ES',
          gender: 'female',
          style: 'conversational'
        },
        speed: 1.0,
        pitch: 1.0,
        volume: 1.0,
        format: 'mp3',
        sampleRate: 22050
      };

      const result = await this.ttsService.synthesize({
        text: assistantMessage.message,
        config: ttsConfig,
        metadata: {
          messageId: assistantMessage.id,
          sessionId: context.sessionId
        }
      });

      // En una implementación real, subirías el audio a un servicio de almacenamiento
      // y devolverías la URL pública
      return `https://audio.intelcobro.com/${assistantMessage.id}.mp3`;
      
    } catch (error) {
      logger.warn('Error al generar audio, continuando sin audio', {
        messageId: assistantMessage.id,
        error: (error as Error).message
      });
      return undefined;
    }
  }

  /**
   * Convierte mensajes del dominio a formato de IA
   */
  private convertToAIMessages(messages: ChatMessage[]): AIMessage[] {
    return messages.map(msg => ({
      role: msg.isUserMessage() ? 'user' as const : 'assistant' as const,
      content: msg.message,
      timestamp: msg.timestamp
    }));
  }

  /**
   * Convierte mensaje del dominio a DTO de respuesta
   */
  private toResponseDTO(message: ChatMessage, audioUrl?: string): ChatMessageResponseDTO {
    return {
      id: message.id,
      sessionId: message.sessionId,
      type: message.type,
      message: message.message,
      timestamp: message.timestamp.toISOString(),
      isVoice: message.isVoice,
      audioUrl: audioUrl || undefined,
      metadata: message.metadata || undefined,
      userId: message.userId || undefined
    };
  }

  /**
   * Obtiene el contexto de negocio para la IA
   */
  private getBusinessContext(): string {
    return `Eres un asistente virtual profesional de Intelcobro, una empresa especializada en desarrollo de software y soluciones tecnológicas.

Características:
- Profesional pero amigable
- Experto en tecnología y desarrollo
- Ayudas con consultas sobre servicios, presupuestos y desarrollo
- Respuestas concisas e informativas
- Siempre positivo y constructivo

Servicios de Intelcobro:
- Desarrollo web y móvil
- Sistemas de gestión empresarial
- E-commerce y tiendas online
- Consultoría en transformación digital
- Mantenimiento y soporte técnico

Responde en español y mantén un tono profesional pero cercano.`;
  }

  /**
   * Carga el perfil del usuario (simulado)
   */
  private async loadUserProfile(userId: string): Promise<Record<string, any> | undefined> {
    // En una implementación real, esto vendría de una base de datos
    return {
      userId,
      preferences: {
        language: 'es',
        voiceEnabled: true
      },
      interactionCount: 1,
      lastSeen: new Date()
    };
  }

  /**
   * Maneja errores y genera respuesta de fallback
   */
  async handleError(
    request: ChatMessageRequestDTO,
    error: Error
  ): Promise<ChatMessageResponseDTO> {
    const errorMessage = error instanceof ValidationException 
      ? 'Lo siento, hay un problema con tu mensaje. Por favor, verifica que esté completo y vuelve a intentarlo.'
      : error instanceof AIServiceException
      ? 'Lo siento, estoy teniendo dificultades técnicas en este momento. Por favor, inténtalo de nuevo en unos minutos.'
      : 'Lo siento, ha ocurrido un error inesperado. Por favor, inténtalo de nuevo.';

    return ChatMessage.createErrorMessage(request.sessionId, errorMessage).toJSON() as ChatMessageResponseDTO;
  }

  /**
   * Obtiene estadísticas del procesamiento de mensajes
   */
  async getProcessingStats(sessionId: string): Promise<{
    totalMessages: number;
    averageResponseTime: number;
    successRate: number;
    aiTokensUsed: number;
    audioGenerated: number;
  }> {
    // En una implementación real, esto vendría de métricas almacenadas
    return {
      totalMessages: 0,
      averageResponseTime: 0,
      successRate: 100,
      aiTokensUsed: 0,
      audioGenerated: 0
    };
  }
}