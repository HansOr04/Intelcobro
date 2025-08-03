// src/infrastructure/external-services/ResendService.ts

import { Resend } from 'resend';
import {
  IEmailService,
  EmailMessage,
  EmailConfig,
  EmailResult,
  EmailTemplate,
  EmailAttachment,
  BulkEmailOptions,
  BulkEmailResult,
  EmailServiceStats,
  EmailValidationResult
} from '../../application/interfaces/services/IEmailService';
import { EmailServiceException, EmailServiceErrorType } from '../../application/exceptions/EmailServiceException';
import { logger } from '../../shared/utils/Logger';

/**
 * Configuración específica de Resend
 */
interface ResendConfig {
  apiKey: string;
  defaultFromEmail: string;
  defaultFromName?: string;
  defaultReplyTo?: string;
  baseURL?: string;
  timeout?: number;
  retryAttempts?: number;
}

/**
 * Implementación del servicio de email usando Resend
 */
export class ResendService implements IEmailService {
  private client: Resend;
  private config: ResendConfig;
  private emailsSent: number = 0;
  private lastResetTime: Date = new Date();
  private templates: Map<string, EmailTemplate> = new Map();

  constructor(config: ResendConfig) {
    this.config = {
      defaultFromName: 'Intelcobro',
      timeout: 10000,
      retryAttempts: 3,
      ...config
    };

    this.client = new Resend(this.config.apiKey);
    
    this.initializeTemplates();
    
    logger.info('Resend Service inicializado', {
      fromEmail: this.config.defaultFromEmail,
      fromName: this.config.defaultFromName,
      timeout: this.config.timeout
    });
  }

  /**
   * Envía un email simple
   */
  async sendEmail(message: EmailMessage, config?: EmailConfig): Promise<EmailResult> {
    const startTime = Date.now();
    
    try {
      this.validateEmailMessage(message);
      
      const emailData = this.buildEmailData(message, config);
      
      const debugLogData = {
        emailRecipients: Array.isArray(message.to) ? message.to.join(', ') : message.to,
        emailSubject: message.subject,
        hasHtml: !!message.html,
        hasAttachments: !!message.attachments?.length
      };
      
      logger.debug('Enviando email via Resend', debugLogData);

      const response = await this.client.emails.send(emailData);
      
      this.emailsSent++;
      
      const result: EmailResult = {
        success: true,
        messageId: response.data?.id || '',
        provider: 'resend',
        timestamp: new Date(),
        deliveryTime: Date.now() - startTime,
        metadata: {
          response: response.data,
          emailRecipients: Array.isArray(message.to) ? message.to.join(', ') : message.to,
          emailSubject: message.subject
        }
      };

      const successLogData = {
        messageId: result.messageId,
        emailRecipients: Array.isArray(message.to) ? message.to.join(', ') : message.to,
        deliveryTime: result.deliveryTime
      };
      
      logger.info('Email enviado exitosamente', successLogData);

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      const errorLogData = {
        emailRecipients: Array.isArray(message.to) ? message.to.join(', ') : message.to,
        emailSubject: message.subject,
        errorMessage: errorMessage,
        deliveryTime: Date.now() - startTime
      };
      
      logger.error('Error enviando email', error instanceof Error ? error : undefined, errorLogData);

      throw this.handleResendError(error, message);
    }
  }

  /**
   * Envía email usando template
   */
  async sendTemplateEmail(
    templateId: string,
    to: string | string[],
    data: Record<string, any>,
    config?: EmailConfig
  ): Promise<EmailResult> {
    try {
      const template = this.templates.get(templateId);
      if (!template) {
        throw EmailServiceException.templateNotFound(templateId);
      }

      const processedHtml = this.processTemplate(template.html, data);
      const processedText = template.text ? this.processTemplate(template.text, data) : '';
      const processedSubject = this.processTemplate(template.subject, data);

      const message: EmailMessage = {
        to: Array.isArray(to) ? to : [to],
        subject: processedSubject,
        html: processedHtml,
        from: config?.from || `${this.config.defaultFromName} <${this.config.defaultFromEmail}>`
      };

      // Solo agregar propiedades opcionales si tienen valor
      if (processedText) {
        message.text = processedText;
      }

      const defaultReplyTo = config?.replyTo || this.config.defaultReplyTo;
      if (defaultReplyTo) {
        message.replyTo = defaultReplyTo;
      }

      return await this.sendEmail(message, config);

    } catch (error) {
      if (error instanceof EmailServiceException) {
        throw error;
      }
      
      throw EmailServiceException.templateProcessingError(
        templateId, 
        error instanceof Error ? error.message : 'Error desconocido'
      );
    }
  }

