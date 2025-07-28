// src/application/dto/JobApplicationDTO.ts

/**
 * DTO para solicitud de aplicación de trabajo
 */
export interface JobApplicationRequestDTO {
  sessionId: string;
  email: string;
  fullName: string;
  phoneNumber?: string | undefined;
  position: string;
  experience: string;
  skills?: string | undefined;
  education?: string | undefined;
  availability?: string | undefined;
  portfolio?: string | undefined;
  coverLetter?: string | undefined;
  salary?: string | undefined;
  relocate?: boolean | undefined;
  remoteWork?: boolean | undefined;
  startDate?: string | undefined;
  references?: string | undefined;
  linkedIn?: string | undefined;
  github?: string | undefined;
  resume?: string | undefined; // Base64 encoded file or URL
  additionalInfo?: string | undefined;
}

/**
 * DTO para respuesta de aplicación de trabajo
 */
export interface JobApplicationResponseDTO {
  id: string;
  sessionId: string;
  email: string;
  fullName: string;
  phoneNumber?: string | undefined;
  position: string;
  status: string;
  submittedAt: string;
  processedAt?: string | undefined;
  emailSent: boolean;
  followUpScheduled: boolean;
  applicationNumber: string;
}

/**
 * DTO para listado de aplicaciones
 */
export interface JobApplicationListDTO {
  applications: JobApplicationSummaryDTO[];
  totalApplications: number;
  pendingApplications: number;
  processedApplications: number;
  lastUpdate: string;
}

/**
 * DTO para resumen de aplicación
 */
export interface JobApplicationSummaryDTO {
  id: string;
  applicationNumber: string;
  fullName: string;
  email: string;
  position: string;
  status: string;
  submittedAt: string;
  experience: string;
  urgentFollowUp: boolean;
}

/**
 * DTO para filtros de búsqueda de aplicaciones
 */
export interface JobApplicationSearchDTO {
  position?: string | undefined;
  status?: string | undefined;
  experienceLevel?: string | undefined;
  startDate?: string | undefined;
  endDate?: string | undefined;
  skills?: string[] | undefined;
  availability?: string | undefined;
  remoteWork?: boolean | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
  sortBy?: 'submittedAt' | 'fullName' | 'position' | 'status' | undefined;
  sortOrder?: 'asc' | 'desc' | undefined;
}

/**
 * DTO para estadísticas de aplicaciones
 */
export interface JobApplicationStatsDTO {
  totalApplications: number;
  applicationsByStatus: Record<string, number>;
  applicationsByPosition: Record<string, number>;
  averageProcessingTime: number;
  recentApplications: number;
  urgentFollowUps: number;
  topSkills: Array<{ skill: string; count: number }>;
  applicationTrends: Array<{ date: string; count: number }>;
}

/**
 * DTO para validación de aplicación
 */
export interface JobApplicationValidationDTO {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  requiredFields: string[];
  optionalFields: string[];
}

/**
 * DTO para configuración de posiciones disponibles
 */
export interface JobPositionConfigDTO {
  id: string;
  title: string;
  department: string;
  level: 'junior' | 'mid' | 'senior' | 'lead';
  type: 'full-time' | 'part-time' | 'contract' | 'internship';
  remote: boolean;
  requirements: string[];
  preferredSkills: string[];
  salaryRange?: { min: number; max: number } | undefined;
  description: string;
  isActive: boolean;
}

/**
 * Validador para JobApplicationDTO
 */
export class JobApplicationDTOValidator {
  /**
   * Valida una solicitud de aplicación de trabajo
   */
  static validateJobApplicationRequest(dto: any): JobApplicationValidationDTO {
    const errors: string[] = [];
    const warnings: string[] = [];
    const requiredFields = ['sessionId', 'email', 'fullName', 'position', 'experience'];
    const optionalFields = ['phoneNumber', 'skills', 'education', 'availability', 'portfolio', 'coverLetter'];

    // Validar campos requeridos
    requiredFields.forEach(field => {
      if (!dto[field] || typeof dto[field] !== 'string' || dto[field].trim().length === 0) {
        errors.push(`${field} es requerido y no puede estar vacío`);
      }
    });

    // Validar email
    if (dto.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(dto.email)) {
        errors.push('Email debe tener un formato válido');
      }
    }

    // Validar nombre completo
    if (dto.fullName && dto.fullName.length < 2) {
      errors.push('Nombre completo debe tener al menos 2 caracteres');
    }

