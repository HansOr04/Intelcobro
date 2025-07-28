"use strict";
// src/domain/value-objects/PhoneNumber.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.PhoneNumber = void 0;
/**
 * Value Object que representa un número de teléfono válido
 */
class PhoneNumber {
    constructor(phoneNumber, defaultCountryCode = '593') {
        const parsed = this.parsePhoneNumber(phoneNumber, defaultCountryCode);
        this.validatePhoneNumber(parsed.countryCode, parsed.nationalNumber);
        this._countryCode = parsed.countryCode;
        this._nationalNumber = parsed.nationalNumber;
        this._value = `+${this._countryCode}${this._nationalNumber}`;
    }
    /**
     * Obtiene el número completo con código de país
     */
    get value() {
        return this._value;
    }
    /**
     * Obtiene el código de país
     */
    get countryCode() {
        return this._countryCode;
    }
    /**
     * Obtiene el número nacional (sin código de país)
     */
    get nationalNumber() {
        return this._nationalNumber;
    }
    /**
     * Obtiene el nombre del país
     */
    get countryName() {
        return PhoneNumber.VALID_COUNTRY_CODES[this._countryCode] || 'Desconocido';
    }
    /**
     * Parsea el número de teléfono para extraer código de país y número nacional
     */
    parsePhoneNumber(phoneNumber, defaultCountryCode) {
        if (!phoneNumber || typeof phoneNumber !== 'string') {
            throw new Error('El número de teléfono es requerido y debe ser una cadena de texto');
        }
        // Limpiar el número: remover espacios, guiones, paréntesis
        let cleanNumber = phoneNumber.replace(/[\s\-\(\)\.]/g, '');
        // Si empieza con +, remover el símbolo
        if (cleanNumber.startsWith('+')) {
            cleanNumber = cleanNumber.substring(1);
        }
        // Si empieza con 00, remover y tratar como código internacional
        if (cleanNumber.startsWith('00')) {
            cleanNumber = cleanNumber.substring(2);
        }
        // Intentar identificar el código de país
        for (const [code] of Object.entries(PhoneNumber.VALID_COUNTRY_CODES)) {
            if (cleanNumber.startsWith(code)) {
                const nationalNumber = cleanNumber.substring(code.length);
                return {
                    countryCode: code,
                    nationalNumber: nationalNumber
                };
            }
        }
        // Si no se encontró código de país, usar el predeterminado
        return {
            countryCode: defaultCountryCode,
            nationalNumber: cleanNumber
        };
    }
    /**
     * Valida el número de teléfono según el país
     */
    validatePhoneNumber(countryCode, nationalNumber) {
        if (!PhoneNumber.VALID_COUNTRY_CODES[countryCode]) {
            throw new Error(`El código de país +${countryCode} no es válido o no está soportado`);
        }
        if (!nationalNumber || nationalNumber.length === 0) {
            throw new Error('El número nacional no puede estar vacío');
        }
        // Validar que solo contenga dígitos
        if (!/^[0-9]+$/.test(nationalNumber)) {
            throw new Error('El número de teléfono solo puede contener dígitos');
        }
        const pattern = PhoneNumber.COUNTRY_PATTERNS[countryCode];
        if (pattern && !pattern.test(nationalNumber)) {
            throw new Error(`El formato del número de teléfono no es válido para ${PhoneNumber.VALID_COUNTRY_CODES[countryCode]}`);
        }
        // Validaciones específicas para Ecuador
        if (countryCode === '593') {
            this.validateEcuadorianNumber(nationalNumber);
        }
    }
    /**
     * Validaciones específicas para números ecuatorianos
     */
    validateEcuadorianNumber(nationalNumber) {
        // Los números móviles ecuatorianos empiezan con 9
        // Los números fijos tienen códigos de área específicos
        const mobilePattern = /^9[0-9]{8}$/;
        const landlinePattern = /^[2-7][0-9]{7}$/;
        if (!mobilePattern.test(nationalNumber) && !landlinePattern.test(nationalNumber)) {
            throw new Error('El número ecuatoriano debe ser un móvil (9XXXXXXXX) o fijo (área + 7 dígitos)');
        }
    }
    /**
     * Formatea el número para mostrar de manera legible
     */
    toDisplayFormat() {
        switch (this._countryCode) {
            case '593': // Ecuador
                if (this._nationalNumber.startsWith('9')) {
                    // Móvil: +593 9XX XXX XXX
                    return `+${this._countryCode} ${this._nationalNumber.substring(0, 3)} ${this._nationalNumber.substring(3, 6)} ${this._nationalNumber.substring(6)}`;
                }
                else {
                    // Fijo: +593 X XXX XXXX
                    return `+${this._countryCode} ${this._nationalNumber.substring(0, 1)} ${this._nationalNumber.substring(1, 4)} ${this._nationalNumber.substring(4)}`;
                }
            case '1': // US/Canada
                // +1 (XXX) XXX-XXXX
                return `+${this._countryCode} (${this._nationalNumber.substring(0, 3)}) ${this._nationalNumber.substring(3, 6)}-${this._nationalNumber.substring(6)}`;
            default:
                // Formato genérico
                return `+${this._countryCode} ${this._nationalNumber}`;
        }
    }
    /**
     * Compara si dos números de teléfono son iguales
     */
    equals(other) {
        return this._value === other._value;
    }
    /**
     * Método estático para crear un PhoneNumber desde un string
     */
    static create(phoneNumber, defaultCountryCode) {
        return new PhoneNumber(phoneNumber, defaultCountryCode);
    }
    /**
     * Método estático para validar si un string es un número de teléfono válido
     */
    static isValid(phoneNumber, defaultCountryCode) {
        try {
            new PhoneNumber(phoneNumber, defaultCountryCode);
            return true;
        }
        catch {
            return false;
        }
    }
    /**
     * Determina si es un número móvil
     */
    isMobile() {
        switch (this._countryCode) {
            case '593': // Ecuador
                return this._nationalNumber.startsWith('9');
            case '57': // Colombia
                return this._nationalNumber.startsWith('3');
            case '52': // México
                return this._nationalNumber.length === 10 && this._nationalNumber.startsWith('1');
            default:
                // Para otros países, asumir que números largos son móviles
                return this._nationalNumber.length >= 10;
        }
    }
    /**
     * Convierte el número a string
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
exports.PhoneNumber = PhoneNumber;
/**
 * Patrones de validación por país
 */
PhoneNumber.COUNTRY_PATTERNS = {
    // Ecuador (+593)
    '593': /^[0-9]{8,9}$/,
    // Estados Unidos (+1)
    '1': /^[0-9]{10}$/,
    // Colombia (+57)
    '57': /^[0-9]{10}$/,
    // Perú (+51)
    '51': /^[0-9]{9}$/,
    // España (+34)
    '34': /^[0-9]{9}$/,
    // México (+52)
    '52': /^[0-9]{10}$/
};
/**
 * Códigos de país válidos con sus nombres
 */
PhoneNumber.VALID_COUNTRY_CODES = {
    '593': 'Ecuador',
    '1': 'Estados Unidos/Canadá',
    '57': 'Colombia',
    '51': 'Perú',
    '34': 'España',
    '52': 'México'
};
