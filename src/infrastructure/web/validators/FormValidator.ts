// src/infrastructure/web/validators/FormValidator.ts

import Joi from 'joi';

/**
 * Validador para formularios de la aplicación
 */
export class FormValidator {
  /**
   * Schema para validar aplicación de trabajo
   */
  static jobApplicationSchema = Joi.object({
    fullName: Joi.string()
      .required()
      .min(2)
      .max(100)
      .pattern(/^[a-zA-ZÀ-ÿ\s]+$/)
      .trim()
      .messages({
        'string.empty': 'Nombre completo es requerido',
        'string.min': 'Nombre completo debe tener al menos 2 caracteres',
        'string.max': 'Nombre completo no puede exceder 100 caracteres',
        'string.pattern.base': 'Nombre completo solo puede contener letras y espacios'
      }),

    email: Joi.string()
      .required()
      .email({ tlds: { allow: false } })
      .max(100)
      .lowercase()
      .trim()
      .messages({
        'string.empty': 'Email es requerido',
        'string.email': 'Email debe tener un formato válido',
        'string.max': 'Email no puede exceder 100 caracteres'
      }),

    phone: Joi.string()
      .required()
      .pattern(/^\+?[1-9]\d{7,14}$/)
      .messages({
        'string.empty': 'Teléfono es requerido',
        'string.pattern.base': 'Teléfono debe tener un formato válido (ej: +1234567890)'
      }),

    position: Joi.string()
      .required()
      .min(2)
      .max(100)
      .trim()
      .messages({
        'string.empty': 'Posición es requerida',
        'string.min': 'Posición debe tener al menos 2 caracteres',
        'string.max': 'Posición no puede exceder 100 caracteres'
      }),

    experience: Joi.string()
      .required()
      .min(10)
      .max(2000)
      .trim()
      .messages({
        'string.empty': 'Experiencia es requerida',
        'string.min': 'Descripción de experiencia debe tener al menos 10 caracteres',
        'string.max': 'Descripción de experiencia no puede exceder 2000 caracteres'
      }),

    skills: Joi.array()
      .items(
        Joi.string()
          .min(1)
          .max(50)
          .trim()
      )
      .min(1)
      .max(20)
      .required()
      .messages({
        'array.min': 'Debe incluir al menos 1 habilidad',
        'array.max': 'No puede incluir más de 20 habilidades',
        'array.base': 'Skills debe ser un array'
      }),

    linkedinProfile: Joi.string()
      .optional()
      .uri({ scheme: ['http', 'https'] })
      .pattern(/linkedin\.com/)
      .messages({
        'string.uri': 'LinkedIn debe ser una URL válida',
        'string.pattern.base': 'LinkedIn debe ser una URL de LinkedIn válida'
      }),

    githubProfile: Joi.string()
      .optional()
      .uri({ scheme: ['http', 'https'] })
      .pattern(/github\.com/)
      .messages({
        'string.uri': 'GitHub debe ser una URL válida',
        'string.pattern.base': 'GitHub debe ser una URL de GitHub válida'
      }),

    portfolioUrl: Joi.string()
      .optional()
      .uri({ scheme: ['http', 'https'] })
      .messages({
        'string.uri': 'Portfolio debe ser una URL válida'
      }),

    expectedSalary: Joi.number()
      .optional()
      .integer()
      .min(0)
      .max(1000000)
      .messages({
        'number.base': 'Salario esperado debe ser un número',
        'number.integer': 'Salario esperado debe ser un número entero',
        'number.min': 'Salario esperado debe ser 0 o mayor',
        'number.max': 'Salario esperado no puede exceder 1,000,000'
      }),

    availabilityDate: Joi.date()
      .optional()
      .min('now')
      .messages({
        'date.base': 'Fecha de disponibilidad debe ser una fecha válida',
        'date.min': 'Fecha de disponibilidad debe ser hoy o en el futuro'
      }),

    workModality: Joi.string()
      .optional()
      .valid('remote', 'onsite', 'hybrid')
      .messages({
        'any.only': 'Modalidad de trabajo debe ser: remote, onsite, o hybrid'
      }),

    englishLevel: Joi.string()
      .optional()
      .valid('basic', 'intermediate', 'advanced', 'native')
      .messages({
        'any.only': 'Nivel de inglés debe ser: basic, intermediate, advanced, o native'
      }),

    additionalInfo: Joi.string()
      .optional()
      .max(1000)
      .trim()
      .messages({
        'string.max': 'Información adicional no puede exceder 1000 caracteres'
      }),

    agreedToTerms: Joi.boolean()
      .required()
      .valid(true)
      .messages({
        'any.only': 'Debe aceptar los términos y condiciones',
        'boolean.base': 'Aceptación de términos es requerida'
      }),

    source: Joi.string()
      .optional()
      .valid('website', 'linkedin', 'referral', 'job_board', 'other')
      .default('website')
      .messages({
        'any.only': 'Fuente debe ser: website, linkedin, referral, job_board, o other'
      })
  });

