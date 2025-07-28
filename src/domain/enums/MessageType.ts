// src/domain/enums/MessageType.ts

/**
 * Enum que define los tipos de mensajes disponibles en el sistema de chat
 */
export enum MessageType {
  /**
   * Mensaje de texto normal del usuario
   */
  USER_TEXT = 'USER_TEXT',

  /**
   * Mensaje de audio/voz del usuario
   */
  USER_VOICE = 'USER_VOICE',

  /**
   * Respuesta de texto del asistente de IA
   */
  ASSISTANT_TEXT = 'ASSISTANT_TEXT',

  /**
   * Respuesta de audio del asistente de IA
   */
  ASSISTANT_VOICE = 'ASSISTANT_VOICE',

  /**
   * Mensaje del sistema (notificaciones, errores, etc.)
   */
  SYSTEM = 'SYSTEM',

  /**
   * Mensaje que contiene información sobre descuentos
   */
  DISCOUNT_INFO = 'DISCOUNT_INFO',

  /**
   * Mensaje que contiene información sobre trabajos/empleos
   */
  JOB_INFO = 'JOB_INFO',

  /**
   * Mensaje de bienvenida automático
   */
  WELCOME = 'WELCOME',

  /**
   * Mensaje de error
   */
  ERROR = 'ERROR'
}

/**
 * Función helper para validar si un string es un MessageType válido
 */
export function isValidMessageType(type: string): type is MessageType {
  return Object.values(MessageType).includes(type as MessageType);
}

/**
 * Función helper para obtener el tipo de mensaje opuesto (user -> assistant)
 */
export function getResponseMessageType(userType: MessageType): MessageType {
  switch (userType) {
    case MessageType.USER_TEXT:
      return MessageType.ASSISTANT_TEXT;
    case MessageType.USER_VOICE:
      return MessageType.ASSISTANT_VOICE;
    default:
      return MessageType.ASSISTANT_TEXT;
  }
}