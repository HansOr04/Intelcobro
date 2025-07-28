"use strict";
// src/shared/constants/WheelConfig.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.WHEEL_LIMITS = exports.WHEEL_RESULT_MESSAGES = exports.WHEEL_CONFIG = void 0;
exports.getWheelResultMessage = getWheelResultMessage;
exports.isWheelEnabled = isWheelEnabled;
exports.getSpinCooldown = getSpinCooldown;
const WheelSection_1 = require("@domain/enums/WheelSection");
/**
 * Configuración general de la rueda de descuentos
 */
exports.WHEEL_CONFIG = {
    /**
     * Tiempo de cooldown entre giros en milisegundos (5 minutos)
     */
    SPIN_COOLDOWN_MS: 5 * 60 * 1000,
    /**
     * Duración mínima de la animación de giro en milisegundos
     */
    MIN_SPIN_DURATION_MS: 3000,
    /**
     * Duración máxima de la animación de giro en milisegundos
     */
    MAX_SPIN_DURATION_MS: 5000,
    /**
     * Número de vueltas completas antes de detenerse
     */
    MIN_FULL_ROTATIONS: 3,
    MAX_FULL_ROTATIONS: 6,
    /**
     * Configuración de probabilidades (deben sumar 100)
     */
    TOTAL_PROBABILITY: 100,
    /**
     * Máximo número de intentos por sesión de usuario
     */
    MAX_SPINS_PER_SESSION: 3,
    /**
     * Tiempo de expiración de sesión en milisegundos (24 horas)
     */
    SESSION_EXPIRY_MS: 24 * 60 * 60 * 1000,
    /**
     * Configuración de los segmentos de la rueda
     */
    SECTIONS: WheelSection_1.WHEEL_SECTIONS_CONFIG
};
/**
 * Mensajes predefinidos para cada resultado de la rueda
 */
exports.WHEEL_RESULT_MESSAGES = {
    [WheelSection_1.WheelSection.DISCOUNT_5]: {
        title: '¡Felicidades!',
        message: '¡Has ganado un 5% de descuento en nuestros servicios!',
        action: 'Completa el formulario para reclamar tu descuento'
    },
    [WheelSection_1.WheelSection.DISCOUNT_10]: {
        title: '¡Excelente!',
        message: '¡Has ganado un 10% de descuento en nuestros servicios!',
        action: 'Completa el formulario para reclamar tu descuento'
    },
    [WheelSection_1.WheelSection.DISCOUNT_15]: {
        title: '¡Genial!',
        message: '¡Has ganado un 15% de descuento en nuestros servicios!',
        action: 'Completa el formulario para reclamar tu descuento'
    },
    [WheelSection_1.WheelSection.DISCOUNT_20]: {
        title: '¡Fantástico!',
        message: '¡Has ganado un 20% de descuento en nuestros servicios!',
        action: 'Completa el formulario para reclamar tu descuento'
    },
    [WheelSection_1.WheelSection.DISCOUNT_25]: {
        title: '¡Increíble!',
        message: '¡Has ganado un 25% de descuento en nuestros servicios!',
        action: 'Completa el formulario para reclamar tu descuento'
    },
    [WheelSection_1.WheelSection.DISCOUNT_30]: {
        title: '¡Impresionante!',
        message: '¡Has ganado un 30% de descuento en nuestros servicios!',
        action: 'Completa el formulario para reclamar tu descuento'
    },
    [WheelSection_1.WheelSection.DISCOUNT_50]: {
        title: '¡PREMIO MAYOR!',
        message: '¡FELICIDADES! Has ganado nuestro premio mayor: 50% de descuento!',
        action: 'Completa el formulario inmediatamente para reclamar este increíble descuento'
    },
    [WheelSection_1.WheelSection.TRY_AGAIN]: {
        title: 'Casi lo logras',
        message: 'No has ganado esta vez, pero no te rindas. ¡Inténtalo nuevamente!',
        action: 'Puedes girar la rueda nuevamente en unos minutos'
    }
};
/**
 * Configuración de límites y validaciones
 */
exports.WHEEL_LIMITS = {
    /**
     * Descuento mínimo permitido
     */
    MIN_DISCOUNT_PERCENTAGE: 5,
    /**
     * Descuento máximo permitido
     */
    MAX_DISCOUNT_PERCENTAGE: 50,
    /**
     * Límite diario de giros por IP
     */
    DAILY_SPINS_PER_IP: 10,
    /**
     * Límite de giros por email registrado
     */
    SPINS_PER_EMAIL: 1
};
/**
 * Función helper para obtener un mensaje personalizado basado en el resultado
 */
function getWheelResultMessage(section) {
    return exports.WHEEL_RESULT_MESSAGES[section] || exports.WHEEL_RESULT_MESSAGES[WheelSection_1.WheelSection.TRY_AGAIN];
}
/**
 * Función helper para validar si el sistema de rueda está habilitado
 */
function isWheelEnabled() {
    return process.env.WHEEL_ENABLED !== 'false';
}
/**
 * Función helper para obtener el tiempo de cooldown desde variables de entorno
 */
function getSpinCooldown() {
    const envCooldown = process.env.WHEEL_SPIN_COOLDOWN;
    return envCooldown ? parseInt(envCooldown, 10) : exports.WHEEL_CONFIG.SPIN_COOLDOWN_MS;
}