  /**
   * Schema para validar formulario de descuento
   */
  static discountFormSchema = Joi.object({
    fullName: Joi.string()
      .required()
      .min(2)
      .max(100)
      .pattern(/^[a-zA-ZÀ-ÿ\s]+$/)
      .trim()
      .messages({
        'string.empty': 'Nombre completo es requerido',
        'string.min': 'Nombre completo debe tener al menos 2 caracteres',
        'string.max': 'Nombre completo no puede exceder 100 caracteres',
        'string.pattern.base': 'Nombre completo solo puede contener letras y espacios'
      }),

    email: Joi.string()
      .required()
      .email({ tlds: { allow: false } })
      .max(100)
      .lowercase()
      .trim()
      .messages({
        'string.empty': 'Email es requerido',
        'string.email': 'Email debe tener un formato válido',
        'string.max': 'Email no puede exceder 100 caracteres'
      }),

    phone: Joi.string()
      .required()
      .pattern(/^\+?[1-9]\d{7,14}$/)
      .messages({
        'string.empty': 'Teléfono es requerido',
        'string.pattern.base': 'Teléfono debe tener un formato válido (ej: +1234567890)'
      }),

    serviceInterest: Joi.string()
      .required()
      .valid(
        'web-development',
        'mobile-development',
        'ecommerce',
        'consulting',
        'design',
        'marketing',
        'other'
      )
      .messages({
        'string.empty': 'Servicio de interés es requerido',
        'any.only': 'Servicio debe ser uno de los valores permitidos'
      }),

    companyName: Joi.string()
      .optional()
      .min(2)
      .max(100)
      .trim()
      .messages({
        'string.min': 'Nombre de empresa debe tener al menos 2 caracteres',
        'string.max': 'Nombre de empresa no puede exceder 100 caracteres'
      }),

    companySize: Joi.string()
      .optional()
      .valid('1-10', '11-50', '51-200', '201-1000', '1000+')
      .messages({
        'any.only': 'Tamaño de empresa debe ser: 1-10, 11-50, 51-200, 201-1000, o 1000+'
      }),

    budget: Joi.string()
      .optional()
      .valid(
        'less-than-5k',
        '5k-15k',
        '15k-50k',
        '50k-100k',
        'more-than-100k',
        'not-sure'
      )
      .messages({
        'any.only': 'Presupuesto debe ser uno de los rangos disponibles'
      }),

    timeline: Joi.string()
      .optional()
      .valid(
        'asap',
        '1-month',
        '2-3-months',
        '3-6-months',
        'more-than-6-months',
        'flexible'
      )
      .messages({
        'any.only': 'Timeline debe ser uno de los valores disponibles'
      }),

    projectDescription: Joi.string()
      .optional()
      .min(10)
      .max(2000)
      .trim()
      .messages({
        'string.min': 'Descripción del proyecto debe tener al menos 10 caracteres',
        'string.max': 'Descripción del proyecto no puede exceder 2000 caracteres'
      }),

    wheelResultId: Joi.string()
      .optional()
      .pattern(/^wheel_result_[a-zA-Z0-9]+$/)
      .messages({
        'string.pattern.base': 'ID de resultado de ruleta inválido'
      }),

    discountCode: Joi.string()
      .optional()
      .pattern(/^WHEEL[0-9]{4}$/)
      .messages({
        'string.pattern.base': 'Código de descuento inválido'
      }),

    hearAboutUs: Joi.string()
      .optional()
      .valid(
        'google',
        'social-media',
        'referral',
        'advertising',
        'event',
        'other'
      )
      .messages({
        'any.only': 'Cómo nos conoció debe ser uno de los valores disponibles'
      }),

    agreedToTerms: Joi.boolean()
      .required()
      .valid(true)
      .messages({
        'any.only': 'Debe aceptar los términos y condiciones',
        'boolean.base': 'Aceptación de términos es requerida'
      }),

    agreedToMarketing: Joi.boolean()
      .optional()
      .default(false)
      .messages({
        'boolean.base': 'Aceptación de marketing debe ser un valor booleano'
      }),

    source: Joi.string()
      .optional()
      .valid('wheel', 'direct', 'landing', 'chat')
      .default('wheel')
      .messages({
        'any.only': 'Fuente debe ser: wheel, direct, landing, o chat'
      })
  });

