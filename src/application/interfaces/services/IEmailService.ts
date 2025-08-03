// src/application/interfaces/services/IEmailService.ts

import { FormType } from '../../../domain/enums/FormType';

/**
 * Configuración de email
 */
export interface EmailConfig {
  from?: string;
  replyTo?: string;
  tags?: string[];
  headers?: Record<string, string>;
  priority?: 'high' | 'normal' | 'low';
  trackClicks?: boolean;
  trackOpens?: boolean;
}

/**
 * Adjunto de email
 */
export interface EmailAttachment {
  filename: string;
  content: Buffer | string;
  contentType: string;
  encoding?: string;
  size?: number;
  disposition?: string;
}

/**
 * Mensaje de email
 */
export interface EmailMessage {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  replyTo?: string;
  cc?: string[];
  bcc?: string[];
  attachments?: EmailAttachment[];
}

/**
 * Resultado del envío de email
 */
export interface EmailResult {
  success: boolean;
  messageId: string;
  provider: string;
  timestamp: Date;
  deliveryTime: number;
  metadata?: Record<string, any>;
}

/**
 * Opciones para envío en lote
 */
export interface BulkEmailOptions {
  batchSize?: number;
  delayBetweenBatches?: number;
}

/**
 * Resultado del envío en lote
 */
export interface BulkEmailResult {
  totalSent: number;
  totalFailed: number;
  results: EmailResult[];
  errors: Array<{
    to: string | string[];
    subject: string;
    error: string;
    timestamp: Date;
  }>;
  processingTime: number;
  batchesProcessed: number;
}

/**
 * Plantilla de email
 */
export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  html: string;
  text?: string;
  variables: string[];
}

/**
 * Variables para plantillas
 */
export interface EmailTemplateVariables {
  [key: string]: string | number | boolean | Date;
}

/**
 * Resultado de validación de email
 */
export interface EmailValidationResult {
  email: string;
  isValid: boolean;
  format: 'valid' | 'invalid';
  domain: string;
  suggestions: string[];
  risks: string[];
  metadata: Record<string, any>;
}

/**
 * Estadísticas del servicio de email
 */
export interface EmailServiceStats {
  provider: string;
  emailsSent: number;
  successRate: number;
  averageDeliveryTime: number;
  uptime: number;
  lastEmailSent: Date;
  templatesAvailable: string[];
  quotaUsed: number;
  quotaLimit: number;
  bounceRate: number;
  complaintRate: number;
}

/**
 * Interface principal del servicio de email (simplificada)
 */
export interface IEmailService {
  /**
   * Envía un email individual
   */
  sendEmail(message: EmailMessage, config?: EmailConfig): Promise<EmailResult>;

  /**
   * Envía email usando una plantilla
   */
  sendTemplateEmail(
    templateId: string,
    to: string | string[],
    data: Record<string, any>,
    config?: EmailConfig
  ): Promise<EmailResult>;

  /**
   * Envía múltiples emails
   */
  sendBulkEmails(
    messages: EmailMessage[],
    options?: BulkEmailOptions
  ): Promise<BulkEmailResult>;

  /**
   * Valida una dirección de email
   */
  validateEmail(email: string): Promise<EmailValidationResult>;

  /**
   * Obtiene estadísticas del servicio
   */
  getStats(): Promise<EmailServiceStats>;

  /**
   * Verifica la disponibilidad del servicio
   */
  isAvailable(): Promise<boolean>;
}

/**
 * Interface para servicio específico de notificaciones por formularios
 */
export interface IFormEmailService {
  /**
   * Envía notificación de nueva aplicación de trabajo
   */
  sendJobApplicationNotification(data: {
    formSubmissionId: string;
    applicantName: string;
    applicantEmail: string;
    position: string;
    experience: string;
    resumeUrl?: string;
    adminEmails: string[];
  }): Promise<EmailResult>;

  /**
   * Envía confirmación al aplicante
   */
  sendJobApplicationConfirmation(data: {
    applicantEmail: string;
    applicantName: string;
    position: string;
    applicationNumber: string;
  }): Promise<EmailResult>;

  /**
   * Envía notificación de solicitud de descuento
   */
  sendDiscountRequestNotification(data: {
    formSubmissionId: string;
    customerName: string;
    customerEmail: string;
    serviceInterest: string;
    budget?: string;
    discountCode?: string;
    adminEmails: string[];
  }): Promise<EmailResult>;

  /**
   * Envía confirmación de solicitud de descuento
   */
  sendDiscountRequestConfirmation(data: {
    customerEmail: string;
    customerName: string;
    serviceInterest: string;
    quotationNumber: string;
    discountApplied?: string;
  }): Promise<EmailResult>;

