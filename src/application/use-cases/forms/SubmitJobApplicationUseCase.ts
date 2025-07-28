// src/application/use-cases/forms/SubmitJobApplicationUseCase.ts

import { FormSubmission, FormSubmissionStatus } from '../../../domain/entities/FormSubmission';
import { FormType } from '../../../domain/enums/FormType';
import { Email } from '../../../domain/value-objects/Email';
import { PhoneNumber } from '../../../domain/value-objects/PhoneNumber';
import { JobApplicationRequestDTO, JobApplicationResponseDTO } from '../../dto/JobApplicationDTO';
import { IEmailService } from '../../interfaces/services/IEmailService';
import { IAIService } from '../../interfaces/services/IAIService';
import { ValidationException } from '../../exceptions/ValidationException';
import { EmailServiceException } from '../../exceptions/EmailServiceException';
import { logger } from '../../../shared/utils/Logger';
import { randomGenerator } from '../../../shared/utils/RandomGenerator';

/**
 * Opciones para el caso de uso de aplicación de trabajo
 */
export interface SubmitJobApplicationOptions {
  sendNotificationEmail?: boolean;
  sendConfirmationEmail?: boolean;
  validatePosition?: boolean;
  processResume?: boolean;
  scheduleFollowUp?: boolean;
  adminEmails?: string[];
  metadata?: Record<string, any>;
}

/**
 * Resultado del envío de aplicación
 */
export interface SubmitJobApplicationResult {
  application: JobApplicationResponseDTO;
  applicationNumber: string;
  emailsSent: {
    confirmation: boolean;
    notification: boolean;
  };
  validationWarnings: string[];
  processingTime: number;
  nextSteps: string[];
  metadata?: Record<string, any>;
}

/**
 * Contexto para el procesamiento de la aplicación
 */
interface ApplicationProcessingContext {
  submission: FormSubmission;
  position: JobPosition;
  applicantEmail: Email;
  applicantPhone?: PhoneNumber | undefined; // Explicitly allow undefined
  adminEmails: string[];
  resumeAnalysis?: ResumeAnalysis | undefined; // Explicitly allow undefined
  validationResults: ValidationResult[];
}

/**
 * Información de posición de trabajo
 */
interface JobPosition {
  id: string;
  title: string;
  department: string;
  level: 'junior' | 'mid' | 'senior' | 'lead';
  isActive: boolean;
  requirements: string[];
  preferredSkills: string[];
  description: string;
}

/**
 * Análisis de currículum
 */
interface ResumeAnalysis {
  skillsFound: string[];
  experienceLevel: 'junior' | 'mid' | 'senior';
  matchScore: number;
  recommendations: string[];
  redFlags: string[];
}

/**
 * Resultado de validación
 */
interface ValidationResult {
  field: string;
  isValid: boolean;
  message?: string;
  suggestion?: string;
}

/**
 * Caso de uso para procesar aplicaciones de trabajo
 */
export class SubmitJobApplicationUseCase {
  private readonly defaultAdminEmails = ['rrhh@intelcobro.com', 'admin@intelcobro.com'];

  constructor(
    private readonly emailService: IEmailService,
    private readonly aiService?: IAIService
  ) {}

