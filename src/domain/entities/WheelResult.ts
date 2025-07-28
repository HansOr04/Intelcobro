// src/domain/entities/WheelResult.ts

import { WheelSection } from '../enums/WheelSection';
import { DiscountPercentage } from '../value-objects/DiscountPercentage';

/**
 * Entidad que representa el resultado de girar la rueda de descuentos
 */
export class WheelResult {
  private readonly _id: string;
  private readonly _sessionId: string;
  private readonly _section: WheelSection;
  private readonly _discountPercentage: DiscountPercentage;
  private readonly _spinAngle: number;
  private readonly _spinDuration: number;
  private readonly _timestamp: Date;
  private readonly _userIp?: string | undefined;
  private readonly _userId?: string | undefined;
  private readonly _metadata?: Record<string, any> | undefined;
  private _isRedeemed: boolean;
  private _redeemedAt?: Date;
  private _expiresAt: Date;

  constructor(
    id: string,
    sessionId: string,
    section: WheelSection,
    discountPercentage: DiscountPercentage,
    spinAngle: number,
    spinDuration: number,
    userIp?: string,
    userId?: string,
    metadata?: Record<string, any>
  ) {
    this.validateInputs(id, sessionId, section, spinAngle, spinDuration);

    this._id = id;
    this._sessionId = sessionId;
    this._section = section;
    this._discountPercentage = discountPercentage;
    this._spinAngle = spinAngle;
    this._spinDuration = spinDuration;
    this._timestamp = new Date();
    this._userIp = userIp || undefined;
    this._userId = userId || undefined;
    this._metadata = metadata ? { ...metadata } : undefined;
    this._isRedeemed = false;
    
    // Los descuentos expiran en 24 horas por defecto
    this._expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  }

