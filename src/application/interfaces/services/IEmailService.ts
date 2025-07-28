// src/application/interfaces/services/IEmailService.ts

import { FormType } from '../../../domain/enums/FormType';

/**
 * Configuración de email
 */
export interface EmailConfig {
  from: string;
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
}

/**
 * Destinatario de email
 */
export interface EmailRecipient {
  email: string;
  name?: string;
  type?: 'to' | 'cc' | 'bcc';
}

/**
 * Plantilla de email
 */
export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  htmlContent: string;
  textContent?: string;
  variables: string[];
  category: string;
  isActive: boolean;
}

/**
 * Variables para plantillas
 */
export interface EmailTemplateVariables {
  [key: string]: string | number | boolean | Date;
}

/**
 * Resultado del envío de email
 */
export interface EmailSendResult {
  messageId: string;
  accepted: string[];
  rejected: string[];
  pending?: string[];
  response?: string;
  envelope?: {
    from: string;
    to: string[];
  };
  timestamp: Date;
}

/**
 * Estado de entrega de email
 */
export interface EmailDeliveryStatus {
  messageId: string;
  email: string;
  status: 'sent' | 'delivered' | 'bounced' | 'complained' | 'opened' | 'clicked';
  timestamp: Date;
  details?: string;
  metadata?: Record<string, any>;
}

/**
 * Opciones para envío de email
 */
export interface EmailSendOptions {
  to: string | string[] | EmailRecipient[];
  subject: string;
  html?: string;
  text?: string;
  template?: {
    id: string;
    variables: EmailTemplateVariables;
  };
  attachments?: EmailAttachment[];
  config?: EmailConfig;
  scheduledAt?: Date;
  batchId?: string;
}

/**
 * Opciones para envío en lote
 */
export interface EmailBatchSendOptions {
  template: {
    id: string;
    subject: string;
  };
  recipients: Array<{
    email: string;
    name?: string;
    variables: EmailTemplateVariables;
  }>;
  config?: EmailConfig;
  batchSize?: number;
  delayBetweenBatches?: number;
}

/**
 * Resultado del envío en lote
 */
export interface EmailBatchSendResult {
  batchId: string;
  totalRecipients: number;
  successful: number;
  failed: number;
  results: EmailSendResult[];
  errors: Array<{
    email: string;
    error: string;
  }>;
}

/**
 * Opciones para validación de email
 */
export interface EmailValidationOptions {
  checkSyntax?: boolean;
  checkDomain?: boolean;
  checkMx?: boolean;
  checkDisposable?: boolean;
  timeout?: number;
}

/**
 * Resultado de validación de email
 */
export interface EmailValidationResult {
  email: string;
  isValid: boolean;
  syntax: {
    valid: boolean;
    reason?: string;
  };
  domain: {
    valid: boolean;
    exists: boolean;
    mxRecords?: string[];
  };
  disposable: {
    isDisposable: boolean;
    provider?: string;
  };
  suggestions?: string[];
}

/**
 * Estadísticas de email
 */
export interface EmailStats {
  sent: number;
  delivered: number;
  bounced: number;
  complained: number;
  opened: number;
  clicked: number;
  deliveryRate: number;
  openRate: number;
  clickRate: number;
  bounceRate: number;
  complaintRate: number;
}

/**
 * Lista de supresión
 */
export interface SuppressionList {
  email: string;
  reason: 'bounce' | 'complaint' | 'unsubscribe' | 'manual';
  addedAt: Date;
  details?: string;
}

/**
 * Interface principal del servicio de email
 */
export interface IEmailService {
  /**
   * Envía un email individual
   */
  sendEmail(options: EmailSendOptions): Promise<EmailSendResult>;

  /**
   * Envía emails en lote
   */
  sendBatch(options: EmailBatchSendOptions): Promise<EmailBatchSendResult>;

