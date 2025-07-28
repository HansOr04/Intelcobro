// src/domain/entities/FormSubmission.ts

import { FormType } from '../enums/FormType';
import { Email } from '../value-objects/Email';
import { PhoneNumber } from '../value-objects/PhoneNumber';

/**
 * Estado de procesamiento del formulario
 */
export enum FormSubmissionStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED'
}

/**
 * Entidad que representa un envío de formulario
 */
export class FormSubmission {
  private readonly _id: string;
  private readonly _sessionId: string;
  private readonly _formType: FormType;
  private readonly _email: Email;
  private readonly _formData: Record<string, any>;
  private readonly _timestamp: Date;
  private readonly _userIp?: string | undefined;
  private readonly _userAgent?: string | undefined;
  private _status: FormSubmissionStatus;
  private _phoneNumber?: PhoneNumber | undefined;
  private _processedAt?: Date;
  private _errorMessage?: string;
  private _emailSent: boolean;
  private _emailSentAt?: Date;
  private _followUpScheduled: boolean;
  private _notes?: string;

  constructor(
    id: string,
    sessionId: string,
    formType: FormType,
    email: Email,
    formData: Record<string, any>,
    userIp?: string,
    userAgent?: string,
    phoneNumber?: PhoneNumber
  ) {
    this.validateInputs(id, sessionId, formType, formData);

    this._id = id;
    this._sessionId = sessionId;
    this._formType = formType;
    this._email = email;
    this._formData = { ...formData };
    this._timestamp = new Date();
    this._userIp = userIp || undefined;
    this._userAgent = userAgent || undefined;
    this._status = FormSubmissionStatus.PENDING;
    this._phoneNumber = phoneNumber || undefined;
    this._emailSent = false;
    this._followUpScheduled = false;
  }

  /**
   * Valida los inputs del constructor
   */
  private validateInputs(
    id: string,
    sessionId: string,
    formType: FormType,
    formData: Record<string, any>
  ): void {
    if (!id || id.trim().length === 0) {
      throw new Error('El ID del formulario es requerido');
    }

    if (!sessionId || sessionId.trim().length === 0) {
      throw new Error('El session ID es requerido');
    }

    if (!Object.values(FormType).includes(formType)) {
      throw new Error('Tipo de formulario no válido');
    }

    if (!formData || Object.keys(formData).length === 0) {
      throw new Error('Los datos del formulario son requeridos');
    }

    // Validar campos requeridos según el tipo de formulario
    this.validateRequiredFields(formType, formData);
  }

  /**
   * Valida que los campos requeridos estén presentes según el tipo de formulario
   */
  private validateRequiredFields(formType: FormType, formData: Record<string, any>): void {
    const getRequiredFields = (type: FormType): string[] => {
      switch (type) {
        case FormType.JOB_APPLICATION:
          return ['fullName', 'position', 'experience'];
        case FormType.DISCOUNT_REQUEST:
          return ['fullName', 'serviceInterest'];
        case FormType.CONTACT:
          return ['fullName', 'message'];
        case FormType.FEEDBACK:
          return ['rating', 'comments'];
        case FormType.NEWSLETTER:
          return [];
        case FormType.SERVICE_INQUIRY:
          return ['fullName', 'serviceType', 'message'];
        default:
          return [];
      }
    };

    const required = getRequiredFields(formType);
    const missing = required.filter(field => !formData[field] || formData[field].toString().trim() === '');

    if (missing.length > 0) {
      throw new Error(`Campos requeridos faltantes: ${missing.join(', ')}`);
    }
  }

  /**
   * Getters para acceder a las propiedades
   */
  get id(): string {
    return this._id;
  }

  get sessionId(): string {
    return this._sessionId;
  }

  get formType(): FormType {
    return this._formType;
  }

  get email(): Email {
    return this._email;
  }

  get formData(): Record<string, any> {
    return { ...this._formData };
  }

  get timestamp(): Date {
    return new Date(this._timestamp);
  }

  get userIp(): string | undefined {
    return this._userIp;
  }

  get userAgent(): string | undefined {
    return this._userAgent;
  }

  get status(): FormSubmissionStatus {
    return this._status;
  }

  get phoneNumber(): PhoneNumber | undefined {
    return this._phoneNumber;
  }

  get processedAt(): Date | undefined {
    return this._processedAt ? new Date(this._processedAt) : undefined;
  }

  get errorMessage(): string | undefined {
    return this._errorMessage;
  }

  get emailSent(): boolean {
    return this._emailSent;
  }

  get emailSentAt(): Date | undefined {
    return this._emailSentAt ? new Date(this._emailSentAt) : undefined;
  }

  get followUpScheduled(): boolean {
    return this._followUpScheduled;
  }

