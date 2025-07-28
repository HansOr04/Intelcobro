// src/domain/entities/ChatMessage.ts

import { MessageType } from '../enums/MessageType';

/**
 * Entidad que representa un mensaje del chat
 */
export class ChatMessage {
  private readonly _id: string;
  private readonly _sessionId: string;
  private readonly _type: MessageType;
  private readonly _message: string;
  private readonly _timestamp: Date;
  private readonly _isVoice: boolean;
  private readonly _metadata?: Record<string, any> | undefined;
  private readonly _userId?: string | undefined;
  private readonly _audioUrl?: string | undefined;
  private readonly _audioData?: Buffer | undefined;

  constructor(
    id: string,
    sessionId: string,
    type: MessageType,
    message: string,
    isVoice: boolean = false,
    metadata?: Record<string, any>,
    userId?: string,
    audioUrl?: string,
    audioData?: Buffer
  ) {
    this.validateInputs(id, sessionId, type, message);
    
    this._id = id;
    this._sessionId = sessionId;
    this._type = type;
    this._message = message.trim();
    this._timestamp = new Date();
    this._isVoice = isVoice;
    this._metadata = metadata ? { ...metadata } : undefined;
    this._userId = userId || undefined;
    this._audioUrl = audioUrl || undefined;
    this._audioData = audioData || undefined;
  }

  /**
   * Valida los inputs del constructor
   */
  private validateInputs(id: string, sessionId: string, type: MessageType, message: string): void {
    if (!id || id.trim().length === 0) {
      throw new Error('El ID del mensaje es requerido');
    }

    if (!sessionId || sessionId.trim().length === 0) {
      throw new Error('El session ID es requerido');
    }

    if (!Object.values(MessageType).includes(type)) {
      throw new Error('Tipo de mensaje no válido');
    }

    if (!message || message.trim().length === 0) {
      throw new Error('El contenido del mensaje es requerido');
    }

    if (message.trim().length > 10000) {
      throw new Error('El mensaje no puede exceder 10,000 caracteres');
    }
  }

  /**
   * Getters para acceder a las propiedades
   */
  get id(): string {
    return this._id;
  }

  get sessionId(): string {
    return this._sessionId;
  }

  get type(): MessageType {
    return this._type;
  }

  get message(): string {
    return this._message;
  }

  get timestamp(): Date {
    return new Date(this._timestamp);
  }

  get isVoice(): boolean {
    return this._isVoice;
  }

  get metadata(): Record<string, any> | undefined {
    return this._metadata ? { ...this._metadata } : undefined;
  }

  get userId(): string | undefined {
    return this._userId;
  }

  get audioUrl(): string | undefined {
    return this._audioUrl;
  }

  get audioData(): Buffer | undefined {
    return this._audioData;
  }

  /**
   * Verifica si el mensaje es del usuario
   */
  isUserMessage(): boolean {
    return this._type === MessageType.USER_TEXT || this._type === MessageType.USER_VOICE;
  }

  /**
   * Verifica si el mensaje es del asistente
   */
  isAssistantMessage(): boolean {
    return this._type === MessageType.ASSISTANT_TEXT || this._type === MessageType.ASSISTANT_VOICE;
  }

  /**
   * Verifica si el mensaje es del sistema
   */
  isSystemMessage(): boolean {
    return this._type === MessageType.SYSTEM || 
           this._type === MessageType.WELCOME || 
           this._type === MessageType.ERROR;
  }

  /**
   * Verifica si el mensaje contiene información especial
   */
  hasSpecialContent(): boolean {
    return this._type === MessageType.DISCOUNT_INFO || 
           this._type === MessageType.JOB_INFO;
  }

  /**
   * Obtiene la edad del mensaje en milisegundos
   */
  getAgeInMilliseconds(): number {
    return Date.now() - this._timestamp.getTime();
  }

