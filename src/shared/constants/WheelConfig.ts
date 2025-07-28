// src/shared/constants/WheelConfig.ts

import { WheelSection, WHEEL_SECTIONS_CONFIG } from '../../domain/enums/WheelSection';

/**
 * Configuración general de la rueda de descuentos
 */
export const WHEEL_CONFIG = {
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
  SECTIONS: WHEEL_SECTIONS_CONFIG
} as const;

/**
 * Mensajes predefinidos para cada resultado de la rueda
 */
export const WHEEL_RESULT_MESSAGES = {
  [WheelSection.DISCOUNT_5]: {
    title: '¡Felicidades!',
    message: '¡Has ganado un 5% de descuento en nuestros servicios!',
    action: 'Completa el formulario para reclamar tu descuento'
  },
  [WheelSection.DISCOUNT_10]: {
    title: '¡Excelente!',
    message: '¡Has ganado un 10% de descuento en nuestros servicios!',
    action: 'Completa el formulario para reclamar tu descuento'
  },
  [WheelSection.DISCOUNT_15]: {
    title: '¡Genial!',
    message: '¡Has ganado un 15% de descuento en nuestros servicios!',
    action: 'Completa el formulario para reclamar tu descuento'
  },
  [WheelSection.DISCOUNT_20]: {
    title: '¡Fantástico!',
    message: '¡Has ganado un 20% de descuento en nuestros servicios!',
    action: 'Completa el formulario para reclamar tu descuento'
  },
  [WheelSection.DISCOUNT_25]: {
    title: '¡Increíble!',
    message: '¡Has ganado un 25% de descuento en nuestros servicios!',
    action: 'Completa el formulario para reclamar tu descuento'
  },
  [WheelSection.DISCOUNT_30]: {
    title: '¡Impresionante!',
    message: '¡Has ganado un 30% de descuento en nuestros servicios!',
    action: 'Completa el formulario para reclamar tu descuento'
  },
  [WheelSection.DISCOUNT_50]: {
    title: '¡PREMIO MAYOR!',
    message: '¡FELICIDADES! Has ganado nuestro premio mayor: 50% de descuento!',
    action: 'Completa el formulario inmediatamente para reclamar este increíble descuento'
  },
  [WheelSection.TRY_AGAIN]: {
    title: 'Casi lo logras',
    message: 'No has ganado esta vez, pero no te rindas. ¡Inténtalo nuevamente!',
    action: 'Puedes girar la rueda nuevamente en unos minutos'
  }
} as const;

/**
 * Configuración de límites y validaciones
 */
export const WHEEL_LIMITS = {
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
} as const;

/**
 * Función helper para obtener un mensaje personalizado basado en el resultado
 */
export function getWheelResultMessage(section: WheelSection) {
  return WHEEL_RESULT_MESSAGES[section] || WHEEL_RESULT_MESSAGES[WheelSection.TRY_AGAIN];
}

/**
 * Función helper para validar si el sistema de rueda está habilitado
 */
export function isWheelEnabled(): boolean {
  return process.env.WHEEL_ENABLED !== 'false';
}

/**
 * Función helper para obtener el tiempo de cooldown desde variables de entorno
 */
export function getSpinCooldown(): number {
  const envCooldown = process.env.WHEEL_SPIN_COOLDOWN;
  return envCooldown ? parseInt(envCooldown, 10) : WHEEL_CONFIG.SPIN_COOLDOWN_MS;
}