  get notes(): string | undefined {
    return this._notes;
  }

  /**
   * Marca el formulario como en procesamiento
   */
  markAsProcessing(): void {
    if (this._status !== FormSubmissionStatus.PENDING) {
      throw new Error('Solo se pueden procesar formularios pendientes');
    }
    this._status = FormSubmissionStatus.PROCESSING;
  }

  /**
   * Marca el formulario como completado
   */
  markAsCompleted(): void {
    if (this._status !== FormSubmissionStatus.PROCESSING) {
      throw new Error('Solo se pueden completar formularios en procesamiento');
    }
    this._status = FormSubmissionStatus.COMPLETED;
    this._processedAt = new Date();
  }

  /**
   * Marca el formulario como fallido
   */
  markAsFailed(errorMessage: string): void {
    if (this._status === FormSubmissionStatus.COMPLETED) {
      throw new Error('No se puede marcar como fallido un formulario completado');
    }
    this._status = FormSubmissionStatus.FAILED;
    this._errorMessage = errorMessage;
    this._processedAt = new Date();
  }

  /**
   * Cancela el procesamiento del formulario
   */
  cancel(): void {
    if (this._status === FormSubmissionStatus.COMPLETED) {
      throw new Error('No se puede cancelar un formulario completado');
    }
    this._status = FormSubmissionStatus.CANCELLED;
    this._processedAt = new Date();
  }

  /**
   * Marca el email como enviado
   */
  markEmailAsSent(): void {
    this._emailSent = true;
    this._emailSentAt = new Date();
  }

  /**
   * Programa un seguimiento
   */
  scheduleFollowUp(): void {
    this._followUpScheduled = true;
  }

  /**
   * Añade notas al formulario
   */
  addNotes(notes: string): void {
    if (!notes || notes.trim().length === 0) {
      throw new Error('Las notas no pueden estar vacías');
    }
    
    const timestamp = new Date().toISOString();
    const newNote = `[${timestamp}] ${notes.trim()}`;
    
    if (this._notes) {
      this._notes += `\n${newNote}`;
    } else {
      this._notes = newNote;
    }
  }

  /**
   * Actualiza el número de teléfono
   */
  updatePhoneNumber(phoneNumber: PhoneNumber): void {
    this._phoneNumber = phoneNumber;
  }

  /**
   * Verifica si el formulario está en estado final
   */
  isInFinalState(): boolean {
    return this._status === FormSubmissionStatus.COMPLETED ||
           this._status === FormSubmissionStatus.FAILED ||
           this._status === FormSubmissionStatus.CANCELLED;
  }

  /**
   * Verifica si el formulario puede ser procesado
   */
  canBeProcessed(): boolean {
    return this._status === FormSubmissionStatus.PENDING;
  }

  /**
   * Obtiene la duración del procesamiento en milisegundos
   */
  getProcessingDuration(): number | undefined {
    if (!this._processedAt) {
      return undefined;
    }
    return this._processedAt.getTime() - this._timestamp.getTime();
  }

  /**
   * Obtiene información específica del formulario según su tipo
   */
  getFormSpecificData(): Record<string, any> {
    switch (this._formType) {
      case FormType.JOB_APPLICATION:
        return {
          applicantName: this._formData.fullName,
          position: this._formData.position,
          experience: this._formData.experience,
          skills: this._formData.skills,
          education: this._formData.education,
          availability: this._formData.availability
        };

      case FormType.DISCOUNT_REQUEST:
        return {
          customerName: this._formData.fullName,
          serviceInterest: this._formData.serviceInterest,
          budget: this._formData.budget,
          timeline: this._formData.timeline,
          companySize: this._formData.companySize
        };

      case FormType.CONTACT:
        return {
          name: this._formData.fullName,
          subject: this._formData.subject,
          message: this._formData.message,
          priority: this._formData.priority
        };

      case FormType.FEEDBACK:
        return {
          rating: this._formData.rating,
          comments: this._formData.comments,
          category: this._formData.category,
          wouldRecommend: this._formData.wouldRecommend
        };

      case FormType.NEWSLETTER:
        return {
          preferences: this._formData.preferences,
          frequency: this._formData.frequency
        };

      case FormType.SERVICE_INQUIRY:
        return {
          inquirerName: this._formData.fullName,
          serviceType: this._formData.serviceType,
          message: this._formData.message,
          urgency: this._formData.urgency,
          budget: this._formData.budget
        };

      default:
        return this._formData;
    }
  }