  /**
   * Verifica si el mensaje es reciente (menos de 5 minutos)
   */
  isRecent(): boolean {
    const fiveMinutesInMs = 5 * 60 * 1000;
    return this.getAgeInMilliseconds() < fiveMinutesInMs;
  }

  /**
   * Obtiene una versión truncada del mensaje para preview
   */
  getPreview(maxLength: number = 100): string {
    if (this._message.length <= maxLength) {
      return this._message;
    }
    
    return this._message.substring(0, maxLength - 3) + '...';
  }

  /**
   * Verifica si el mensaje tiene audio asociado
   */
  hasAudio(): boolean {
    return this._isVoice && (!!this._audioUrl || !!this._audioData);
  }

  /**
   * Obtiene información de metadatos específica
   */
  getMetadataValue<T>(key: string): T | undefined {
    return this._metadata?.[key] as T;
  }

  /**
   * Crea una respuesta automática basada en este mensaje
   */
  createResponse(responseMessage: string, responseType?: MessageType): ChatMessage {
    const responseMessageType = responseType || 
      (this._type === MessageType.USER_VOICE ? MessageType.ASSISTANT_VOICE : MessageType.ASSISTANT_TEXT);
    
    // Generar ID único para la respuesta
    const responseId = `${this._id}_response_${Date.now()}`;
    
    return new ChatMessage(
      responseId,
      this._sessionId,
      responseMessageType,
      responseMessage,
      responseMessageType === MessageType.ASSISTANT_VOICE,
      {
        originalMessageId: this._id,
        responseToUser: this._userId,
        generatedAt: new Date().toISOString()
      }
    );
  }

  /**
   * Convierte el mensaje a formato JSON para almacenamiento/transmisión
   */
  toJSON(): Record<string, any> {
    return {
      id: this._id,
      sessionId: this._sessionId,
      type: this._type,
      message: this._message,
      timestamp: this._timestamp.toISOString(),
      isVoice: this._isVoice,
      metadata: this._metadata,
      userId: this._userId,
      audioUrl: this._audioUrl,
      // Note: audioData no se incluye en JSON por ser binario
    };
  }

  /**
   * Crea una instancia desde datos JSON
   */
  static fromJSON(data: Record<string, any>): ChatMessage {
    return new ChatMessage(
      data.id,
      data.sessionId,
      data.type as MessageType,
      data.message,
      data.isVoice || false,
      data.metadata,
      data.userId,
      data.audioUrl
    );
  }

  /**
   * Compara si dos mensajes son iguales
   */
  equals(other: ChatMessage): boolean {
    return this._id === other._id;
  }

  /**
   * Crea una copia del mensaje con nuevos datos
   */
  withUpdatedMetadata(newMetadata: Record<string, any>): ChatMessage {
    return new ChatMessage(
      this._id,
      this._sessionId,
      this._type,
      this._message,
      this._isVoice,
      { ...this._metadata, ...newMetadata },
      this._userId,
      this._audioUrl,
      this._audioData
    );
  }

  /**
   * Método estático para crear mensaje de sistema
   */
  static createSystemMessage(sessionId: string, message: string, type: MessageType = MessageType.SYSTEM): ChatMessage {
    const id = `system_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    return new ChatMessage(id, sessionId, type, message, false, {
      systemGenerated: true,
      generatedAt: new Date().toISOString()
    });
  }

  /**
   * Método estático para crear mensaje de bienvenida
   */
  static createWelcomeMessage(sessionId: string): ChatMessage {
    const welcomeMessage = "¡Hola! Soy tu asistente virtual de Intelcobro. ¿En qué puedo ayudarte hoy?";
    return ChatMessage.createSystemMessage(sessionId, welcomeMessage, MessageType.WELCOME);
  }

  /**
   * Método estático para crear mensaje de error
   */
  static createErrorMessage(sessionId: string, errorMessage: string): ChatMessage {
    return ChatMessage.createSystemMessage(sessionId, `Error: ${errorMessage}`, MessageType.ERROR);
  }
}