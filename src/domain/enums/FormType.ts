// src/domain/enums/FormType.ts

/**
 * Enum que define los tipos de formularios disponibles en el sistema
 */
export enum FormType {
  /**
   * Formulario de aplicación para trabajos/empleos
   */
  JOB_APPLICATION = 'JOB_APPLICATION',

  /**
   * Formulario para solicitar descuentos
   */
  DISCOUNT_REQUEST = 'DISCOUNT_REQUEST',

  /**
   * Formulario de contacto general
   */
  CONTACT = 'CONTACT',

  /**
   * Formulario de feedback/retroalimentación
   */
  FEEDBACK = 'FEEDBACK',

  /**
   * Formulario de suscripción a newsletter
   */
  NEWSLETTER = 'NEWSLETTER',

  /**
   * Formulario de consulta sobre servicios
   */
  SERVICE_INQUIRY = 'SERVICE_INQUIRY'
}

/**
 * Configuración de campos requeridos por tipo de formulario
 */
export const FORM_REQUIRED_FIELDS: Record<FormType, string[]> = {
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
export function isValidFormType(type: string): type is FormType {
  return Object.values(FormType).includes(type as FormType);
}

/**
 * Función helper para obtener los campos requeridos de un tipo de formulario
 */
export function getRequiredFields(formType: FormType): string[] {
  return FORM_REQUIRED_FIELDS[formType] || [];
}

/**
 * Función helper para validar si un formulario tiene todos los campos requeridos
 */
export function hasRequiredFields(formType: FormType, formData: Record<string, any>): boolean {
  const requiredFields = getRequiredFields(formType);
  return requiredFields.every(field => 
    formData[field] !== undefined && 
    formData[field] !== null && 
    formData[field] !== ''
  );
}