  /**
   * Genera un resumen del formulario para notificaciones
   */
  generateSummary(): string {
    const typeNames = {
      [FormType.JOB_APPLICATION]: 'Aplicación de Trabajo',
      [FormType.DISCOUNT_REQUEST]: 'Solicitud de Descuento',
      [FormType.CONTACT]: 'Contacto',
      [FormType.FEEDBACK]: 'Retroalimentación',
      [FormType.NEWSLETTER]: 'Suscripción Newsletter',
      [FormType.SERVICE_INQUIRY]: 'Consulta de Servicios'
    };

    const typeName = typeNames[this._formType] || 'Formulario';
    const data = this.getFormSpecificData();
    
    let summary = `${typeName} de ${data.applicantName || data.customerName || data.name || data.inquirerName || this._email.value}`;
    
    if (this._phoneNumber) {
      summary += ` (${this._phoneNumber.toDisplayFormat()})`;
    }

    return summary;
  }

  /**
   * Verifica si necesita seguimiento urgente
   */
  needsUrgentFollowUp(): boolean {
    const urgentTypes = [FormType.JOB_APPLICATION, FormType.SERVICE_INQUIRY];
    const urgentKeywords = ['urgente', 'asap', 'inmediato', 'priority'];
    
    if (urgentTypes.includes(this._formType)) {
      return true;
    }

    const dataString = JSON.stringify(this._formData).toLowerCase();
    return urgentKeywords.some(keyword => dataString.includes(keyword));
  }

  /**
   * Obtiene la edad del formulario en horas
   */
  getAgeInHours(): number {
    return (Date.now() - this._timestamp.getTime()) / (1000 * 60 * 60);
  }

  /**
   * Verifica si el formulario está vencido (más de 7 días sin procesar)
   */
  isOverdue(): boolean {
    return this.getAgeInHours() > (7 * 24) && this._status === FormSubmissionStatus.PENDING;
  }

  /**
   * Convierte el formulario a formato JSON
   */
  toJSON(): Record<string, any> {
    return {
      id: this._id,
      sessionId: this._sessionId,
      formType: this._formType,
      email: this._email.value,
      phoneNumber: this._phoneNumber?.value,
      formData: this._formData,
      timestamp: this._timestamp.toISOString(),
      userIp: this._userIp,
      userAgent: this._userAgent,
      status: this._status,
      processedAt: this._processedAt?.toISOString(),
      errorMessage: this._errorMessage,
      emailSent: this._emailSent,
      emailSentAt: this._emailSentAt?.toISOString(),
      followUpScheduled: this._followUpScheduled,
      notes: this._notes,
      summary: this.generateSummary(),
      needsUrgentFollowUp: this.needsUrgentFollowUp(),
      ageInHours: this.getAgeInHours(),
      isOverdue: this.isOverdue()
    };
  }

  /**
   * Crea una instancia desde datos JSON
   */
  static fromJSON(data: Record<string, any>): FormSubmission {
    const submission = new FormSubmission(
      data.id,
      data.sessionId,
      data.formType as FormType,
      new Email(data.email),
      data.formData,
      data.userIp,
      data.userAgent,
      data.phoneNumber ? new PhoneNumber(data.phoneNumber) : undefined
    );

    // Restaurar estado
    submission._status = data.status as FormSubmissionStatus;
    
    if (data.processedAt) {
      submission._processedAt = new Date(data.processedAt);
    }
    
    if (data.errorMessage) {
      submission._errorMessage = data.errorMessage;
    }
    
    submission._emailSent = data.emailSent || false;
    
    if (data.emailSentAt) {
      submission._emailSentAt = new Date(data.emailSentAt);
    }
    
    submission._followUpScheduled = data.followUpScheduled || false;
    
    if (data.notes) {
      submission._notes = data.notes;
    }

    return submission;
  }

  /**
   * Compara si dos formularios son iguales
   */
  equals(other: FormSubmission): boolean {
    return this._id === other._id;
  }

  /**
   * Método estático para crear formulario de aplicación de trabajo
   */
  static createJobApplication(
    sessionId: string,
    email: Email,
    formData: Record<string, any>,
    phoneNumber?: PhoneNumber,
    userIp?: string,
    userAgent?: string
  ): FormSubmission {
    const id = `job_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    return new FormSubmission(
      id,
      sessionId,
      FormType.JOB_APPLICATION,
      email,
      formData,
      userIp,
      userAgent,
      phoneNumber
    );
  }

  /**
   * Método estático para crear solicitud de descuento
   */
  static createDiscountRequest(
    sessionId: string,
    email: Email,
    formData: Record<string, any>,
    phoneNumber?: PhoneNumber,
    userIp?: string,
    userAgent?: string
  ): FormSubmission {
    const id = `discount_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    return new FormSubmission(
      id,
      sessionId,
      FormType.DISCOUNT_REQUEST,
      email,
      formData,
      userIp,
      userAgent,
      phoneNumber
    );
  }
}