  /**
   * Schema para validar archivos subidos
   */
  static fileUploadSchema = Joi.object({
    mimetype: Joi.string()
      .valid(
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'image/jpeg',
        'image/png',
        'image/gif'
      )
      .required()
      .messages({
        'any.only': 'Tipo de archivo no soportado. Use: PDF, DOC, DOCX, JPG, PNG, GIF'
      }),

    size: Joi.number()
      .max(5 * 1024 * 1024) // 5MB max
      .required()
      .messages({
        'number.max': 'El archivo no puede exceder 5MB'
      }),

    fieldname: Joi.string()
      .valid('resume', 'portfolio', 'attachment')
      .required()
      .messages({
        'any.only': 'Campo de archivo debe ser: resume, portfolio, o attachment'
      })
  });

  /**
   * Valida formato de email más estricto
   */
  static validateEmailFormat(email: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validación básica de formato
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      errors.push('Formato de email inválido');
      return { isValid: false, errors };
    }

    // Validar dominio no sea temporal/desechable
    const disposableEmailDomains = [
      '10minutemail.com',
      'tempmail.org',
      'guerrillamail.com',
      'mailinator.com',
      'yopmail.com'
    ];

    const domain = email.split('@')[1]?.toLowerCase();
    if (domain && disposableEmailDomains.includes(domain)) {
      errors.push('No se permiten emails temporales o desechables');
    }

    // Validar longitud de partes
    const [localPart, domainPart] = email.split('@');
    
    if (localPart && localPart.length > 64) {
      errors.push('La parte local del email es demasiado larga');
    }

    if (domainPart && domainPart.length > 255) {
      errors.push('El dominio del email es demasiado largo');
    }