    // Validar teléfono si está presente
    if (dto.phoneNumber && typeof dto.phoneNumber === 'string') {
      const phoneRegex = /^\+?[\d\s\-\(\)]{8,15}$/;
      if (!phoneRegex.test(dto.phoneNumber)) {
        warnings.push('Formato de teléfono puede no ser válido');
      }
    }

    // Validar experiencia
    if (dto.experience && dto.experience.length < 10) {
      warnings.push('La descripción de experiencia es muy corta');
    }

    // Validar posición
    const validPositions = [
      'Desarrollador Frontend',
      'Desarrollador Backend',
      'Desarrollador Full Stack',
      'DevOps Engineer',
      'QA Engineer',
      'UI/UX Designer',
      'Project Manager',
      'Data Analyst',
      'Marketing Digital',
      'Ventas',
      'Otro'
    ];

    if (dto.position && !validPositions.includes(dto.position)) {
      warnings.push('Posición seleccionada no está en la lista predefinida');
    }

    // Validar booleanos
    ['relocate', 'remoteWork'].forEach(field => {
      if (dto[field] !== undefined && typeof dto[field] !== 'boolean') {
        warnings.push(`${field} debe ser true o false`);
      }
    });

    // Validar fecha de inicio
    if (dto.startDate) {
      const startDate = new Date(dto.startDate);
      if (isNaN(startDate.getTime())) {
        warnings.push('Fecha de inicio debe ser una fecha válida');
      } else if (startDate < new Date()) {
        warnings.push('Fecha de inicio no puede ser en el pasado');
      }
    }

    // Validar URLs
    ['portfolio', 'linkedIn', 'github'].forEach(field => {
      if (dto[field] && typeof dto[field] === 'string') {
        try {
          new URL(dto[field]);
        } catch {
          warnings.push(`${field} debe ser una URL válida`);
        }
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      requiredFields,
      optionalFields
    };
  }

  /**
   * Valida filtros de búsqueda
   */
  static validateJobApplicationSearch(dto: any): JobApplicationValidationDTO {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validar límites de paginación
    if (dto.limit !== undefined) {
      if (typeof dto.limit !== 'number' || dto.limit < 1 || dto.limit > 100) {
        errors.push('limit debe ser un número entre 1 y 100');
      }
    }

    if (dto.offset !== undefined) {
      if (typeof dto.offset !== 'number' || dto.offset < 0) {
        errors.push('offset debe ser un número mayor o igual a 0');
      }
    }

    // Validar fechas
    ['startDate', 'endDate'].forEach(field => {
      if (dto[field]) {
        const date = new Date(dto[field]);
        if (isNaN(date.getTime())) {
          errors.push(`${field} debe ser una fecha válida`);
        }
      }
    });

    // Validar orden
    if (dto.sortBy && !['submittedAt', 'fullName', 'position', 'status'].includes(dto.sortBy)) {
      errors.push('sortBy debe ser uno de: submittedAt, fullName, position, status');
    }

    if (dto.sortOrder && !['asc', 'desc'].includes(dto.sortOrder)) {
      errors.push('sortOrder debe ser asc o desc');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      requiredFields: [],
      optionalFields: ['position', 'status', 'experienceLevel', 'startDate', 'endDate']
    };
  }

  /**
   * Sanitiza los datos de la aplicación
   */
  static sanitizeJobApplicationRequest(dto: JobApplicationRequestDTO): JobApplicationRequestDTO {
    const sanitized: JobApplicationRequestDTO = {
      sessionId: dto.sessionId.trim(),
      email: dto.email.trim().toLowerCase(),
      fullName: dto.fullName.trim(),
      position: dto.position.trim(),
      experience: dto.experience.trim()
    };

    // Solo agregar campos opcionales si tienen valor
    if (dto.phoneNumber?.trim()) sanitized.phoneNumber = dto.phoneNumber.trim();
    if (dto.skills?.trim()) sanitized.skills = dto.skills.trim();
    if (dto.education?.trim()) sanitized.education = dto.education.trim();
    if (dto.availability?.trim()) sanitized.availability = dto.availability.trim();
    if (dto.portfolio?.trim()) sanitized.portfolio = dto.portfolio.trim();
    if (dto.coverLetter?.trim()) sanitized.coverLetter = dto.coverLetter.trim();
    if (dto.salary?.trim()) sanitized.salary = dto.salary.trim();
    if (dto.relocate !== undefined) sanitized.relocate = dto.relocate;
    if (dto.remoteWork !== undefined) sanitized.remoteWork = dto.remoteWork;
    if (dto.startDate?.trim()) sanitized.startDate = dto.startDate.trim();
    if (dto.references?.trim()) sanitized.references = dto.references.trim();
    if (dto.linkedIn?.trim()) sanitized.linkedIn = dto.linkedIn.trim();
    if (dto.github?.trim()) sanitized.github = dto.github.trim();
    if (dto.resume?.trim()) sanitized.resume = dto.resume.trim();
    if (dto.additionalInfo?.trim()) sanitized.additionalInfo = dto.additionalInfo.trim();

    return sanitized;
  }
}

/**
 * Helper para trabajar con JobApplicationDTOs
 */
export class JobApplicationDTOHelper {
  /**
   * Convierte datos de entidad a JobApplicationResponseDTO
   */
  static toResponseDTO(applicationData: {
    id: string;
    sessionId: string;
    email: string;
    fullName: string;
    phoneNumber?: string | undefined;
    position: string;
    status: string;
    timestamp: Date;
    processedAt?: Date | undefined;
    emailSent: boolean;
    followUpScheduled: boolean;
  }): JobApplicationResponseDTO {
    const response: JobApplicationResponseDTO = {
      id: applicationData.id,
      sessionId: applicationData.sessionId,
      email: applicationData.email,
      fullName: applicationData.fullName,
      position: applicationData.position,
      status: applicationData.status,
      submittedAt: applicationData.timestamp.toISOString(),
      emailSent: applicationData.emailSent,
      followUpScheduled: applicationData.followUpScheduled,
      applicationNumber: JobApplicationDTOHelper.generateApplicationNumber(applicationData.id, applicationData.timestamp)
    };

    // Solo agregar campos opcionales si tienen valor
    if (applicationData.phoneNumber) response.phoneNumber = applicationData.phoneNumber;
    if (applicationData.processedAt) response.processedAt = applicationData.processedAt.toISOString();

    return response;
  }

