// src/infrastructure/external-services/ElevenLabsService.ts

import {
  ITextToSpeechService,
  SpeechSynthesisResult,
  SpeechSynthesisConfig,
  VoiceConfig,
  VoiceInfo,
  TTSUsageStats,
  ITTSCache,
  TextToSpeechOptions,
  BatchSynthesisOptions,
  BatchSynthesisResult,
  AudioStreamConfig,
  VoiceCloningOptions,
  VoiceCloningResult
} from '../../application/interfaces/services/ITextToSpeechService';
import { logger } from '../../shared/utils/Logger';

/**
 * Configuración específica de ElevenLabs
 */
interface ElevenLabsConfig {
  apiKey: string;
  baseUrl?: string;
  defaultVoiceId?: string;
  timeout?: number;
  maxRetries?: number;
  cacheEnabled?: boolean;
}

/**
 * Configuración de voz para ElevenLabs
 */
interface ElevenLabsVoiceSettings {
  stability: number;
  similarity_boost: number;
  style?: number;
  use_speaker_boost?: boolean;
}

/**
 * Respuesta de la API de ElevenLabs
 */
interface ElevenLabsResponse {
  audio: ArrayBuffer;
  contentType: string;
  usage?: {
    charactersUsed: number;
    charactersRemaining: number;
  };
}

/**
 * Información de voz de ElevenLabs
 */
interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  category: string;
  description?: string;
  labels: Record<string, string>;
  samples?: Array<{
    sample_id: string;
    file_name: string;
    mime_type: string;
    size_bytes: number;
  }>;
  settings?: ElevenLabsVoiceSettings;
}

/**
 * Implementación del servicio de Text-to-Speech usando ElevenLabs
 */
export class ElevenLabsService implements ITextToSpeechService {
  private config: ElevenLabsConfig;
  private requestCount: number = 0;
  private charactersUsed: number = 0;
  private lastResetTime: Date = new Date();
  private cache: ITTSCache | undefined;

  constructor(config: ElevenLabsConfig, cache?: ITTSCache) {
    this.config = {
      baseUrl: 'https://api.elevenlabs.io/v1',
      defaultVoiceId: '21m00Tcm4TlvDq8ikWAM', // Voz por defecto Rachel
      timeout: 30000,
      maxRetries: 3,
      cacheEnabled: true,
      ...config
    };
    
    this.cache = cache;

    logger.info('ElevenLabs Service inicializado', {
      baseUrl: this.config.baseUrl,
      defaultVoiceId: this.config.defaultVoiceId,
      cacheEnabled: this.config.cacheEnabled && !!this.cache
    });
  }

  /**
   * Convierte texto a voz
   */
  async synthesize(options: TextToSpeechOptions): Promise<SpeechSynthesisResult> {
    const startTime = Date.now();
    
    try {
      // Validar request
      this.validateOptions(options);

      // Verificar cache si está habilitado
      if (this.cache && this.config.cacheEnabled) {
        const cacheKey = this.cache.generateKey(options.text, options.config);
        const cachedResult = await this.cache.get(cacheKey);
        
        if (cachedResult) {
          logger.debug('Respuesta TTS obtenida del cache', {
            cacheKey: cacheKey.substring(0, 20) + '...',
            textLength: options.text.length
          });
          return cachedResult;
        }
      }

      // Optimizar texto
      const optimizedText = await this.optimizeText(options.text, 'es');
      
      // Preparar configuración
      const voiceConfig = this.buildVoiceConfig(options.config);
      const voiceId = options.config.voice?.voiceId || this.config.defaultVoiceId!;

      logger.debug('Sintetizando audio con ElevenLabs', {
        textLength: optimizedText.optimizedText.length,
        voiceId,
        model: voiceConfig.model_id
      });

      // Hacer request a ElevenLabs
      const response = await this.makeElevenLabsRequest(
        voiceId,
        optimizedText.optimizedText,
        voiceConfig
      );

      // Procesar respuesta
      const result = await this.processResponse(
        response,
        options,
        startTime,
        optimizedText.optimizedText
      );

      // Guardar en cache si está habilitado
      if (this.cache && this.config.cacheEnabled) {
        const cacheKey = this.cache.generateKey(options.text, options.config);
        await this.cache.set(cacheKey, result, 3600); // Cache por 1 hora
      }

      // Actualizar estadísticas
      this.requestCount++;
      this.charactersUsed += options.text.length;

      logger.info('Audio sintetizado exitosamente', {
        textLength: options.text.length,
        audioSize: result.audioData.byteLength,
        duration: result.duration || 0,
        processingTime: Date.now() - startTime
      });

      return result;

    } catch (error) {
      logger.error('Error sintetizando audio', undefined, error instanceof Error ? error : new Error(String(error)));

      throw this.handleElevenLabsError(error, options);
    }
  }