    // Validar caracteres especiales consecutivos
    if (/[.]{2,}/.test(email)) {
      errors.push('El email no puede contener puntos consecutivos');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Valida número de teléfono más estricto
   */
  static validatePhoneNumber(phone: string): { isValid: boolean; errors: string[]; formatted: string } {
    const errors: string[] = [];
    let formatted = phone;

    // Limpiar el número
    const cleaned = phone.replace(/\D/g, '');

    // Validar longitud
    if (cleaned.length < 8 || cleaned.length > 15) {
      errors.push('Número de teléfono debe tener entre 8 y 15 dígitos');
    }

    // Validar que no empiece con 0 (excepto código de país)
    if (cleaned.startsWith('0') && !phone.startsWith('+')) {
      errors.push('Número de teléfono no debe empezar con 0');
    }

    // Formatear número
    if (errors.length === 0) {
      if (cleaned.length === 10 && !phone.startsWith('+')) {
        // Número US/CA sin código de país
        formatted = `+1${cleaned}`;
      } else if (phone.startsWith('+')) {
        formatted = phone;
      } else {
        formatted = `+${cleaned}`;
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      formatted
    };
  }

  /**
   * Valida lista de habilidades
   */
  static validateSkills(skills: string[]): { isValid: boolean; errors: string[]; normalized: string[] } {
    const errors: string[] = [];
    const normalized: string[] = [];

    if (!Array.isArray(skills)) {
      errors.push('Skills debe ser un array');
      return { isValid: false, errors, normalized };
    }

    if (skills.length === 0) {
      errors.push('Debe incluir al menos una habilidad');
      return { isValid: false, errors, normalized };
    }

    const commonSkills = [
      'javascript', 'typescript', 'react', 'vue', 'angular', 'node.js', 'python',
      'java', 'c#', 'php', 'html', 'css', 'sass', 'less', 'bootstrap', 'tailwind',
      'mongodb', 'mysql', 'postgresql', 'redis', 'docker', 'kubernetes', 'aws',
      'azure', 'gcp', 'git', 'github', 'gitlab', 'jira', 'figma', 'photoshop'
    ];

    skills.forEach((skill, index) => {
      const trimmed = skill.trim().toLowerCase();
      
      if (trimmed.length === 0) {
        errors.push(`Habilidad ${index + 1} está vacía`);
        return;
      }

      if (trimmed.length > 50) {
        errors.push(`Habilidad ${index + 1} es demasiado larga`);
        return;
      }

      // Normalizar habilidades comunes
      const normalizedSkill = commonSkills.find(common => 
        common.toLowerCase().includes(trimmed) || trimmed.includes(common.toLowerCase())
      ) || trimmed;

      if (!normalized.includes(normalizedSkill)) {
        normalized.push(normalizedSkill);
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      normalized
    };
  }

  /**
   * Schema para validar contacto general
   */
  static contactFormSchema = Joi.object({
    name: Joi.string()
      .required()
      .min(2)
      .max(100)
      .trim(),

    email: Joi.string()
      .required()
      .email()
      .max(100)
      .lowercase()
      .trim(),

    subject: Joi.string()
      .required()
      .min(5)
      .max(200)
      .trim()
      .messages({
        'string.empty': 'Asunto es requerido',
        'string.min': 'Asunto debe tener al menos 5 caracteres',
        'string.max': 'Asunto no puede exceder 200 caracteres'
      }),

    message: Joi.string()
      .required()
      .min(10)
      .max(2000)
      .trim()
      .messages({
        'string.empty': 'Mensaje es requerido',
        'string.min': 'Mensaje debe tener al menos 10 caracteres',
        'string.max': 'Mensaje no puede exceder 2000 caracteres'
      }),

    phone: Joi.string()
      .optional()
      .pattern(/^\+?[1-9]\d{7,14}$/)
      .messages({
        'string.pattern.base': 'Teléfono debe tener un formato válido'
      }),

    category: Joi.string()
      .optional()
      .valid('general', 'support', 'sales', 'partnership', 'feedback')
      .default('general')
      .messages({
        'any.only': 'Categoría debe ser: general, support, sales, partnership, o feedback'
      })
  });

  /**
   * Schema para validar feedback de servicio
   */
  static feedbackSchema = Joi.object({
    serviceType: Joi.string()
      .required()
      .valid('chat', 'wheel', 'forms', 'general')
      .messages({
        'string.empty': 'Tipo de servicio es requerido',
        'any.only': 'Tipo de servicio debe ser: chat, wheel, forms, o general'
      }),

    rating: Joi.number()
      .required()
      .integer()
      .min(1)
      .max(5)
      .messages({
        'number.base': 'Calificación debe ser un número',
        'number.integer': 'Calificación debe ser un número entero',
        'number.min': 'Calificación debe ser al menos 1',
        'number.max': 'Calificación no puede exceder 5'
      }),

    comment: Joi.string()
      .optional()
      .max(1000)
      .trim()
      .messages({
        'string.max': 'Comentario no puede exceder 1000 caracteres'
      }),

    email: Joi.string()
      .optional()
      .email()
      .max(100)
      .lowercase()
      .trim()
      .messages({
        'string.email': 'Email debe tener un formato válido',
        'string.max': 'Email no puede exceder 100 caracteres'
      }),

    sessionId: Joi.string()
      .optional()
      .pattern(/^[a-zA-Z0-9_-]+$/)
      .messages({
        'string.pattern.base': 'Session ID inválido'
      }),

    wouldRecommend: Joi.boolean()
      .optional()
      .messages({
        'boolean.base': 'Recomendación debe ser verdadero o falso'
      })
  });

  /**
   * Valida que un campo no contenga contenido malicioso
   */
  static validateSafeContent(content: string, fieldName: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Patrones peligrosos
    const dangerousPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /javascript:/gi,
      /data:text\/html/gi,
      /vbscript:/gi,
      /onload\s*=/gi,
      /onerror\s*=/gi,
      /onclick\s*=/gi,
      /onmouseover\s*=/gi,
      /<iframe\b[^>]*>/gi,
      /<object\b[^>]*>/gi,
      /<embed\b[^>]*>/gi,
      /<link\b[^>]*>/gi,
      /<meta\b[^>]*>/gi
    ];

    dangerousPatterns.forEach(pattern => {
      if (pattern.test(content)) {
        errors.push(`${fieldName} contiene contenido no permitido`);
      }
    });

    // SQL Injection básico
    const sqlPatterns = [
      /(\bselect\b|\binsert\b|\bupdate\b|\bdelete\b|\bdrop\b|\bunion\b).*(\bfrom\b|\binto\b|\bwhere\b)/gi,
      /('|")\s*(or|and)\s*('|")/gi,
      /;\s*(drop|delete|truncate|alter)\b/gi
    ];

    sqlPatterns.forEach(pattern => {
      if (pattern.test(content)) {
        errors.push(`${fieldName} contiene patrones sospechosos`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Normaliza y sanitiza datos de entrada
   */
  static sanitizeInput(data: Record<string, any>): Record<string, any> {
    const sanitized: Record<string, any> = {};

    Object.entries(data).forEach(([key, value]) => {
      if (typeof value === 'string') {
        // Remover caracteres de control
        let clean = value.replace(/[\x00-\x1F\x7F]/g, '');
        
        // Normalizar espacios
        clean = clean.replace(/\s+/g, ' ').trim();
        
        // Escapar caracteres HTML básicos si es necesario
        if (key === 'message' || key === 'description' || key === 'comment') {
          clean = clean
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;');
        }
        
        sanitized[key] = clean;
      } else if (Array.isArray(value)) {
        sanitized[key] = value.map(item => 
          typeof item === 'string' ? item.trim() : item
        );
      } else {
        sanitized[key] = value;
      }
    });

    return sanitized;
  }

  /**
   * Valida campos requeridos dinámicamente
   */
  static validateRequiredFields(
    data: Record<string, any>, 
    requiredFields: string[]
  ): { isValid: boolean; missingFields: string[] } {
    const missingFields: string[] = [];

    requiredFields.forEach(field => {
      const value = data[field];
      
      if (value === undefined || value === null || value === '') {
        missingFields.push(field);
      } else if (Array.isArray(value) && value.length === 0) {
        missingFields.push(field);
      } else if (typeof value === 'string' && value.trim() === '') {
        missingFields.push(field);
      }
    });

    return {
      isValid: missingFields.length === 0,
      missingFields
    };
  }

  /**
   * Schema para validar webhook de formulario
   */
  static webhookSchema = Joi.object({
    event: Joi.string()
      .required()
      .valid('form.submitted', 'form.validated', 'form.processed')
      .messages({
        'string.empty': 'Evento es requerido',
        'any.only': 'Evento debe ser: form.submitted, form.validated, o form.processed'
      }),

    formType: Joi.string()
      .required()
      .valid('job-application', 'discount-form', 'contact', 'feedback')
      .messages({
        'string.empty': 'Tipo de formulario es requerido',
        'any.only': 'Tipo de formulario inválido'
      }),

    timestamp: Joi.date()
      .required()
      .messages({
        'date.base': 'Timestamp debe ser una fecha válida'
      }),

    data: Joi.object()
      .required()
      .messages({
        'object.base': 'Data debe ser un objeto válido'
      }),

    signature: Joi.string()
      .optional()
      .pattern(/^[a-zA-Z0-9+/=]+$/)
      .messages({
        'string.pattern.base': 'Signature debe ser base64 válido'
      })
  });
}