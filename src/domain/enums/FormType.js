"use strict";
// src/domain/enums/FormType.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.FORM_REQUIRED_FIELDS = exports.FormType = void 0;
exports.isValidFormType = isValidFormType;
exports.getRequiredFields = getRequiredFields;
exports.hasRequiredFields = hasRequiredFields;
/**
 * Enum que define los tipos de formularios disponibles en el sistema
 */
var FormType;
(function (FormType) {
    /**
     * Formulario de aplicación para trabajos/empleos
     */
    FormType["JOB_APPLICATION"] = "JOB_APPLICATION";
    /**
     * Formulario para solicitar descuentos
     */
    FormType["DISCOUNT_REQUEST"] = "DISCOUNT_REQUEST";
    /**
     * Formulario de contacto general
     */
    FormType["CONTACT"] = "CONTACT";
    /**
     * Formulario de feedback/retroalimentación
     */
    FormType["FEEDBACK"] = "FEEDBACK";
    /**
     * Formulario de suscripción a newsletter
     */
    FormType["NEWSLETTER"] = "NEWSLETTER";
    /**
     * Formulario de consulta sobre servicios
     */
    FormType["SERVICE_INQUIRY"] = "SERVICE_INQUIRY";
})(FormType || (exports.FormType = FormType = {}));
/**
 * Configuración de campos requeridos por tipo de formulario
 */
exports.FORM_REQUIRED_FIELDS = {
    [FormType.JOB_APPLICATION]: [
        'email',
        'fullName',
        'phoneNumber',
        'position',
        'experience'
    ],
    [FormType.DISCOUNT_REQUEST]: [
        'email',
        'fullName',
        'phoneNumber',
        'serviceInterest'
    ],
    [FormType.CONTACT]: [
        'email',
        'fullName',
        'message'
    ],
    [FormType.FEEDBACK]: [
        'email',
        'rating',
        'comments'
    ],
    [FormType.NEWSLETTER]: [
        'email'
    ],
    [FormType.SERVICE_INQUIRY]: [
        'email',
        'fullName',
        'serviceType',
        'message'
    ]
};
/**
 * Función helper para validar si un string es un FormType válido
 */
function isValidFormType(type) {
    return Object.values(FormType).includes(type);
}
/**
 * Función helper para obtener los campos requeridos de un tipo de formulario
 */
function getRequiredFields(formType) {
    return exports.FORM_REQUIRED_FIELDS[formType] || [];
}
/**
 * Función helper para validar si un formulario tiene todos los campos requeridos
 */
function hasRequiredFields(formType, formData) {
    const requiredFields = getRequiredFields(formType);
    return requiredFields.every(field => formData[field] !== undefined &&
        formData[field] !== null &&
        formData[field] !== '');
}
