"use strict";
// src/domain/value-objects/Email.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.Email = void 0;
/**
 * Value Object que representa una dirección de correo electrónico válida
 */
class Email {
    constructor(email) {
        this.validateEmail(email);
        this._value = email.toLowerCase().trim();
    }
    /**
     * Obtiene el valor del email
     */
    get value() {
        return this._value;
    }
    /**
     * Obtiene la parte local del email (antes del @)
     */
    get localPart() {
        return this._value.split('@')[0] || '';
    }
    /**
     * Obtiene el dominio del email (después del @)
     */
    get domain() {
        return this._value.split('@')[1] || '';
    }
    /**
     * Valida si el email tiene un formato correcto
     */
    validateEmail(email) {
        if (!email || typeof email !== 'string') {
            throw new Error('El email es requerido y debe ser una cadena de texto');
        }
        const trimmedEmail = email.trim();
        if (trimmedEmail.length === 0) {
            throw new Error('El email no puede estar vacío');
        }
        if (trimmedEmail.length > 254) {
            throw new Error('El email no puede tener más de 254 caracteres');
        }
        if (!Email.EMAIL_REGEX.test(trimmedEmail)) {
            throw new Error('El formato del email no es válido');
        }
        const domain = trimmedEmail.split('@')[1]?.toLowerCase();
        if (domain && Email.DISPOSABLE_DOMAINS.includes(domain)) {
            throw new Error('No se permiten direcciones de email desechables');
        }
        // Validar que la parte local no sea muy larga (máximo 64 caracteres)
        const localPart = trimmedEmail.split('@')[0];
        if (localPart && localPart.length > 64) {
            throw new Error('La parte local del email no puede tener más de 64 caracteres');
        }
    }
    /**
     * Compara si dos emails son iguales
     */
    equals(other) {
        return this._value === other._value;
    }
    /**
     * Método estático para crear un Email desde un string con validación
     */
    static create(email) {
        return new Email(email);
    }
    /**
     * Método estático para validar si un string es un email válido sin crear la instancia
     */
    static isValid(email) {
        try {
            new Email(email);
            return true;
        }
        catch {
            return false;
        }
    }
    /**
     * Genera una versión enmascarada del email para logs/display
     * Ejemplo: john.doe@example.com -> j***e@e***e.com
     */
    toMasked() {
        const [local, domain] = this._value.split('@');
        if (!local || !domain) {
            return this._value;
        }
        const maskedLocal = local.length > 2
            ? `${local[0]}${'*'.repeat(local.length - 2)}${local[local.length - 1]}`
            : local;
        const domainParts = domain.split('.');
        const maskedDomain = domainParts.map(part => part.length > 2
            ? `${part[0]}${'*'.repeat(part.length - 2)}${part[part.length - 1]}`
            : part).join('.');
        return `${maskedLocal}@${maskedDomain}`;
    }
    /**
     * Convierte el email a string
     */
    toString() {
        return this._value;
    }
    /**
     * Serialización para JSON
     */
    toJSON() {
        return this._value;
    }
}
exports.Email = Email;
/**
 * Expresión regular para validar formato de email
 */
Email.EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
/**
 * Lista de dominios de email temporales/desechables para bloquear
 */
Email.DISPOSABLE_DOMAINS = [
    '10minutemail.com',
    'tempmail.org',
    'guerrillamail.com',
    'mailinator.com',
    'throwaway.email'
];