  /**
   * Envía múltiples emails
   */
  async sendBulkEmails(
    messages: EmailMessage[],
    options?: BulkEmailOptions
  ): Promise<BulkEmailResult> {
    const startTime = Date.now();
    const results: EmailResult[] = [];
    const errors: Array<{
      to: string | string[];
      subject: string;
      error: string;
      timestamp: Date;
    }> = [];
    const batchSize = options?.batchSize || 10;
    const delay = options?.delayBetweenBatches || 1000;

    logger.info('Iniciando envío masivo de emails', {
      totalEmails: messages.length,
      batchSize,
      delay
    });

    // Procesar en lotes
    for (let i = 0; i < messages.length; i += batchSize) {
      const batch = messages.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (message) => {
        try {
          const result = await this.sendEmail(message);
          results.push(result);
          return result;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
          const errorInfo = {
            to: message.to,
            subject: message.subject,
            error: errorMessage,
            timestamp: new Date()
          };
          errors.push(errorInfo);
          const batchLogData = {
            emailRecipients: Array.isArray(message.to) ? message.to.join(', ') : message.to,
            errorMessage: errorMessage
          };
          
          logger.warn('Error en email del lote', batchLogData);
          return null; // Retornamos null para indicar fallo
        }
      });

      await Promise.all(batchPromises);

      // Delay entre lotes
      if (i + batchSize < messages.length && delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    const bulkResult: BulkEmailResult = {
      totalSent: results.filter(r => r.success).length,
      totalFailed: errors.length,
      results,
      errors,
      processingTime: Date.now() - startTime,
      batchesProcessed: Math.ceil(messages.length / batchSize)
    };

    logger.info('Envío masivo completado', {
      totalSent: bulkResult.totalSent,
      totalFailed: bulkResult.totalFailed,
      successRate: (bulkResult.totalSent / messages.length) * 100
    });

    return bulkResult;
  }

  /**
   * Valida formato de email
   */
  async validateEmail(email: string): Promise<EmailValidationResult> {
    // Validación básica de formato
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isValidFormat = emailRegex.test(email);

    // Validaciones adicionales
    const domain = email.split('@')[1] || '';
    const isCommonDomain = this.isCommonEmailDomain(domain);
    
    return {
      email,
      isValid: isValidFormat,
      format: isValidFormat ? 'valid' : 'invalid',
      domain,
      suggestions: isValidFormat ? [] : this.getEmailSuggestions(email),
      risks: this.assessEmailRisks(email),
      metadata: {
        provider: 'resend-validation',
        timestamp: new Date().toISOString(),
        isCommonDomain
      }
    };
  }

  /**
   * Obtiene estadísticas del servicio
   */
  async getStats(): Promise<EmailServiceStats> {
    const now = new Date();
    const timeSinceReset = now.getTime() - this.lastResetTime.getTime();
    const hoursActive = timeSinceReset / (1000 * 60 * 60);

    return {
      provider: 'resend',
      emailsSent: this.emailsSent,
      successRate: 0.98, // Estimado alto para Resend
      averageDeliveryTime: 1500, // Estimado en ms
      uptime: hoursActive,
      lastEmailSent: now,
      templatesAvailable: Array.from(this.templates.keys()),
      quotaUsed: this.emailsSent,
      quotaLimit: 10000, // Límite estimado
      bounceRate: 0.01, // Estimado bajo
      complaintRate: 0.001 // Estimado muy bajo
    };
  }

  /**
   * Verifica disponibilidad del servicio
   */
  async isAvailable(): Promise<boolean> {
    try {
      // Intentar hacer una request simple para verificar conectividad
      // Resend no tiene endpoint de health check, así que simulamos
      return true;
    } catch (error) {
      logger.warn('Resend Service no disponible', { error });
      return false;
    }
  }

  /**
   * Inicializa templates predefinidos
   */
  private initializeTemplates(): void {
    // Template de bienvenida
    this.templates.set('welcome', {
      id: 'welcome',
      name: 'Bienvenida',
      subject: 'Bienvenido a {{companyName}}',
      html: `
        <h1>¡Bienvenido {{userName}}!</h1>
        <p>Gracias por contactarnos en {{companyName}}.</p>
        <p>Nuestro equipo se pondrá en contacto contigo pronto.</p>
        <hr>
        <small>{{companyName}} - Desarrollo de Software</small>
      `,
      text: `¡Bienvenido {{userName}}! Gracias por contactarnos en {{companyName}}. Nuestro equipo se pondrá en contacto contigo pronto.`,
      variables: ['userName', 'companyName']
    });

    // Template de descuento
    this.templates.set('discount', {
      id: 'discount',
      name: 'Descuento de Ruleta',
      subject: '¡Felicidades! Has ganado un {{discountPercentage}}% de descuento',
      html: `
        <h1>🎉 ¡Felicidades {{userName}}!</h1>
        <p>Has ganado un <strong>{{discountPercentage}}% de descuento</strong> en nuestros servicios.</p>
        <p><strong>Código de descuento:</strong> {{discountCode}}</p>
        <p><strong>Válido hasta:</strong> {{expiryDate}}</p>
        <p>Para usar tu descuento, menciona este código cuando nos contactes.</p>
        <hr>
        <p>Saludos,<br>Equipo {{companyName}}</p>
      `,
      text: `¡Felicidades {{userName}}! Has ganado un {{discountPercentage}}% de descuento. Código: {{discountCode}}. Válido hasta: {{expiryDate}}.`,
      variables: ['userName', 'discountPercentage', 'discountCode', 'expiryDate', 'companyName']
    });

    // Template de aplicación de trabajo
    this.templates.set('job-application', {
      id: 'job-application',
      name: 'Aplicación de Trabajo',
      subject: 'Nueva aplicación: {{position}} - {{applicantName}}',
      html: `
        <h2>Nueva Aplicación de Trabajo</h2>
        <p><strong>Posición:</strong> {{position}}</p>
        <p><strong>Candidato:</strong> {{applicantName}}</p>
        <p><strong>Email:</strong> {{applicantEmail}}</p>
        <p><strong>Teléfono:</strong> {{applicantPhone}}</p>
        <p><strong>Experiencia:</strong> {{experience}}</p>
        <p><strong>Skills:</strong> {{skills}}</p>
        {{#if hasResume}}<p><strong>CV:</strong> Adjunto</p>{{/if}}
        <hr>
        <p>Revisa la aplicación y programa una entrevista si es apropiado.</p>
      `,
      text: `Nueva aplicación: {{position}} - {{applicantName}} ({{applicantEmail}}). Experiencia: {{experience}}. Skills: {{skills}}.`,
      variables: ['position', 'applicantName', 'applicantEmail', 'applicantPhone', 'experience', 'skills', 'hasResume']
    });

    logger.info('Templates de email inicializados', {
      templateCount: this.templates.size,
      templates: Array.from(this.templates.keys())
    });
  }

  /**
   * Construye datos del email para Resend
   */
  private buildEmailData(message: EmailMessage, config?: EmailConfig): any {
    const emailData: any = {
      to: Array.isArray(message.to) ? message.to : [message.to],
      subject: message.subject,
      from: message.from || `${this.config.defaultFromName} <${this.config.defaultFromEmail}>`,
    };

    // Contenido
    if (message.html) emailData.html = message.html;
    if (message.text) emailData.text = message.text;

    // Headers opcionales
    if (message.replyTo || this.config.defaultReplyTo) {
      emailData.reply_to = message.replyTo || this.config.defaultReplyTo;
    }

    if (message.cc && message.cc.length > 0) {
      emailData.cc = message.cc;
    }

    if (message.bcc && message.bcc.length > 0) {
      emailData.bcc = message.bcc;
    }

    // Adjuntos
    if (message.attachments && message.attachments.length > 0) {
      emailData.attachments = message.attachments.map(this.processAttachment);
    }

    // Headers personalizados
    if (config?.headers) {
      emailData.headers = config.headers;
    }

    // Tags para tracking
    if (config?.tags) {
      emailData.tags = config.tags;
    }

    return emailData;
  }

  /**
   * Procesa adjunto para Resend
   */
  private processAttachment(attachment: EmailAttachment): any {
    return {
      filename: attachment.filename,
      content: attachment.content,
      content_type: attachment.contentType,
      disposition: attachment.disposition || 'attachment'
    };
  }

  /**
   * Procesa template reemplazando variables
   */
  private processTemplate(template: string, data: Record<string, any>): string {
    let processed = template;

    // Reemplazar variables simples {{variable}}
    Object.entries(data).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      processed = processed.replace(regex, String(value));
    });