  /**
   * Ejecuta el caso de uso de envío de aplicación
   */
  async execute(
    request: JobApplicationRequestDTO,
    options: SubmitJobApplicationOptions = {}
  ): Promise<SubmitJobApplicationResult> {
    const startTime = Date.now();
    
    try {
      // Validar entrada
      await this.validateRequest(request);
      
      // Crear contexto de procesamiento
      const context = await this.createProcessingContext(request, options);
      
      // Procesar la aplicación
      await this.processApplication(context, options);
      
      // Enviar emails si está habilitado
      const emailResults = await this.sendEmails(context, options);
      
      // Programar follow-up si es necesario
      if (options.scheduleFollowUp) {
        await this.scheduleFollowUp(context);
      }
      
      // Marcar como completado
      context.submission.markAsCompleted();
      
      const processingTime = Date.now() - startTime;
      
      // Log del resultado
      logger.info('Aplicación de trabajo procesada exitosamente', {
        applicationId: context.submission.id,
        position: request.position,
        applicantEmail: request.email,
        processingTime,
        emailsSent: emailResults
      });
      
      return {
        application: this.toResponseDTO(context.submission),
        applicationNumber: this.generateApplicationNumber(context.submission),
        emailsSent: emailResults,
        validationWarnings: this.extractWarnings(context.validationResults),
        processingTime,
        nextSteps: this.generateNextSteps(context),
        metadata: {
          matchScore: context.resumeAnalysis?.matchScore,
          experienceLevel: context.resumeAnalysis?.experienceLevel,
          ...options.metadata
        }
      };
      
    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      logger.error('Error al procesar aplicación de trabajo', error as Error, {
        position: request.position,
        applicantEmail: request.email,
        processingTime
      });
      
      throw error;
    }
  }

  /**
   * Valida la solicitud de aplicación
   */
  private async validateRequest(request: JobApplicationRequestDTO): Promise<void> {
    const errors: string[] = [];

    // Validar campos requeridos
    if (!request.sessionId?.trim()) errors.push('sessionId es requerido');
    if (!request.email?.trim()) errors.push('email es requerido');
    if (!request.fullName?.trim()) errors.push('fullName es requerido');
    if (!request.position?.trim()) errors.push('position es requerido');
    if (!request.experience?.trim()) errors.push('experience es requerido');

    // Validar email
    if (request.email) {
      try {
        new Email(request.email);
      } catch {
        errors.push('email debe tener un formato válido');
      }
    }

    // Validar teléfono si está presente
    if (request.phoneNumber) {
      try {
        new PhoneNumber(request.phoneNumber);
      } catch {
        errors.push('phoneNumber debe tener un formato válido');
      }
    }

    // Validar longitud de experiencia
    if (request.experience && request.experience.length < 10) {
      errors.push('La descripción de experiencia debe tener al menos 10 caracteres');
    }

    if (errors.length > 0) {
      throw ValidationException.multiple(
        errors.map(error => ({
          type: 'BUSINESS_RULE_VIOLATION' as any,
          field: 'general',
          message: error
        }))
      );
    }
  }

  /**
   * Crea el contexto de procesamiento
   */
  private async createProcessingContext(
    request: JobApplicationRequestDTO,
    options: SubmitJobApplicationOptions
  ): Promise<ApplicationProcessingContext> {
    // Crear entidades de valor
    const applicantEmail = new Email(request.email);
    const applicantPhone = request.phoneNumber ? new PhoneNumber(request.phoneNumber) : undefined;

    // Crear submission
    const submission = FormSubmission.createJobApplication(
      request.sessionId,
      applicantEmail,
      {
        fullName: request.fullName,
        position: request.position,
        experience: request.experience,
        skills: request.skills,
        education: request.education,
        availability: request.availability,
        portfolio: request.portfolio,
        coverLetter: request.coverLetter,
        salary: request.salary,
        relocate: request.relocate,
        remoteWork: request.remoteWork,
        startDate: request.startDate,
        references: request.references,
        linkedIn: request.linkedIn,
        github: request.github,
        resume: request.resume,
        additionalInfo: request.additionalInfo
      },
      applicantPhone
    );

    // Marcar como en procesamiento
    submission.markAsProcessing();

    // Obtener información de la posición
    const position = await this.getPositionInfo(request.position);

    // Analizar currículum si está habilitado
    let resumeAnalysis: ResumeAnalysis | undefined = undefined;
    if (options.processResume && this.aiService) {
      try {
        resumeAnalysis = await this.analyzeResume(request, position);
      } catch (error) {
        logger.warn('Error analizando currículum', {
          error: (error as Error).message
        });
      }
    }

    // Realizar validaciones adicionales
    const validationResults = await this.performAdditionalValidations(request, position);

    return {
      submission,
      position,
      applicantEmail,
      applicantPhone,
      adminEmails: options.adminEmails || this.defaultAdminEmails,
      resumeAnalysis,
      validationResults
    };
  }

