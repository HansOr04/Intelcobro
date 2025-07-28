"use strict";
// src/domain/enums/WheelSection.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.WHEEL_SECTIONS_CONFIG = exports.WheelSection = void 0;
exports.getSectionConfig = getSectionConfig;
exports.isValidWheelSection = isValidWheelSection;
exports.getDiscountSections = getDiscountSections;
/**
 * Enum que define las secciones disponibles en la rueda de descuentos
 */
var WheelSection;
(function (WheelSection) {
    /**
     * Sección con 5% de descuento
     */
    WheelSection["DISCOUNT_5"] = "DISCOUNT_5";
    /**
     * Sección con 10% de descuento
     */
    WheelSection["DISCOUNT_10"] = "DISCOUNT_10";
    /**
     * Sección con 15% de descuento
     */
    WheelSection["DISCOUNT_15"] = "DISCOUNT_15";
    /**
     * Sección con 20% de descuento
     */
    WheelSection["DISCOUNT_20"] = "DISCOUNT_20";
    /**
     * Sección con 25% de descuento
     */
    WheelSection["DISCOUNT_25"] = "DISCOUNT_25";
    /**
     * Sección con 30% de descuento
     */
    WheelSection["DISCOUNT_30"] = "DISCOUNT_30";
    /**
     * Sección con 50% de descuento (premio mayor)
     */
    WheelSection["DISCOUNT_50"] = "DISCOUNT_50";
    /**
     * Sección sin premio (intenta de nuevo)
     */
    WheelSection["TRY_AGAIN"] = "TRY_AGAIN";
})(WheelSection || (exports.WheelSection = WheelSection = {}));
/**
 * Configuración completa de todas las secciones de la rueda
 */
exports.WHEEL_SECTIONS_CONFIG = [
    {
        section: WheelSection.DISCOUNT_5,
        label: '5% OFF',
        discountPercentage: 5,
        probability: 25,
        color: '#FF6B6B',
        textColor: '#FFFFFF'
    },
    {
        section: WheelSection.DISCOUNT_10,
        label: '10% OFF',
        discountPercentage: 10,
        probability: 20,
        color: '#4ECDC4',
        textColor: '#FFFFFF'
    },
    {
        section: WheelSection.DISCOUNT_15,
        label: '15% OFF',
        discountPercentage: 15,
        probability: 15,
        color: '#45B7D1',
        textColor: '#FFFFFF'
    },
    {
        section: WheelSection.DISCOUNT_20,
        label: '20% OFF',
        discountPercentage: 20,
        probability: 15,
        color: '#96CEB4',
        textColor: '#FFFFFF'
    },
    {
        section: WheelSection.DISCOUNT_25,
        label: '25% OFF',
        discountPercentage: 25,
        probability: 10,
        color: '#FFEAA7',
        textColor: '#2D3436'
    },
    {
        section: WheelSection.DISCOUNT_30,
        label: '30% OFF',
        discountPercentage: 30,
        probability: 8,
        color: '#DDA0DD',
        textColor: '#FFFFFF'
    },
    {
        section: WheelSection.DISCOUNT_50,
        label: '50% OFF',
        discountPercentage: 50,
        probability: 2,
        color: '#FFD700',
        textColor: '#2D3436'
    },
    {
        section: WheelSection.TRY_AGAIN,
        label: 'Try Again',
        discountPercentage: 0,
        probability: 5,
        color: '#74B9FF',
        textColor: '#FFFFFF'
    }
];
/**
 * Función helper para obtener la configuración de una sección específica
 */
function getSectionConfig(section) {
    return exports.WHEEL_SECTIONS_CONFIG.find(config => config.section === section);
}
/**
 * Función helper para validar si un string es una WheelSection válida
 */
function isValidWheelSection(section) {
    return Object.values(WheelSection).includes(section);
}
/**
 * Función helper para obtener todas las secciones con descuento (excluyendo TRY_AGAIN)
 */
function getDiscountSections() {
    return exports.WHEEL_SECTIONS_CONFIG.filter(config => config.discountPercentage > 0);
}
