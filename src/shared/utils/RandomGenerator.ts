// src/shared/utils/RandomGenerator.ts

import { WheelSection, WHEEL_SECTIONS_CONFIG } from '../../domain/enums/WheelSection';

/**
 * Generador de números y elementos aleatorios con diferentes algoritmos
 */
export class RandomGenerator {
  private static instance: RandomGenerator;
  private seed: number;

  private constructor(seed?: number) {
    this.seed = seed ?? Date.now();
  }

  /**
   * Obtiene la instancia singleton del generador
   */
  static getInstance(seed?: number): RandomGenerator {
    if (!RandomGenerator.instance) {
      RandomGenerator.instance = new RandomGenerator(seed);
    }
    return RandomGenerator.instance;
  }

  /**
   * Establece una nueva semilla para el generador
   */
  setSeed(seed: number): void {
    this.seed = seed;
  }

  /**
   * Genera un número aleatorio usando Linear Congruential Generator (LCG)
   * Más predecible para testing, pero suficiente para la rueda
   */
  private lcg(): number {
    this.seed = (this.seed * 1664525 + 1013904223) % Math.pow(2, 32);
    return this.seed / Math.pow(2, 32);
  }

  /**
   * Genera un número aleatorio entre 0 y 1 usando Math.random()
   */
  random(): number {
    return Math.random();
  }

  /**
   * Genera un número aleatorio determinístico usando la semilla
   */
  seededRandom(): number {
    return this.lcg();
  }

  /**
   * Genera un número entero aleatorio entre min y max (inclusivo)
   */
  randomInt(min: number, max: number): number {
    if (min > max) {
      throw new Error('El valor mínimo no puede ser mayor que el máximo');
    }
    
    return Math.floor(this.random() * (max - min + 1)) + min;
  }

  /**
   * Genera un número decimal aleatorio entre min y max
   */
  randomFloat(min: number, max: number): number {
    if (min > max) {
      throw new Error('El valor mínimo no puede ser mayor que el máximo');
    }
    
    return this.random() * (max - min) + min;
  }

  /**
   * Genera un string aleatorio de longitud específica
   */
  randomString(length: number, charset: string = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'): string {
    if (length <= 0) {
      throw new Error('La longitud debe ser mayor a 0');
    }

    let result = '';
    for (let i = 0; i < length; i++) {
      result += charset.charAt(this.randomInt(0, charset.length - 1));
    }
    return result;
  }

  /**
   * Genera un ID único aleatorio
   */
  generateId(length: number = 8): string {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    return this.randomString(length, charset);
  }

  /**
   * Genera un UUID v4 simple
   */
  generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = this.randomInt(0, 15);
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * Selecciona un elemento aleatorio de un array
   */
  randomElement<T>(array: T[]): T {
    if (array.length === 0) {
      throw new Error('El array no puede estar vacío');
    }
    
    const index = this.randomInt(0, array.length - 1);
    const element = array[index];
    if (element === undefined) {
      throw new Error('No se pudo obtener un elemento del array');
    }
    return element;
  }