  /**
   * Valida los inputs del constructor
   */
  private validateInputs(
    id: string, 
    sessionId: string, 
    section: WheelSection, 
    spinAngle: number, 
    spinDuration: number
  ): void {
    if (!id || id.trim().length === 0) {
      throw new Error('El ID del resultado es requerido');
    }

    if (!sessionId || sessionId.trim().length === 0) {
      throw new Error('El session ID es requerido');
    }

    if (!Object.values(WheelSection).includes(section)) {
      throw new Error('Sección de rueda no válida');
    }

    if (spinAngle < 0 || spinAngle > 360 * 10) { // Máximo 10 vueltas
      throw new Error('El ángulo de giro debe estar entre 0 y 3600 grados');
    }

    if (spinDuration < 1000 || spinDuration > 10000) { // Entre 1 y 10 segundos
      throw new Error('La duración del giro debe estar entre 1000 y 10000 milisegundos');
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

  get section(): WheelSection {
    return this._section;
  }

  get discountPercentage(): DiscountPercentage {
    return this._discountPercentage;
  }

  get spinAngle(): number {
    return this._spinAngle;
  }

  get spinDuration(): number {
    return this._spinDuration;
  }

  get timestamp(): Date {
    return new Date(this._timestamp);
  }

  get userIp(): string | undefined {
    return this._userIp;
  }

  get userId(): string | undefined {
    return this._userId;
  }

  get metadata(): Record<string, any> | undefined {
    return this._metadata ? { ...this._metadata } : undefined;
  }

  get isRedeemed(): boolean {
    return this._isRedeemed;
  }

  get redeemedAt(): Date | undefined {
    return this._redeemedAt ? new Date(this._redeemedAt) : undefined;
  }

  get expiresAt(): Date {
    return new Date(this._expiresAt);
  }

  /**
   * Verifica si el resultado es un premio (no "try again")
   */
  isWinningResult(): boolean {
    return this._section !== WheelSection.TRY_AGAIN;
  }

  /**
   * Verifica si el descuento ha expirado
   */
  isExpired(): boolean {
    return new Date() > this._expiresAt;
  }

  /**
   * Verifica si el descuento está disponible para uso
   */
  isAvailableForRedemption(): boolean {
    return this.isWinningResult() && !this._isRedeemed && !this.isExpired();
  }

  /**
   * Marca el descuento como canjeado
   */
  markAsRedeemed(): void {
    if (!this.isWinningResult()) {
      throw new Error('No se puede canjear un resultado de "Try Again"');
    }

    if (this._isRedeemed) {
      throw new Error('Este descuento ya ha sido canjeado');
    }

    if (this.isExpired()) {
      throw new Error('Este descuento ha expirado');
    }

    this._isRedeemed = true;
    this._redeemedAt = new Date();
  }

  /**
   * Extiende la fecha de expiración del descuento
   */
  extendExpiration(additionalHours: number): void {
    if (additionalHours <= 0) {
      throw new Error('Las horas adicionales deben ser mayor a 0');
    }

    const additionalMs = additionalHours * 60 * 60 * 1000;
    this._expiresAt = new Date(this._expiresAt.getTime() + additionalMs);
  }

  /**
   * Obtiene el tiempo restante para expiración en milisegundos
   */
  getTimeUntilExpiration(): number {
    return Math.max(0, this._expiresAt.getTime() - Date.now());
  }

  /**
   * Obtiene el tiempo restante para expiración en formato legible
   */
  getTimeUntilExpirationFormatted(): string {
    const ms = this.getTimeUntilExpiration();
    
    if (ms === 0) {
      return 'Expirado';
    }

    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  }

  /**
   * Obtiene el mensaje de resultado basado en la sección
   */
  getResultMessage(): string {
    switch (this._section) {
      case WheelSection.TRY_AGAIN:
        return '¡No te desanimes! Inténtalo de nuevo más tarde.';
      case WheelSection.DISCOUNT_50:
        return `¡FELICIDADES! Has ganado nuestro PREMIO MAYOR: ${this._discountPercentage.toDisplayString()} de descuento!`;
      default:
        return `¡Excelente! Has ganado un ${this._discountPercentage.toDisplayString()} de descuento en nuestros servicios.`;
    }
  }

  /**
   * Obtiene el código de descuento único
   */
  getDiscountCode(): string {
    if (!this.isWinningResult()) {
      throw new Error('No hay código de descuento para resultados de "Try Again"');
    }

    // Generar código basado en ID y timestamp
    const shortId = this._id.substring(0, 8).toUpperCase();
    const timeCode = this._timestamp.getTime().toString(36).toUpperCase();
    const percentage = this._discountPercentage.value.toString();
    
    return `INTEL${percentage}${shortId}${timeCode}`.substring(0, 16);
  }

  /**
   * Calcula las estadísticas del giro
   */
  getSpinStatistics(): Record<string, any> {
    const fullRotations = Math.floor(this._spinAngle / 360);
    const finalAngle = this._spinAngle % 360;
    
    return {
      fullRotations,
      finalAngle,
      spinDurationSeconds: this._spinDuration / 1000,
      avgSpinSpeed: this._spinAngle / this._spinDuration, // grados por ms
      isHighValuePrize: this._discountPercentage.value >= 30
    };
  }

  /**
   * Verifica si es un premio de alto valor
   */
  isHighValuePrize(): boolean {
    return this._discountPercentage.value >= 30;
  }

  /**
   * Convierte el resultado a formato JSON
   */
  toJSON(): Record<string, any> {
    return {
      id: this._id,
      sessionId: this._sessionId,
      section: this._section,
      discountPercentage: this._discountPercentage.value,
      spinAngle: this._spinAngle,
      spinDuration: this._spinDuration,
      timestamp: this._timestamp.toISOString(),
      userIp: this._userIp,
      userId: this._userId,
      metadata: this._metadata,
      isRedeemed: this._isRedeemed,
      redeemedAt: this._redeemedAt?.toISOString(),
      expiresAt: this._expiresAt.toISOString(),
      isWinning: this.isWinningResult(),
      isExpired: this.isExpired(),
      discountCode: this.isWinningResult() ? this.getDiscountCode() : undefined
    };
  }

  /**
   * Crea una instancia desde datos JSON
   */
  static fromJSON(data: Record<string, any>): WheelResult {
    const result = new WheelResult(
      data.id,
      data.sessionId,
      data.section as WheelSection,
      new DiscountPercentage(data.discountPercentage),
      data.spinAngle,
      data.spinDuration,
      data.userIp,
      data.userId,
      data.metadata
    );

    // Restaurar estado de redención
    if (data.isRedeemed) {
      result._isRedeemed = true;
      if (data.redeemedAt) {
        result._redeemedAt = new Date(data.redeemedAt);
      }
    }

    // Restaurar fecha de expiración
    if (data.expiresAt) {
      result._expiresAt = new Date(data.expiresAt);
    }

    return result;
  }

  /**
   * Compara si dos resultados son iguales
   */
  equals(other: WheelResult): boolean {
    return this._id === other._id;
  }

  /**
   * Método estático para crear un resultado de "Try Again"
   */
  static createTryAgainResult(
    sessionId: string,
    spinAngle: number,
    spinDuration: number,
    userIp?: string,
    userId?: string
  ): WheelResult {
    const id = `wheel_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    return new WheelResult(
      id,
      sessionId,
      WheelSection.TRY_AGAIN,
      new DiscountPercentage(0),
      spinAngle,
      spinDuration,
      userIp,
      userId,
      { isTryAgain: true }
    );
  }
}