  /**
   * Procesa la aplicación de trabajo
   */
  private async processApplication(
    context: ApplicationProcessingContext,
    options: SubmitJobApplicationOptions
  ): Promise<void> {
    // Añadir notas del análisis si existe
    if (context.resumeAnalysis) {
      const analysisNotes = this.generateProcessingNotes(context.resumeAnalysis);
      context.submission.addNotes(analysisNotes);
    }

    // Programar follow-up si es necesario
    if (this.requiresUrgentFollowUp(context)) {
      context.submission.scheduleFollowUp();
    }
  }

  /**
   * Envía emails correspondientes
   */
  private async sendEmails(
    context: ApplicationProcessingContext,
    options: SubmitJobApplicationOptions
  ): Promise<{ confirmation: boolean; notification: boolean }> {
    const results = { confirmation: false, notification: false };

    try {
      // Enviar confirmación al aplicante
      if (options.sendConfirmationEmail !== false) {
        await this.sendConfirmationEmail(context);
        context.submission.markEmailAsSent();
        results.confirmation = true;
      }

      // Enviar notificación a administradores
      if (options.sendNotificationEmail !== false) {
        await this.sendNotificationEmail(context);
        results.notification = true;
      }

    } catch (error) {
      logger.warn('Error al enviar emails, continuando procesamiento', {
        applicationId: context.submission.id,
        error: (error as Error).message
      });
      
      if (error instanceof EmailServiceException) {
        // No fallar todo el proceso por error de email
        context.submission.addNotes(`Error enviando emails: ${error.message}`);
      }
    }

    return results;
  }

  /**
   * Envía email de confirmación al aplicante
   */
  private async sendConfirmationEmail(context: ApplicationProcessingContext): Promise<void> {
    const emailContent = {
      to: context.applicantEmail.value,
      subject: `Confirmación de aplicación - ${context.position.title}`,
      html: this.generateConfirmationEmailHtml(context),
      text: this.generateConfirmationEmailText(context)
    };

    await this.emailService.sendEmail(emailContent);
  }

  /**
   * Envía notificación a administradores
   */
  private async sendNotificationEmail(context: ApplicationProcessingContext): Promise<void> {
    const emailContent = {
      to: context.adminEmails,
      subject: `Nueva aplicación: ${context.position.title} - ${context.submission.formData.fullName}`,
      html: this.generateNotificationEmailHtml(context),
      text: this.generateNotificationEmailText(context)
    };

    await this.emailService.sendEmail(emailContent);
  }

  /**
   * Analiza el currículum usando IA
   */
  private async analyzeResume(
    request: JobApplicationRequestDTO,
    position: JobPosition
  ): Promise<ResumeAnalysis> {
    if (!this.aiService) {
      throw new Error('AI service not available for resume analysis');
    }

    const prompt = `Analiza la siguiente aplicación de trabajo para la posición de ${position.title}:

Experiencia: ${request.experience}
Habilidades: ${request.skills || 'No especificadas'}
Educación: ${request.education || 'No especificada'}

Requisitos de la posición:
${position.requirements.join(', ')}

Habilidades preferidas:
${position.preferredSkills.join(', ')}

Proporciona un análisis con:
1. Habilidades encontradas que coinciden
2. Nivel de experiencia estimado
3. Puntuación de coincidencia (0-100)
4. Recomendaciones
5. Posibles áreas de preocupación`;

    try {
      const response = await this.aiService.generateResponse(prompt, {
        sessionId: request.sessionId,
        businessContext: 'resume_analysis',
        language: 'es'
      });

      return this.parseResumeAnalysis(response.content);
    } catch (error) {
      logger.warn('Error analizando currículum con IA', {
        position: position.title,
        error: (error as Error).message
      });

      // Análisis básico sin IA
      return this.basicResumeAnalysis(request, position);
    }
  }