  /**
   * Envía follow-up personalizado
   */
  sendFollowUp(data: {
    recipientEmail: string;
    recipientName: string;
    formType: FormType;
    customMessage?: string;
    attachments?: EmailAttachment[];
  }): Promise<EmailResult>;

  /**
   * Envía recordatorio de descuento próximo a expirar
   */
  sendDiscountExpiryReminder(data: {
    customerEmail: string;
    customerName: string;
    discountCode: string;
    discountPercentage: number;
    expiresAt: Date;
  }): Promise<EmailResult>;
}

/**
 * Factory para crear instancias del servicio de email
 */
export interface IEmailServiceFactory {
  /**
   * Crea una instancia del servicio con configuración específica
   */
  create(config: {
    provider: 'resend' | 'sendgrid' | 'ses';
    apiKey: string;
    defaultFrom: string;
    webhookUrl?: string;
  }): IEmailService;

  /**
   * Crea una instancia con configuración por defecto
   */
  createDefault(): IEmailService;

  /**
   * Crea servicio específico para formularios
   */
  createFormService(): IFormEmailService;
}

/**
 * Constantes para el servicio de email
 */
export const EMAIL_SERVICE_CONSTANTS = {
  MAX_RECIPIENTS_PER_EMAIL: 50,
  MAX_ATTACHMENT_SIZE: 25 * 1024 * 1024, // 25MB
  MAX_ATTACHMENTS_PER_EMAIL: 10,
  
  DEFAULT_TIMEOUT: 30000,
  BATCH_SIZE: 100,
  BATCH_DELAY: 1000,
  
  TEMPLATE_CATEGORIES: [
    'welcome',
    'notification',
    'confirmation',
    'reminder',
    'marketing',
    'transactional'
  ],
  
  PRIORITY_LEVELS: ['high', 'normal', 'low'],
  
  SUPPORTED_PROVIDERS: ['resend', 'sendgrid', 'ses'],
  
  DEFAULT_TEMPLATES: {
    JOB_APPLICATION_NOTIFICATION: 'job-application-notification',
    JOB_APPLICATION_CONFIRMATION: 'job-application-confirmation',
    DISCOUNT_REQUEST_NOTIFICATION: 'discount-request-notification',
    DISCOUNT_REQUEST_CONFIRMATION: 'discount-request-confirmation',
    DISCOUNT_EXPIRY_REMINDER: 'discount-expiry-reminder',
    FOLLOW_UP: 'follow-up'
  }
} as const;

/**
 * Helper para crear contenido de email
 */
export class EmailContentHelper {
  /**
   * Genera asunto personalizado basado en el tipo de formulario
   */
  static generateSubject(formType: FormType, data: Record<string, any>): string {
    switch (formType) {
      case FormType.JOB_APPLICATION:
        return `Nueva aplicación para ${data.position} - ${data.applicantName}`;
      case FormType.DISCOUNT_REQUEST:
        return `Solicitud de descuento - ${data.serviceInterest} - ${data.customerName}`;
      case FormType.CONTACT:
        return `Nuevo mensaje de contacto - ${data.name}`;
      default:
        return `Nuevo envío de formulario - ${data.name || 'Cliente'}`;
    }
  }

  /**
   * Genera variables de plantilla estándar
   */
  static generateTemplateVariables(
    formType: FormType,
    formData: Record<string, any>
  ): EmailTemplateVariables {
    const baseVariables: EmailTemplateVariables = {
      timestamp: new Date(),
      companyName: 'Intelcobro',
      supportEmail: 'soporte@intelcobro.com',
      websiteUrl: 'https://intelcobro.com'
    };

    switch (formType) {
      case FormType.JOB_APPLICATION:
        return {
          ...baseVariables,
          applicantName: formData.fullName,
          position: formData.position,
          experience: formData.experience,
          applicationNumber: formData.applicationNumber || 'Pendiente'
        };
      
      case FormType.DISCOUNT_REQUEST:
        return {
          ...baseVariables,
          customerName: formData.fullName,
          serviceInterest: formData.serviceInterest,
          budget: formData.budget || 'No especificado',
          quotationNumber: formData.quotationNumber || 'Pendiente'
        };
      
      default:
        return {
          ...baseVariables,
          customerName: formData.fullName || formData.name,
          message: formData.message || ''
        };
    }
  }

  /**
   * Sanitiza contenido HTML para email
   */
  static sanitizeHtml(html: string): string {
    // Implementación básica - en producción usar una librería como DOMPurify
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .replace(/javascript:/gi, '');
  }

  /**
   * Convierte HTML a texto plano
   */
  static htmlToText(html: string): string {
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<p\b[^>]*>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\n\s*\n/g, '\n\n')
      .trim();
  }
}