  /**
   * Genera número de aplicación único
   */
  static generateApplicationNumber(id: string, timestamp: Date): string {
    const year = timestamp.getFullYear();
    const month = (timestamp.getMonth() + 1).toString().padStart(2, '0');
    const shortId = id.substring(0, 6).toUpperCase();
    return `JOB${year}${month}-${shortId}`;
  }

  /**
   * Obtiene configuración por defecto de búsqueda
   */
  static getDefaultSearchConfig(): JobApplicationSearchDTO {
    return {
      limit: 20,
      offset: 0,
      sortBy: 'submittedAt',
      sortOrder: 'desc'
    };
  }

  /**
   * Convierte a resumen de aplicación
   */
  static toSummaryDTO(applicationData: {
    id: string;
    fullName: string;
    email: string;
    position: string;
    status: string;
    timestamp: Date;
    experience: string;
    urgentFollowUp: boolean;
  }): JobApplicationSummaryDTO {
    return {
      id: applicationData.id,
      applicationNumber: JobApplicationDTOHelper.generateApplicationNumber(applicationData.id, applicationData.timestamp),
      fullName: applicationData.fullName,
      email: applicationData.email,
      position: applicationData.position,
      status: applicationData.status,
      submittedAt: applicationData.timestamp.toISOString(),
      experience: applicationData.experience.substring(0, 100) + (applicationData.experience.length > 100 ? '...' : ''),
      urgentFollowUp: applicationData.urgentFollowUp
    };
  }

  /**
   * Obtiene posiciones disponibles por defecto
   */
  static getDefaultJobPositions(): JobPositionConfigDTO[] {
    return [
      {
        id: 'dev-frontend',
        title: 'Desarrollador Frontend',
        department: 'Tecnología',
        level: 'mid',
        type: 'full-time',
        remote: true,
        requirements: ['React', 'TypeScript', 'CSS'],
        preferredSkills: ['Next.js', 'Tailwind CSS', 'Git'],
        description: 'Desarrollador Frontend con experiencia en React y TypeScript',
        isActive: true
      },
      {
        id: 'dev-backend',
        title: 'Desarrollador Backend',
        department: 'Tecnología',
        level: 'mid',
        type: 'full-time',
        remote: true,
        requirements: ['Node.js', 'TypeScript', 'Database'],
        preferredSkills: ['Express', 'PostgreSQL', 'Docker'],
        description: 'Desarrollador Backend con experiencia en Node.js',
        isActive: true
      }
    ];
  }
}