  /**
   * Parsea la respuesta de IA para análisis de currículum
   */
  private parseResumeAnalysis(aiResponse: string): ResumeAnalysis {
    // Implementación simplificada - en producción usarías parsing más sofisticado
    return {
      skillsFound: [],
      experienceLevel: 'mid',
      matchScore: 75,
      recommendations: ['Revisar experiencia técnica'],
      redFlags: []
    };
  }

  /**
   * Análisis básico sin IA
   */
  private basicResumeAnalysis(
    request: JobApplicationRequestDTO,
    position: JobPosition
  ): ResumeAnalysis {
    const experienceText = request.experience.toLowerCase();
    const skillsText = (request.skills || '').toLowerCase();
    
    // Detectar nivel de experiencia por palabras clave
    let experienceLevel: 'junior' | 'mid' | 'senior' = 'junior';
    if (experienceText.includes('senior') || experienceText.includes('lead')) {
      experienceLevel = 'senior';
    } else if (experienceText.includes('años') && !experienceText.includes('1 año')) {
      experienceLevel = 'mid';
    }

    // Calcular coincidencia básica
    const foundSkills = position.requirements.filter(req => 
      experienceText.includes(req.toLowerCase()) || skillsText.includes(req.toLowerCase())
    );

    const matchScore = Math.round((foundSkills.length / position.requirements.length) * 100);

    return {
      skillsFound: foundSkills,
      experienceLevel,
      matchScore,
      recommendations: matchScore < 50 ? ['Revisar requisitos técnicos'] : [],
      redFlags: matchScore < 30 ? ['Experiencia técnica limitada'] : []
    };
  }