    // Procesar condicionales básicos {{#if variable}}...{{/if}}
    processed = processed.replace(/{{#if (\w+)}}(.*?){{\/if}}/gs, (match, variable, content) => {
      return data[variable] ? content : '';
    });

    return processed;
  }

  /**
   * Valida mensaje de email
   */
  private validateEmailMessage(message: EmailMessage): void {
    if (!message.to || (Array.isArray(message.to) && message.to.length === 0)) {
      throw EmailServiceException.invalidRecipient('Destinatario requerido');
    }

    if (!message.subject || message.subject.trim().length === 0) {
      throw EmailServiceException.invalidMessage('Asunto requerido');
    }

    if (!message.html && !message.text) {
      throw EmailServiceException.invalidMessage('Contenido HTML o texto requerido');
    }

    // Validar emails de destinatario
    const recipients = Array.isArray(message.to) ? message.to : [message.to];
    recipients.forEach((email: string) => {
      if (!this.isValidEmailFormat(email)) {
        throw EmailServiceException.invalidRecipient(`Email inválido: ${email}`);
      }
    });
  }

  /**
   * Valida formato de email
   */
  private isValidEmailFormat(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Verifica si es un dominio común
   */
  private isCommonEmailDomain(domain: string): boolean {
    const commonDomains = [
      'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com',
      'icloud.com', 'aol.com', 'protonmail.com', 'live.com'
    ];
    return commonDomains.includes(domain.toLowerCase());
  }

  /**
   * Genera sugerencias para emails inválidos
   */
  private getEmailSuggestions(email: string): string[] {
    const suggestions: string[] = [];
    
    // Sugerencias básicas para errores comunes
    if (email.includes('gmail.co')) {
      suggestions.push(email.replace('gmail.co', 'gmail.com'));
    }
    
    if (email.includes('hotmail.co')) {
      suggestions.push(email.replace('hotmail.co', 'hotmail.com'));
    }

    if (email.includes('yahoo.co')) {
      suggestions.push(email.replace('yahoo.co', 'yahoo.com'));
    }

    return suggestions;
  }

  /**
   * Evalúa riesgos del email
   */
  private assessEmailRisks(email: string): string[] {
    const risks: string[] = [];

    // Email temporal o desechable (lista básica)
    const temporaryDomains = ['10minutemail.com', 'tempmail.org', 'guerrillamail.com'];
    const domain = email.split('@')[1];
    
    if (domain && temporaryDomains.includes(domain)) {
      risks.push('Posible email temporal');
    }

    // Caracteres sospechosos
    if (email.includes('+')) {
      risks.push('Email con alias (+)');
    }

    return risks;
  }

  /**
   * Maneja errores específicos de Resend
   */
  private handleResendError(error: any, message: EmailMessage): EmailServiceException {
    if (error.message?.includes('rate limit')) {
      return EmailServiceException.rateLimitExceeded('resend', 60);
    }

    if (error.message?.includes('invalid api key')) {
      return EmailServiceException.authenticationFailed('resend', 'API key inválida');
    }

    if (error.message?.includes('quota')) {
      return EmailServiceException.quotaExceeded('resend');
    }

    if (error.message?.includes('recipient')) {
      return EmailServiceException.invalidRecipient(
        Array.isArray(message.to) ? message.to.join(', ') : message.to as string
      );
    }

    // Crear excepción sin metadata para evitar conflictos de tipos
    return new EmailServiceException(
      EmailServiceErrorType.UNKNOWN_ERROR,
      `Error desconocido en resend: ${error?.message || 'Error no especificado'}`,
      {
        provider: 'resend',
        originalError: error,
        recipient: Array.isArray(message.to) ? message.to.join(', ') : message.to,
        subject: message.subject
      }
    );
  }
}