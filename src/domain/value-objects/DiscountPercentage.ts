// src/domain/value-objects/DiscountPercentage.ts

/**
 * Value Object que representa un porcentaje de descuento válido
 */
export class DiscountPercentage {
  private readonly _value: number;

  /**
   * Límites de descuento permitidos
   */
  private static readonly MIN_DISCOUNT = 0;
  private static readonly MAX_DISCOUNT = 100;

  /**
   * Descuentos especiales predefinidos
   */
  private static readonly SPECIAL_DISCOUNTS = [5, 10, 15, 20, 25, 30, 50] as const;

  constructor(percentage: number) {
    this.validatePercentage(percentage);
    this._value = Math.round(percentage * 100) / 100; // Redondear a 2 decimales
  }

  /**
   * Obtiene el valor del porcentaje de descuento
   */
  get value(): number {
    return this._value;
  }

  /**
   * Obtiene el valor como decimal (0.15 para 15%)
   */
  get decimal(): number {
    return this._value / 100;
  }

  /**
   * Valida que el porcentaje esté dentro de los límites permitidos
   */
  private validatePercentage(percentage: number): void {
    if (typeof percentage !== 'number') {
      throw new Error('El porcentaje de descuento debe ser un número');
    }

    if (isNaN(percentage)) {
      throw new Error('El porcentaje de descuento no puede ser NaN');
    }

    if (!isFinite(percentage)) {
      throw new Error('El porcentaje de descuento debe ser un número finito');
    }

    if (percentage < DiscountPercentage.MIN_DISCOUNT) {
      throw new Error(`El porcentaje de descuento no puede ser menor a ${DiscountPercentage.MIN_DISCOUNT}%`);
    }

    if (percentage > DiscountPercentage.MAX_DISCOUNT) {
      throw new Error(`El porcentaje de descuento no puede ser mayor a ${DiscountPercentage.MAX_DISCOUNT}%`);
    }
  }

  /**
   * Calcula el monto de descuento sobre un precio base
   */
  calculateDiscountAmount(basePrice: number): number {
    if (typeof basePrice !== 'number' || basePrice < 0) {
      throw new Error('El precio base debe ser un número positivo');
    }

    return Math.round((basePrice * this.decimal) * 100) / 100;
  }

  /**
   * Calcula el precio final después del descuento
   */
  calculateFinalPrice(basePrice: number): number {
    if (typeof basePrice !== 'number' || basePrice < 0) {
      throw new Error('El precio base debe ser un número positivo');
    }

    const discountAmount = this.calculateDiscountAmount(basePrice);
    return Math.round((basePrice - discountAmount) * 100) / 100;
  }

  /**
   * Determina si es un descuento especial predefinido
   */
  isSpecialDiscount(): boolean {
    return DiscountPercentage.SPECIAL_DISCOUNTS.includes(this._value as any);
  }

  /**
   * Determina el nivel del descuento
   */
  getDiscountLevel(): 'low' | 'medium' | 'high' | 'premium' {
    if (this._value <= 10) return 'low';
    if (this._value <= 25) return 'medium';
    if (this._value <= 40) return 'high';
    return 'premium';
  }

  /**
   * Formatea el descuento para mostrar
   */
  toDisplayString(): string {
    if (this._value % 1 === 0) {
      // Número entero
      return `${this._value}%`;
    } else {
      // Número con decimales
      return `${this._value.toFixed(1)}%`;
    }
  }

  /**
   * Genera un mensaje descriptivo del descuento
   */
  getDescriptiveMessage(): string {
    const level = this.getDiscountLevel();
    const percentage = this.toDisplayString();

    switch (level) {
      case 'low':
        return `¡Aprovecha este descuento del ${percentage}!`;
      case 'medium':
        return `¡Excelente descuento del ${percentage} para ti!`;
      case 'high':
        return `¡Increíble descuento del ${percentage}! No lo dejes pasar.`;
      case 'premium':
        return `¡DESCUENTO PREMIUM del ${percentage}! Oferta única y especial.`;
      default:
        return `Descuento del ${percentage} disponible.`;
    }
  }

  /**
   * Compara si dos descuentos son iguales
   */
  equals(other: DiscountPercentage): boolean {
    return Math.abs(this._value - other._value) < 0.01; // Tolerancia para decimales
  }

  /**
   * Compara si este descuento es mayor que otro
   */
  isGreaterThan(other: DiscountPercentage): boolean {
    return this._value > other._value;
  }

  /**
   * Compara si este descuento es menor que otro
   */
  isLessThan(other: DiscountPercentage): boolean {
    return this._value < other._value;
  }

  /**
   * Método estático para crear un DiscountPercentage desde un número
   */
  static create(percentage: number): DiscountPercentage {
    return new DiscountPercentage(percentage);
  }

  /**
   * Método estático para crear desde un string (ej: "15%", "15.5")
   */
  static fromString(percentageString: string): DiscountPercentage {
    if (typeof percentageString !== 'string') {
      throw new Error('El valor debe ser una cadena de texto');
    }

    // Remover el símbolo % si está presente
    const cleanString = percentageString.replace('%', '').trim();
    const numericValue = parseFloat(cleanString);

    if (isNaN(numericValue)) {
      throw new Error('No se puede convertir la cadena a un número válido');
    }

    return new DiscountPercentage(numericValue);
  }

  /**
   * Método estático para validar si un número es un porcentaje válido
   */
  static isValid(percentage: number): boolean {
    try {
      new DiscountPercentage(percentage);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Método estático para obtener un descuento aleatorio de los especiales
   */
  static getRandomSpecialDiscount(): DiscountPercentage {
    const randomIndex = Math.floor(Math.random() * DiscountPercentage.SPECIAL_DISCOUNTS.length);
    const randomDiscount = DiscountPercentage.SPECIAL_DISCOUNTS[randomIndex];
    if (randomDiscount === undefined) {
      throw new Error('No se pudo obtener un descuento aleatorio');
    }
    return new DiscountPercentage(randomDiscount);
  }

  /**
   * Método estático para obtener todos los descuentos especiales
   */
  static getSpecialDiscounts(): DiscountPercentage[] {
    return DiscountPercentage.SPECIAL_DISCOUNTS.map(discount => new DiscountPercentage(discount));
  }

  /**
   * Convierte el descuento a número
   */
  toNumber(): number {
    return this._value;
  }

  /**
   * Convierte el descuento a string
   */
  toString(): string {
    return this.toDisplayString();
  }

  /**
   * Serialización para JSON
   */
  toJSON(): number {
    return this._value;
  }
}