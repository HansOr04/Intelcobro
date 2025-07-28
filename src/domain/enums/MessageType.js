"use strict";
// src/domain/enums/MessageType.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageType = void 0;
exports.isValidMessageType = isValidMessageType;
exports.getResponseMessageType = getResponseMessageType;
/**
 * Enum que define los tipos de mensajes disponibles en el sistema de chat
 */
var MessageType;
(function (MessageType) {
    /**
     * Mensaje de texto normal del usuario
     */
    MessageType["USER_TEXT"] = "USER_TEXT";
    /**
     * Mensaje de audio/voz del usuario
     */
    MessageType["USER_VOICE"] = "USER_VOICE";
    /**
     * Respuesta de texto del asistente de IA
     */
    MessageType["ASSISTANT_TEXT"] = "ASSISTANT_TEXT";
    /**
     * Respuesta de audio del asistente de IA
     */
    MessageType["ASSISTANT_VOICE"] = "ASSISTANT_VOICE";
    /**
     * Mensaje del sistema (notificaciones, errores, etc.)
     */
    MessageType["SYSTEM"] = "SYSTEM";
    /**
     * Mensaje que contiene información sobre descuentos
     */
    MessageType["DISCOUNT_INFO"] = "DISCOUNT_INFO";
    /**
     * Mensaje que contiene información sobre trabajos/empleos
     */
    MessageType["JOB_INFO"] = "JOB_INFO";
    /**
     * Mensaje de bienvenida automático
     */
    MessageType["WELCOME"] = "WELCOME";
    /**
     * Mensaje de error
     */
    MessageType["ERROR"] = "ERROR";
})(MessageType || (exports.MessageType = MessageType = {}));
/**
 * Función helper para validar si un string es un MessageType válido
 */
function isValidMessageType(type) {
    return Object.values(MessageType).includes(type);
}
/**
 * Función helper para obtener el tipo de mensaje opuesto (user -> assistant)
 */
function getResponseMessageType(userType) {
    switch (userType) {
        case MessageType.USER_TEXT:
            return MessageType.ASSISTANT_TEXT;
        case MessageType.USER_VOICE:
            return MessageType.ASSISTANT_VOICE;
        default:
            return MessageType.ASSISTANT_TEXT;
    }
}