  /**
   * Envía email usando una plantilla
   */
  sendTemplate(
    templateId: string,
    to: string | EmailRecipient[],
    variables: EmailTemplateVariables,
    config?: EmailConfig
  ): Promise<EmailSendResult>;

  /**
   * Valida una dirección de email
   */
  validateEmail(
    email: string,
    options?: EmailValidationOptions
  ): Promise<EmailValidationResult>;

  /**
   * Valida múltiples direcciones de email
   */
  validateEmailBatch(
    emails: string[],
    options?: EmailValidationOptions
  ): Promise<EmailValidationResult[]>;

  /**
   * Obtiene el estado de entrega de un email
   */
  getDeliveryStatus(messageId: string): Promise<EmailDeliveryStatus>;

  /**
   * Obtiene estadísticas de email para un período
   */
  getStats(
    startDate: Date,
    endDate: Date,
    tags?: string[]
  ): Promise<EmailStats>;

  /**
   * Gestiona la lista de supresión
   */
  addToSuppressionList(
    email: string,
    reason: 'bounce' | 'complaint' | 'unsubscribe' | 'manual',
    details?: string
  ): Promise<void>;

  /**
   * Remueve de la lista de supresión
   */
  removeFromSuppressionList(email: string): Promise<void>;

  /**
   * Verifica si un email está en la lista de supresión
   */
  isInSuppressionList(email: string): Promise<boolean>;

  /**
   * Obtiene la lista de supresión
   */
  getSuppressionList(): Promise<SuppressionList[]>;

  /**
   * Gestiona plantillas de email
   */
  createTemplate(template: Omit<EmailTemplate, 'id'>): Promise<EmailTemplate>;
  updateTemplate(id: string, updates: Partial<EmailTemplate>): Promise<EmailTemplate>;
  deleteTemplate(id: string): Promise<void>;
  getTemplate(id: string): Promise<EmailTemplate>;
  listTemplates(category?: string): Promise<EmailTemplate[]>;

  /**
   * Programa un email para envío futuro
   */
  scheduleEmail(
    options: EmailSendOptions,
    scheduledAt: Date
  ): Promise<{ scheduleId: string }>;

  /**
   * Cancela un email programado
   */
  cancelScheduledEmail(scheduleId: string): Promise<void>;

  /**
   * Obtiene emails programados
   */
  getScheduledEmails(): Promise<Array<{
    scheduleId: string;
    scheduledAt: Date;
    status: 'pending' | 'sent' | 'cancelled';
    options: EmailSendOptions;
  }>>;

  /**
   * Verifica la disponibilidad del servicio
   */
  isAvailable(): Promise<boolean>;

  /**
   * Obtiene información de la configuración actual
   */
  getConfig(): Promise<{
    provider: string;
    dailyLimit?: number;
    usedToday?: number;
    features: string[];
  }>;
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
  }): Promise<EmailSendResult>;

  /**
   * Envía confirmación al aplicante
   */
  sendJobApplicationConfirmation(data: {
    applicantEmail: string;
    applicantName: string;
    position: string;
    applicationNumber: string;
  }): Promise<EmailSendResult>;

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
  }): Promise<EmailSendResult>;

  /**
   * Envía confirmación de solicitud de descuento
   */
  sendDiscountRequestConfirmation(data: {
    customerEmail: string;
    customerName: string;
    serviceInterest: string;
    quotationNumber: string;
    discountApplied?: string;
  }): Promise<EmailSendResult>;

  /**
   * Envía follow-up personalizado
   */
  sendFollowUp(data: {
    recipientEmail: string;
    recipientName: string;
    formType: FormType;
    customMessage?: string;
    attachments?: EmailAttachment[];
  }): Promise<EmailSendResult>;

  /**
   * Envía recordatorio de descuento próximo a expirar
   */
  sendDiscountExpiryReminder(data: {
    customerEmail: string;
    customerName: string;
    discountCode: string;
    discountPercentage: number;
    expiresAt: Date;
  }): Promise<EmailSendResult>;
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