  /**
   * Convierte texto a voz con streaming
   */
  async synthesizeStream(
    text: string,
    config: SpeechSynthesisConfig,
    streamConfig: AudioStreamConfig
  ): Promise<void> {
    // Implementación básica - ElevenLabs no soporta streaming nativo
    // Simulamos streaming dividiendo el audio en chunks
    try {
      const result = await this.synthesize({ text, config });
      
      const chunkSize = streamConfig.chunkSize || 1024;
      const audioBuffer = Buffer.from(result.audioData);
      
      for (let i = 0; i < audioBuffer.length; i += chunkSize) {
        const chunk = audioBuffer.slice(i, i + chunkSize);
        streamConfig.onChunk?.(chunk);
      }
      
      streamConfig.onComplete?.(result);
    } catch (error) {
      streamConfig.onError?.(error as Error);
    }
  }

  /**
   * Síntesis en lote
   */
  async synthesizeBatch(options: BatchSynthesisOptions): Promise<BatchSynthesisResult> {
    const results: BatchSynthesisResult['results'] = [];
    const concurrency = options.concurrency || 3;
    let successful = 0;
    let failed = 0;
    let totalDuration = 0;
    let totalSize = 0;

    // Procesar en lotes
    for (let i = 0; i < options.items.length; i += concurrency) {
      const batch = options.items.slice(i, i + concurrency);
      
      const batchPromises = batch.map(async (item) => {
        try {
          const config = { ...options.defaultConfig, ...item.config };
          const result = await this.synthesize({
            text: item.text,
            config,
            ...(item.outputPath && { outputPath: item.outputPath })
          });
          
          successful++;
          totalDuration += result.duration;
          totalSize += result.size;
          
          return {
            id: item.id,
            success: true,
            result
          };
        } catch (error) {
          failed++;
          return {
            id: item.id,
            success: false,
            error: error instanceof Error ? error.message : 'Error desconocido'
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      options.onProgress?.(results.length, options.items.length);
    }

    return {
      successful,
      failed,
      results,
      totalDuration,
      totalSize
    };
  }

  /**
   * Obtiene voces disponibles
   */
  async getAvailableVoices(language?: string): Promise<VoiceInfo[]> {
    try {
      const response = await fetch(`${this.config.baseUrl}/voices`, {
        headers: {
          'xi-api-key': this.config.apiKey,
          'Content-Type': 'application/json'
        },
        signal: AbortSignal.timeout(this.config.timeout!)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json() as { voices?: ElevenLabsVoice[] };
      const voices: ElevenLabsVoice[] = data.voices || [];

      let filteredVoices = voices;
      if (language) {
        filteredVoices = voices.filter(voice => 
          this.inferLanguage(voice.labels).includes(language)
        );
      }

      return filteredVoices.map(voice => ({
        id: voice.voice_id,
        name: voice.name,
        language: this.inferLanguage(voice.labels),
        languageCode: this.inferLanguage(voice.labels),
        gender: this.inferGender(voice.name, voice.labels),
        accent: voice.labels.accent || '',
        description: voice.description || '',
        category: voice.category as 'standard' | 'neural' | 'premium' || 'standard',
        isCustom: voice.category === 'cloned',
        features: Object.keys(voice.labels),
        previewUrl: voice.samples?.[0] ? `/voices/${voice.voice_id}/preview` : '',
        pricing: {
          charactersPerRequest: 2500,
          costPer1000Characters: 0.30
        }
      }));

    } catch (error) {
      logger.error('Error obteniendo voces disponibles', undefined, error instanceof Error ? error : new Error(String(error)));
      throw this.handleElevenLabsError(error);
    }
  }

  /**
   * Obtiene información de voz específica
   */
  async getVoiceInfo(voiceId: string): Promise<VoiceInfo> {
    try {
      const response = await fetch(`${this.config.baseUrl}/voices/${voiceId}`, {
        headers: {
          'xi-api-key': this.config.apiKey,
          'Content-Type': 'application/json'
        },
        signal: AbortSignal.timeout(this.config.timeout!)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const voice = await response.json() as ElevenLabsVoice;

      return {
        id: voice.voice_id,
        name: voice.name,
        language: this.inferLanguage(voice.labels),
        languageCode: this.inferLanguage(voice.labels),
        gender: this.inferGender(voice.name, voice.labels),
        accent: voice.labels.accent || '',
        description: voice.description || '',
        category: voice.category as 'standard' | 'neural' | 'premium' || 'standard',
        isCustom: voice.category === 'cloned',
        features: Object.keys(voice.labels),
        previewUrl: voice.samples?.[0] ? `/voices/${voice.voice_id}/preview` : '',
        pricing: {
          charactersPerRequest: 2500,
          costPer1000Characters: 0.30
        }
      };

    } catch (error) {
      logger.error('Error obteniendo información de voz', undefined, error instanceof Error ? error : new Error(String(error)));
      throw this.handleElevenLabsError(error);
    }
  }

  /**
   * Genera preview de una voz
   */
  async generateVoicePreview(
    voiceId: string,
    sampleText?: string
  ): Promise<SpeechSynthesisResult> {
    const text = sampleText || 'Hola, este es un ejemplo de cómo suena mi voz.';
    const config: SpeechSynthesisConfig = {
      voice: {
        voiceId,
        language: 'es-ES'
      },
      format: 'mp3',
      sampleRate: 22050
    };

    return this.synthesize({ text, config });
  }

  /**
   * Clona voz desde muestra de audio
   */
  async cloneVoice(options: VoiceCloningOptions): Promise<VoiceCloningResult> {
    try {
      const formData = new FormData();
      formData.append('name', options.name);
      if (options.description) formData.append('description', options.description);

      // Agregar muestras de audio
      options.sampleAudioFiles.forEach((sample, index) => {
        const blob = new Blob([sample], { type: 'audio/wav' });
        formData.append('files', blob, `sample_${index}.wav`);
      });

      const response = await fetch(`${this.config.baseUrl}/voices/add`, {
        method: 'POST',
        headers: {
          'xi-api-key': this.config.apiKey
        },
        body: formData,
        signal: AbortSignal.timeout(this.config.timeout!)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json() as { voice_id: string };

      logger.info('Voz clonada exitosamente', {
        voiceId: result.voice_id,
        name: options.name,
        samplesUsed: options.sampleAudioFiles.length
      });

      return {
        voiceId: result.voice_id,
        status: 'ready',
        progress: 100,
        quality: {
          similarity: 0.85,
          naturalness: 0.80,
          clarity: 0.90
        }
      };

    } catch (error) {
      logger.error('Error clonando voz', undefined, error instanceof Error ? error : new Error(String(error)));
      throw this.handleElevenLabsError(error);
    }
  }

  /**
   * Obtiene estado de clonación de voz
   */
  async getVoiceCloningStatus(voiceId: string): Promise<VoiceCloningResult> {
    try {
      const voiceInfo = await this.getVoiceInfo(voiceId);
      return {
        voiceId,
        status: 'ready',
        progress: 100,
        quality: {
          similarity: 0.85,
          naturalness: 0.80,
          clarity: 0.90
        }
      };
    } catch (error) {
      return {
        voiceId,
        status: 'failed',
        progress: 0
      };
    }
  }

  /**
   * Elimina una voz clonada
   */
  async deleteClonedVoice(voiceId: string): Promise<void> {
    try {
      const response = await fetch(`${this.config.baseUrl}/voices/${voiceId}`, {
        method: 'DELETE',
        headers: {
          'xi-api-key': this.config.apiKey
        },
        signal: AbortSignal.timeout(this.config.timeout!)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      logger.info('Voz clonada eliminada', { voiceId });
    } catch (error) {
      logger.error('Error eliminando voz clonada', undefined, error instanceof Error ? error : new Error(String(error)));
      throw this.handleElevenLabsError(error);
    }
  }

  /**
   * Valida texto para síntesis
   */
  async validateText(text: string): Promise<{
    isValid: boolean;
    errors: string[];
    characterCount: number;
    estimatedDuration: number;
    estimatedCost?: number;
  }> {
    const errors: string[] = [];
    
    if (!text || text.trim().length === 0) {
      errors.push('Texto requerido para síntesis');
    }

    if (text.length > 2500) {
      errors.push('Texto demasiado largo (máximo 2500 caracteres)');
    }

    const characterCount = text.length;
    const estimatedDuration = this.estimateDuration(text);
    const estimatedCost = (characterCount / 1000) * 0.30; // $0.30 por 1000 caracteres

    return {
      isValid: errors.length === 0,
      errors,
      characterCount,
      estimatedDuration,
      estimatedCost
    };
  }

  /**
   * Optimiza texto para mejor síntesis
   */
  async optimizeText(text: string, language: string): Promise<{
    optimizedText: string;
    changes: Array<{
      original: string;
      optimized: string;
      reason: string;
    }>;
  }> {
    const changes: Array<{ original: string; optimized: string; reason: string }> = [];
    let optimized = text;

    // Normalizar espacios múltiples
    const multiSpaceRegex = /\s+/g;
    if (multiSpaceRegex.test(optimized)) {
      optimized = optimized.replace(multiSpaceRegex, ' ');
      changes.push({
        original: 'Espacios múltiples',
        optimized: 'Espacio único',
        reason: 'Mejorar fluidez de la síntesis'
      });
    }

    // Expandir abreviaciones comunes en español
    const abbreviations: Record<string, string> = {
      'Dr.': 'Doctor',
      'Dra.': 'Doctora',
      'Sr.': 'Señor',
      'Sra.': 'Señora',
      'Srta.': 'Señorita',
      'Lic.': 'Licenciado',
      'Ing.': 'Ingeniero',
      'etc.': 'etcétera',
      'vs.': 'versus',
      'p.ej.': 'por ejemplo'
    };

    Object.entries(abbreviations).forEach(([abbrev, full]) => {
      if (optimized.includes(abbrev)) {
        optimized = optimized.replace(new RegExp(abbrev, 'g'), full);
        changes.push({
          original: abbrev,
          optimized: full,
          reason: 'Expandir abreviación para mejor pronunciación'
        });
      }
    });

    // Agregar pausas naturales
    optimized = optimized.replace(/([.!?])\s*([A-Z])/g, '$1 $2');

    // Normalizar números (básico)
    optimized = optimized.replace(/\b(\d+)\b/g, (match, num) => {
      const number = parseInt(num);
      if (number >= 0 && number <= 20) {
        const numbers = ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve', 'veinte'];
        return numbers[number] || match;
      }
      return match;
    });

    return {
      optimizedText: optimized.trim(),
      changes
    };
  }

  /**
   * Convierte SSML a texto plano
   */
  ssmlToText(ssml: string): string {
    // Remover todas las etiquetas SSML
    return ssml
      .replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Convierte texto a SSML básico
   */
  textToSsml(
    text: string,
    options?: {
      addBreaks?: boolean;
      addEmphasis?: string[];
      speechRate?: 'slow' | 'medium' | 'fast';
      pitch?: 'low' | 'medium' | 'high';
    }
  ): string {
    let ssml = `<speak>${text}</speak>`;

    if (options?.addBreaks) {
      ssml = ssml.replace(/[.!?]/g, '$&<break time="0.5s"/>');
    }

    if (options?.addEmphasis && options.addEmphasis.length > 0) {
      options.addEmphasis.forEach(word => {
        const regex = new RegExp(`\\b${word}\\b`, 'gi');
        ssml = ssml.replace(regex, `<emphasis level="strong">${word}</emphasis>`);
      });
    }

    return ssml;
  }

  /**
   * Obtiene estadísticas de uso
   */
  async getUsageStats(period?: { from: Date; to: Date }): Promise<TTSUsageStats> {
    return {
      charactersUsed: this.charactersUsed,
      requestsCount: this.requestCount,
      totalDuration: this.requestCount * 5.0, // Estimado
      totalSize: this.requestCount * 50000, // Estimado en bytes
      costToday: (this.charactersUsed / 1000) * 0.30,
      quotaRemaining: 10000 - this.charactersUsed,
      topVoices: [
        { voiceId: this.config.defaultVoiceId!, usage: this.requestCount }
      ],
      languageDistribution: {
        'es': this.requestCount * 0.8,
        'en': this.requestCount * 0.2
      }
    };
  }

  /**
   * Verifica disponibilidad del servicio
   */
  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.baseUrl}/user`, {
        headers: {
          'xi-api-key': this.config.apiKey
        },
        signal: AbortSignal.timeout(5000)
      });

      return response.ok;
    } catch (error) {
      logger.warn('ElevenLabs Service no disponible', { error });
      return false;
    }
  }

  /**
   * Obtiene límites y cuotas
   */
  async getLimits(): Promise<{
    maxCharactersPerRequest: number;
    maxRequestsPerDay: number;
    maxConcurrentRequests: number;
    supportedFormats: string[];
    supportedLanguages: string[];
  }> {
    return {
      maxCharactersPerRequest: 2500,
      maxRequestsPerDay: 1000,
      maxConcurrentRequests: 5,
      supportedFormats: ['mp3', 'wav', 'ogg'],
      supportedLanguages: ['es', 'en', 'fr', 'de', 'it', 'pt', 'pl', 'hi', 'ar', 'zh', 'ja', 'ko']
    };
  }

  /**
   * Valida las opciones de síntesis
   */
  private validateOptions(options: TextToSpeechOptions): void {
    if (!options.text || options.text.trim().length === 0) {
      throw new Error('Texto requerido para síntesis');
    }

    if (options.text.length > 2500) {
      throw new Error('Texto demasiado largo (máximo 2500 caracteres)');
    }

    if (options.config.voice?.voiceId && !this.isValidVoiceId(options.config.voice.voiceId)) {
      throw new Error(`Voice ID inválido: ${options.config.voice.voiceId}`);
    }
  }

  /**
   * Valida formato de Voice ID
   */
  private isValidVoiceId(voiceId: string): boolean {
    // ElevenLabs voice IDs son strings alfanuméricos de 20 caracteres
    return /^[a-zA-Z0-9]{20}$/.test(voiceId);
  }

  /**
   * Construye configuración de voz para ElevenLabs
   */
  private buildVoiceConfig(config: SpeechSynthesisConfig): any {
    const voiceSettings: ElevenLabsVoiceSettings = {
      stability: config.stability || 0.5,
      similarity_boost: config.clarity || 0.8
    };

    // Ajustar estabilidad basado en la velocidad
    if (config.speed) {
      if (config.speed < 0.8) {
        voiceSettings.stability = 0.7; // Más estable para velocidad lenta
      } else if (config.speed > 1.2) {
        voiceSettings.stability = 0.3; // Menos estable para velocidad rápida
      }
    }

    // Configuración del modelo
    const modelConfig: any = {
      model_id: 'eleven_multilingual_v2', // Modelo por defecto
      voice_settings: voiceSettings
    };

    // Seleccionar modelo basado en idioma
    const language = config.voice?.language || 'es';
    if (language === 'en') {
      modelConfig.model_id = 'eleven_monolingual_v1';
    } else if (['es', 'fr', 'de', 'it', 'pt', 'pl', 'hi', 'ar', 'zh', 'ja', 'ko'].includes(language)) {
      modelConfig.model_id = 'eleven_multilingual_v2';
    }

    return modelConfig;
  }

  /**
   * Realiza request a ElevenLabs API
   */
  private async makeElevenLabsRequest(
    voiceId: string,
    text: string,
    voiceConfig: any
  ): Promise<ElevenLabsResponse> {
    const url = `${this.config.baseUrl}/text-to-speech/${voiceId}`;
    
    const requestBody = {
      text,
      ...voiceConfig
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'xi-api-key': this.config.apiKey,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg'
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(this.config.timeout!)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const audioBuffer = await response.arrayBuffer();
    
    return {
      audio: audioBuffer,
      contentType: response.headers.get('content-type') || 'audio/mpeg',
      usage: {
        charactersUsed: text.length,
        charactersRemaining: 10000 - this.charactersUsed // Estimado
      }
    };
  }

  /**
   * Procesa respuesta de ElevenLabs
   */
  private async processResponse(
    response: ElevenLabsResponse,
    options: TextToSpeechOptions,
    startTime: number,
    processedText: string
  ): Promise<SpeechSynthesisResult> {
    const processingTime = Date.now() - startTime;
    
    // Estimar duración del audio (aproximadamente 150 palabras por minuto)
    const wordCount = processedText.split(/\s+/).length;
    const estimatedDuration = (wordCount / 150) * 60; // en segundos

    return {
      audioData: Buffer.from(response.audio),
      format: this.detectAudioFormat(response.contentType),
      sampleRate: options.config.sampleRate || 22050,
      duration: estimatedDuration,
      size: response.audio.byteLength,
      metadata: {
        voiceId: options.config.voice?.voiceId || this.config.defaultVoiceId!,
        language: options.config.voice?.language || 'es',
        charactersUsed: options.text.length,
        processingTime,
        cost: (options.text.length / 1000) * 0.30
      }
    };
  }

  /**
   * Detecta formato de audio desde content-type
   */
  private detectAudioFormat(contentType: string): string {
    switch (contentType) {
      case 'audio/mpeg':
      case 'audio/mp3':
        return 'mp3';
      case 'audio/wav':
      case 'audio/wave':
        return 'wav';
      case 'audio/ogg':
        return 'ogg';
      default:
        return 'mp3'; // Por defecto
    }
  }

  /**
   * Infiere idioma desde labels de voz
   */
  private inferLanguage(labels: Record<string, string>): string {
    // Buscar en labels por indicadores de idioma
    if (labels.language) return labels.language;
    if (labels.accent?.includes('american') || labels.accent?.includes('british')) return 'en';
    if (labels.accent?.includes('spanish') || labels.accent?.includes('mexican')) return 'es';
    if (labels.accent?.includes('french')) return 'fr';
    if (labels.accent?.includes('german')) return 'de';
    if (labels.accent?.includes('italian')) return 'it';
    
    // Por defecto inglés si no se puede determinar
    return 'en';
  }

  /**
   * Infiere género desde nombre y labels
   */
  private inferGender(name: string, labels: Record<string, string>): 'male' | 'female' | 'neutral' {
    // Verificar labels primero
    if (labels.gender) {
      return labels.gender.toLowerCase() as 'male' | 'female' | 'neutral';
    }

    // Nombres comunes masculinos en ElevenLabs
    const maleNames = ['adam', 'antoni', 'arnold', 'bill', 'callum', 'charlie', 'clyde', 'daniel', 'dave', 'drew', 'ethan', 'fin', 'george', 'giovanni', 'james', 'jeremy', 'josh', 'liam', 'michael', 'sam', 'thomas', 'will'];
    
    // Nombres comunes femeninos en ElevenLabs  
    const femaleNames = ['alice', 'bella', 'charlotte', 'dorothy', 'emily', 'elli', 'freya', 'gigi', 'grace', 'jessica', 'lily', 'mimi', 'nicole', 'rachel', 'sarah', 'serena'];

    const lowerName = name.toLowerCase();
    
    if (maleNames.includes(lowerName)) return 'male';
    if (femaleNames.includes(lowerName)) return 'female';
    
    return 'neutral';
  }

  /**
   * Estima duración del audio
   */
  private estimateDuration(text: string, speed: number = 1.0): number {
    // Estimación: ~150 palabras por minuto en velocidad normal
    const wordsPerMinute = 150 * speed;
    const wordCount = text.split(/\s+/).length;
    return (wordCount / wordsPerMinute) * 60; // en segundos
  }

  /**
   * Maneja errores específicos de ElevenLabs
   */
  private handleElevenLabsError(error: any, options?: TextToSpeechOptions): Error {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Errores de autenticación
    if (errorMessage.includes('401') || errorMessage.includes('unauthorized')) {
      return new Error('API key inválida para ElevenLabs');
    }

    // Errores de rate limiting
    if (errorMessage.includes('429') || errorMessage.includes('rate limit')) {
      return new Error('Límite de requests excedido en ElevenLabs');
    }

    // Errores de cuota
    if (errorMessage.includes('quota') || errorMessage.includes('insufficient')) {
      return new Error('Cuota de caracteres agotada en ElevenLabs');
    }

    // Errores de validación
    if (errorMessage.includes('400') || errorMessage.includes('bad request')) {
      return new Error(`Request inválido a ElevenLabs: ${errorMessage}`);
    }

    // Errores de voz no encontrada
    if (errorMessage.includes('404') || errorMessage.includes('not found')) {
      const voiceId = options?.config.voice?.voiceId;
      return new Error(`Voz no encontrada en ElevenLabs${voiceId ? `: ${voiceId}` : ''}`);
    }

    // Errores de timeout
    if (errorMessage.includes('timeout') || errorMessage.includes('ECONNRESET')) {
      return new Error('Timeout en request a ElevenLabs');
    }

    // Error genérico
    return new Error(`Error en ElevenLabs: ${errorMessage}`);
  }
}

/**
 * Implementación simple de cache en memoria para TTS
 */
export class TTSMemoryCache implements ITTSCache {
  private cache: Map<string, { result: SpeechSynthesisResult; expiry: number }> = new Map();
  private hits: number = 0;
  private requests: number = 0;

  async get(key: string): Promise<SpeechSynthesisResult | null> {
    this.requests++;
    
    const cached = this.cache.get(key);
    if (!cached) return null;

    // Verificar expiración
    if (Date.now() > cached.expiry) {
      this.cache.delete(key);
      return null;
    }

    this.hits++;
    return cached.result;
  }

  async set(key: string, result: SpeechSynthesisResult, ttl: number = 3600): Promise<void> {
    const expiry = Date.now() + (ttl * 1000);
    this.cache.set(key, { result, expiry });

    // Limpiar cache si excede 100 entradas
    if (this.cache.size > 100) {
      this.cleanup();
    }
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(key);
  }

  generateKey(text: string, config: SpeechSynthesisConfig): string {
    // Crear hash simple del texto y configuración
    const configStr = JSON.stringify({
      voiceId: config.voice?.voiceId,
      language: config.voice?.language,
      speed: config.speed,
      pitch: config.pitch,
      format: config.format
    });
    
    return this.simpleHash(text + configStr);
  }

  async getStats(): Promise<{
    hitRate: number;
    totalRequests: number;
    cacheSize: number;
    itemCount: number;
  }> {
    return {
      hitRate: this.requests > 0 ? this.hits / this.requests : 0,
      totalRequests: this.requests,
      cacheSize: this.calculateCacheSize(),
      itemCount: this.cache.size
    };
  }

  /**
   * Limpia entradas expiradas
   */
  private cleanup(): void {
    const now = Date.now();
    const toDelete: string[] = [];

    for (const [key, cached] of this.cache.entries()) {
      if (now > cached.expiry) {
        toDelete.push(key);
      }
    }

    // Si no hay suficientes expiradas, eliminar las más antiguas
    if (toDelete.length < 20) {
      const entries = Array.from(this.cache.entries());
      const sortedByExpiry = entries.sort((a, b) => a[1].expiry - b[1].expiry);
      const toRemove = sortedByExpiry.slice(0, 20);
      toDelete.push(...toRemove.map(([key]) => key));
    }

    toDelete.forEach(key => this.cache.delete(key));
    
    logger.debug('Cache TTS limpiado', {
      itemsRemoved: toDelete.length,
      remainingItems: this.cache.size
    });
  }

  /**
   * Calcula tamaño estimado del cache
   */
  private calculateCacheSize(): number {
    let totalSize = 0;
    
    for (const [key, cached] of this.cache.entries()) {
      totalSize += key.length * 2; // Caracteres UTF-16
      totalSize += cached.result.audioData.byteLength;
      totalSize += JSON.stringify(cached.result.metadata || {}).length * 2;
    }

    return totalSize;
  }

  /**
   * Hash simple para generar claves de cache
   */
  private simpleHash(str: string): string {
    let hash = 0;
    if (str.length === 0) return hash.toString();
    
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convertir a 32bit integer
    }
    
    return Math.abs(hash).toString(36);
  }
}