  /**
   * Realiza validaciones adicionales
   */
  private async performAdditionalValidations(
    request: JobApplicationRequestDTO,
    position: JobPosition
  ): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];

    // Validar disponibilidad vs posición
    if (request.availability && position.level === 'senior' && request.availability.includes('part-time')) {
      results.push({
        field: 'availability',
        isValid: false,
        message: 'Posiciones senior usualmente requieren dedicación completa',
        suggestion: 'Considerar disponibilidad full-time'
      });
    }

    // Validar salario vs nivel
    if (request.salary && position.level === 'junior' && request.salary.includes('senior')) {
      results.push({
        field: 'salary',
        isValid: false,
        message: 'Expectativas salariales pueden estar altas para nivel junior',
        suggestion: 'Revisar expectativas salariales para posición junior'
      });
    }

    return results;
  }

  /**
   * Genera notas de procesamiento
   */
  private generateProcessingNotes(analysis: ResumeAnalysis): string {
    const notes = [
      `Análisis automático de currículum:`,
      `- Nivel de experiencia: ${analysis.experienceLevel}`,
      `- Puntuación de coincidencia: ${analysis.matchScore}%`,
      `- Habilidades encontradas: ${analysis.skillsFound.join(', ')}`
    ];

    if (analysis.recommendations.length > 0) {
      notes.push(`- Recomendaciones: ${analysis.recommendations.join(', ')}`);
    }

    if (analysis.redFlags.length > 0) {
      notes.push(`- Áreas de atención: ${analysis.redFlags.join(', ')}`);
    }

    return notes.join('\n');
  }

  /**
   * Determina si requiere seguimiento urgente
   */
  private requiresUrgentFollowUp(context: ApplicationProcessingContext): boolean {
    if (context.resumeAnalysis?.matchScore && context.resumeAnalysis.matchScore > 85) {
      return true;
    }

    if (context.position.level === 'senior' && context.resumeAnalysis?.experienceLevel === 'senior') {
      return true;
    }

    return false;
  }

  /**
   * Programa follow-up
   */
  private async scheduleFollowUp(context: ApplicationProcessingContext): Promise<void> {
    // En una implementación real, esto programaría tareas en un sistema de colas
    context.submission.scheduleFollowUp();
    
    logger.info('Follow-up programado', {
      applicationId: context.submission.id,
      position: context.position.title,
      urgent: this.requiresUrgentFollowUp(context)
    });
  }

  /**
   * Obtiene información de la posición
   */
  private async getPositionInfo(positionTitle: string): Promise<JobPosition> {
    // En una implementación real, esto vendría de una base de datos
    const positions: Record<string, JobPosition> = {
      'Desarrollador Frontend': {
        id: 'dev-frontend',
        title: 'Desarrollador Frontend',
        department: 'Tecnología',
        level: 'mid',
        isActive: true,
        requirements: ['React', 'TypeScript', 'CSS', 'JavaScript'],
        preferredSkills: ['Next.js', 'Tailwind CSS', 'Git', 'Testing'],
        description: 'Desarrollador Frontend con experiencia en React'
      },
      'Desarrollador Backend': {
        id: 'dev-backend',
        title: 'Desarrollador Backend',
        department: 'Tecnología',
        level: 'mid',
        isActive: true,
        requirements: ['Node.js', 'TypeScript', 'Database', 'API'],
        preferredSkills: ['Express', 'PostgreSQL', 'Docker', 'AWS'],
        description: 'Desarrollador Backend con experiencia en Node.js'
      }
    };

    return positions[positionTitle] || {
      id: 'general',
      title: positionTitle,
      department: 'General',
      level: 'mid',
      isActive: true,
      requirements: [],
      preferredSkills: [],
      description: 'Posición general'
    };
  }

  /**
   * Extrae warnings de los resultados de validación
   */
  private extractWarnings(validationResults: ValidationResult[]): string[] {
    return validationResults
      .filter(result => !result.isValid)
      .map(result => result.message || 'Warning sin mensaje');
  }

  /**
   * Genera pasos siguientes
   */
  private generateNextSteps(context: ApplicationProcessingContext): string[] {
    const steps = [
      'Hemos recibido tu aplicación y la estamos revisando',
      'Te contactaremos dentro de 3-5 días hábiles'
    ];

    if (context.resumeAnalysis?.matchScore && context.resumeAnalysis.matchScore > 75) {
      steps.push('Tu perfil parece ser una buena coincidencia para la posición');
    }

    if (this.requiresUrgentFollowUp(context)) {
      steps.push('Priorizaremos la revisión de tu aplicación');
    }

    return steps;
  }

  /**
   * Genera número de aplicación
   */
  private generateApplicationNumber(submission: FormSubmission): string {
    const year = submission.timestamp.getFullYear();
    const month = (submission.timestamp.getMonth() + 1).toString().padStart(2, '0');
    const shortId = submission.id.substring(0, 6).toUpperCase();
    return `JOB${year}${month}-${shortId}`;
  }

  /**
   * Convierte a DTO de respuesta
   */
  private toResponseDTO(submission: FormSubmission): JobApplicationResponseDTO {
    return {
      id: submission.id,
      sessionId: submission.sessionId,
      email: submission.email.value,
      fullName: submission.formData.fullName,
      phoneNumber: submission.phoneNumber?.value || undefined,
      position: submission.formData.position,
      status: submission.status,
      submittedAt: submission.timestamp.toISOString(),
      processedAt: submission.processedAt?.toISOString() || undefined,
      emailSent: submission.emailSent,
      followUpScheduled: submission.followUpScheduled,
      applicationNumber: this.generateApplicationNumber(submission)
    };
  }

  /**
   * Genera HTML para email de confirmación
   */
  private generateConfirmationEmailHtml(context: ApplicationProcessingContext): string {
    const appNumber = this.generateApplicationNumber(context.submission);
    
    return `
      <h2>Confirmación de Aplicación - Intelcobro</h2>
      <p>Estimado/a ${context.submission.formData.fullName},</p>
      <p>Hemos recibido exitosamente tu aplicación para la posición de <strong>${context.position.title}</strong>.</p>
      <p><strong>Número de aplicación:</strong> ${appNumber}</p>
      <p><strong>Próximos pasos:</strong></p>
      <ul>
        <li>Revisaremos tu aplicación en los próximos 3-5 días hábiles</li>
        <li>Te contactaremos si tu perfil coincide con nuestros requisitos</li>
        <li>Puedes hacer seguimiento con tu número de aplicación</li>
      </ul>
      <p>Gracias por tu interés en formar parte del equipo de Intelcobro.</p>
      <p>Saludos,<br>Equipo de Recursos Humanos<br>Intelcobro</p>
    `;
  }

  /**
   * Genera texto plano para email de confirmación
   */
  private generateConfirmationEmailText(context: ApplicationProcessingContext): string {
    const appNumber = this.generateApplicationNumber(context.submission);
    
    return `
Confirmación de Aplicación - Intelcobro

Estimado/a ${context.submission.formData.fullName},

Hemos recibido exitosamente tu aplicación para la posición de ${context.position.title}.

Número de aplicación: ${appNumber}

Próximos pasos:
- Revisaremos tu aplicación en los próximos 3-5 días hábiles
- Te contactaremos si tu perfil coincide con nuestros requisitos
- Puedes hacer seguimiento con tu número de aplicación

Gracias por tu interés en formar parte del equipo de Intelcobro.

Saludos,
Equipo de Recursos Humanos
Intelcobro
    `.trim();
  }

  /**
   * Genera HTML para email de notificación
   */
  private generateNotificationEmailHtml(context: ApplicationProcessingContext): string {
    const appNumber = this.generateApplicationNumber(context.submission);
    
    return `
      <h2>Nueva Aplicación de Trabajo - ${context.position.title}</h2>
      <p><strong>Aplicante:</strong> ${context.submission.formData.fullName}</p>
      <p><strong>Email:</strong> ${context.applicantEmail.value}</p>
      <p><strong>Teléfono:</strong> ${context.applicantPhone?.toDisplayFormat() || 'No proporcionado'}</p>
      <p><strong>Posición:</strong> ${context.position.title}</p>
      <p><strong>Número de aplicación:</strong> ${appNumber}</p>
      
      <h3>Experiencia:</h3>
      <p>${context.submission.formData.experience}</p>
      
      ${context.submission.formData.skills ? `
        <h3>Habilidades:</h3>
        <p>${context.submission.formData.skills}</p>
      ` : ''}
      
      ${context.resumeAnalysis ? `
        <h3>Análisis Automático:</h3>
        <p><strong>Puntuación de coincidencia:</strong> ${context.resumeAnalysis.matchScore}%</p>
        <p><strong>Nivel de experiencia:</strong> ${context.resumeAnalysis.experienceLevel}</p>
        ${context.resumeAnalysis.redFlags.length > 0 ? `
          <p><strong>Áreas de atención:</strong> ${context.resumeAnalysis.redFlags.join(', ')}</p>
        ` : ''}
      ` : ''}
      
      <p><strong>Urgente:</strong> ${this.requiresUrgentFollowUp(context) ? 'Sí' : 'No'}</p>
      
      <hr>
      <p><em>Aplicación enviada desde el sistema de Intelcobro</em></p>
    `;
  }

  /**
   * Genera texto plano para email de notificación
   */
  private generateNotificationEmailText(context: ApplicationProcessingContext): string {
    const appNumber = this.generateApplicationNumber(context.submission);
    
    return `
Nueva Aplicación de Trabajo - ${context.position.title}

Aplicante: ${context.submission.formData.fullName}
Email: ${context.applicantEmail.value}
Teléfono: ${context.applicantPhone?.toDisplayFormat() || 'No proporcionado'}
Posición: ${context.position.title}
Número de aplicación: ${appNumber}

Experiencia:
${context.submission.formData.experience}

${context.submission.formData.skills ? `
Habilidades:
${context.submission.formData.skills}
` : ''}

${context.resumeAnalysis ? `
Análisis Automático:
Puntuación de coincidencia: ${context.resumeAnalysis.matchScore}%
Nivel de experiencia: ${context.resumeAnalysis.experienceLevel}
${context.resumeAnalysis.redFlags.length > 0 ? `
Áreas de atención: ${context.resumeAnalysis.redFlags.join(', ')}
` : ''}
` : ''}

Urgente: ${this.requiresUrgentFollowUp(context) ? 'Sí' : 'No'}

---
Aplicación enviada desde el sistema de Intelcobro
    `.trim();
  }
}