  /**
   * Mezcla un array aleatoriamente (Fisher-Yates shuffle)
   */
  shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = this.randomInt(0, i);
      const temp = shuffled[i];
      const elementToSwap = shuffled[j];
      if (temp !== undefined && elementToSwap !== undefined) {
        shuffled[i] = elementToSwap;
        shuffled[j] = temp;
      }
    }
    
    return shuffled;
  }

  /**
   * Genera un número aleatorio con distribución normal (Box-Muller)
   */
  randomNormal(mean: number = 0, stdDev: number = 1): number {
    const u1 = this.random();
    const u2 = this.random();
    
    const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return z0 * stdDev + mean;
  }

  /**
   * Selecciona un elemento basado en pesos/probabilidades
   */
  weightedRandom<T>(items: T[], weights: number[]): T {
    if (items.length !== weights.length) {
      throw new Error('Los arrays de items y pesos deben tener la misma longitud');
    }

    if (items.length === 0) {
      throw new Error('Los arrays no pueden estar vacíos');
    }

    // Normalizar pesos para que sumen 1
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    if (totalWeight === 0) {
      throw new Error('La suma de los pesos debe ser mayor a 0');
    }

    const normalizedWeights = weights.map(weight => weight / totalWeight);
    
    const random = this.random();
    let cumulativeWeight = 0;

    for (let i = 0; i < items.length; i++) {
      const currentWeight = normalizedWeights[i];
      const currentItem = items[i];
      
      if (currentWeight !== undefined && currentItem !== undefined) {
        cumulativeWeight += currentWeight;
        if (random <= cumulativeWeight) {
          return currentItem;
        }
      }
    }

    // Fallback al último elemento
    const lastItem = items[items.length - 1];
    if (lastItem === undefined) {
      throw new Error('No se pudo obtener un elemento válido del array');
    }
    return lastItem;
  }

  /**
   * Genera una sección aleatoria de la rueda basada en probabilidades
   */
  generateWheelSection(): WheelSection {
    const sections = WHEEL_SECTIONS_CONFIG.map(config => config.section);
    const probabilities = WHEEL_SECTIONS_CONFIG.map(config => config.probability);
    
    return this.weightedRandom(sections, probabilities);
  }

  /**
   * Genera un ángulo aleatorio para la rueda (en grados)
   */
  generateWheelAngle(targetSection: WheelSection): number {
    const sectionConfig = WHEEL_SECTIONS_CONFIG.find(config => config.section === targetSection);
    
    if (!sectionConfig) {
      throw new Error('Sección de rueda no válida');
    }

    const sectionIndex = WHEEL_SECTIONS_CONFIG.indexOf(sectionConfig);
    const totalSections = WHEEL_SECTIONS_CONFIG.length;
    const degreesPerSection = 360 / totalSections;
    
    // Calcular el ángulo base de la sección
    const baseSectionAngle = sectionIndex * degreesPerSection;
    
    // Añadir variación aleatoria dentro de la sección
    const randomOffset = this.randomFloat(0, degreesPerSection);
    
    // Añadir rotaciones completas adicionales para el efecto visual
    const additionalRotations = this.randomInt(3, 6) * 360;
    
    return baseSectionAngle + randomOffset + additionalRotations;
  }

  /**
   * Genera un tiempo de duración aleatorio para la animación de la rueda
   */
  generateSpinDuration(): number {
    // Entre 3 y 5 segundos
    return this.randomInt(3000, 5000);
  }

  /**
   * Genera un delay aleatorio
   */
  generateDelay(minMs: number, maxMs: number): number {
    return this.randomInt(minMs, maxMs);
  }

  /**
   * Simula una probabilidad (true/false basado en porcentaje)
   */
  chance(percentage: number): boolean {
    if (percentage < 0 || percentage > 100) {
      throw new Error('El porcentaje debe estar entre 0 y 100');
    }
    
    return this.random() * 100 < percentage;
  }

  /**
   * Genera un número de teléfono aleatorio válido para Ecuador
   */
  generateEcuadorianPhone(): string {
    // Número móvil: 9XXXXXXXX
    const firstDigit = 9;
    const remainingDigits = this.randomString(8, '0123456789');
    return `+593${firstDigit}${remainingDigits}`;
  }

  /**
   * Genera un email aleatorio para testing
   */
  generateTestEmail(): string {
    const domains = ['test.com', 'example.org', 'demo.net'];
    const username = this.randomString(8, 'abcdefghijklmnopqrstuvwxyz');
    const domain = this.randomElement(domains);
    return `${username}@${domain}`;
  }

  /**
   * Resetea el generador a valores por defecto
   */
  reset(): void {
    this.seed = Date.now();
  }
}

/**
 * Instancia global del generador aleatorio
 */
export const randomGenerator = RandomGenerator.getInstance();

/**
 * Funciones helper para uso directo
 */
export const generateId = (length?: number) => randomGenerator.generateId(length);
export const generateUUID = () => randomGenerator.generateUUID();
export const randomInt = (min: number, max: number) => randomGenerator.randomInt(min, max);
export const randomFloat = (min: number, max: number) => randomGenerator.randomFloat(min, max);
export const randomElement = <T>(array: T[]) => {
  if (array.length === 0) {
    throw new Error('El array no puede estar vacío');
  }
  return randomGenerator.randomElement(array);
};
export const shuffleArray = <T>(array: T[]) => randomGenerator.shuffleArray(array);
export const chance = (percentage: number) => randomGenerator.chance(percentage);