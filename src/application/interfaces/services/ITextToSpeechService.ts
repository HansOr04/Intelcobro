// src/application/interfaces/services/ITextToSpeechService.ts

/**
 * Configuración de voz
 */
export interface VoiceConfig {
  voiceId: string;
  language: string;
  gender?: 'male' | 'female' | 'neutral';
  age?: 'young' | 'middle' | 'old';
  accent?: string;
  style?: 'conversational' | 'professional' | 'cheerful' | 'serious';
}

/**
 * Configuración de síntesis de voz
 */
export interface SpeechSynthesisConfig {
  voice: VoiceConfig;
  speed?: number; // 0.25 - 4.0
  pitch?: number; // 0.25 - 4.0
  volume?: number; // 0.0 - 1.0
  stability?: number; // 0.0 - 1.0 (ElevenLabs)
  clarity?: number; // 0.0 - 1.0 (ElevenLabs)
  emotionalRange?: number; // 0.0 - 1.0
  format?: 'mp3' | 'wav' | 'ogg' | 'webm';
  sampleRate?: number; // 8000, 16000, 22050, 44100, 48000
  bitrate?: number;
}

/**
 * Resultado de síntesis de voz
 */
export interface SpeechSynthesisResult {
  audioData: Buffer;
  audioUrl?: string;
  format: string;
  sampleRate: number;
  duration: number; // en segundos
  size: number; // en bytes
  metadata?: {
    voiceId: string;
    language: string;
    charactersUsed: number;
    processingTime: number;
    cost?: number;
  };
}

/**
 * Información de voz disponible
 */
export interface VoiceInfo {
  id: string;
  name: string;
  language: string;
  languageCode: string;
  gender: 'male' | 'female' | 'neutral';
  accent?: string;
  description?: string;
  category: 'standard' | 'neural' | 'premium';
  isCustom: boolean;
  previewUrl?: string;
  features: string[];
  pricing?: {
    charactersPerRequest: number;
    costPer1000Characters: number;
  };
}

/**
 * Opciones para conversión de texto a voz
 */
export interface TextToSpeechOptions {
  text: string;
  config: SpeechSynthesisConfig;
  outputPath?: string;
  saveToCloud?: boolean;
  cloudPath?: string;
  metadata?: Record<string, any>;
}

/**
 * Opciones para síntesis en lote
 */
export interface BatchSynthesisOptions {
  items: Array<{
    id: string;
    text: string;
    config?: Partial<SpeechSynthesisConfig>;
    outputPath?: string;
  }>;
  defaultConfig: SpeechSynthesisConfig;
  concurrency?: number;
  onProgress?: (completed: number, total: number) => void;
}

/**
 * Resultado de síntesis en lote
 */
export interface BatchSynthesisResult {
  successful: number;
  failed: number;
  results: Array<{
    id: string;
    success: boolean;
    result?: SpeechSynthesisResult;
    error?: string;
  }>;
  totalDuration: number;
  totalSize: number;
}

/**
 * Configuración de streaming de audio
 */
export interface AudioStreamConfig {
  chunkSize?: number;
  bufferSize?: number;
  enableRealtime?: boolean;
  onChunk?: (chunk: Buffer) => void;
  onComplete?: (result: SpeechSynthesisResult) => void;
  onError?: (error: Error) => void;
}

/**
 * Opciones para clonación de voz
 */
export interface VoiceCloningOptions {
  name: string;
  description?: string;
  sampleAudioFiles: Buffer[];
  language: string;
  gender: 'male' | 'female';
  trainingConfig?: {
    epochs?: number;
    learningRate?: number;
    batchSize?: number;
  };
}

/**
 * Resultado de clonación de voz
 */
export interface VoiceCloningResult {
  voiceId: string;
  status: 'training' | 'ready' | 'failed';
  progress?: number;
  estimatedCompletion?: Date;
  quality?: {
    similarity: number;
    naturalness: number;
    clarity: number;
  };
}

/**
 * Estadísticas de uso del servicio
 */
export interface TTSUsageStats {
  charactersUsed: number;
  requestsCount: number;
  totalDuration: number;
  totalSize: number;
  costToday?: number;
  quotaRemaining?: number;
  topVoices: Array<{
    voiceId: string;
    usage: number;
  }>;
  languageDistribution: Record<string, number>;
}

/**
 * Interface principal del servicio de Text-to-Speech
 */
export interface ITextToSpeechService {
  /**
   * Convierte texto a voz
   */
  synthesize(options: TextToSpeechOptions): Promise<SpeechSynthesisResult>;

  /**
   * Convierte texto a voz con streaming
   */
  synthesizeStream(
    text: string,
    config: SpeechSynthesisConfig,
    streamConfig: AudioStreamConfig
  ): Promise<void>;

  /**
   * Síntesis en lote
   */
  synthesizeBatch(options: BatchSynthesisOptions): Promise<BatchSynthesisResult>;

  /**
   * Obtiene lista de voces disponibles
   */
  getAvailableVoices(language?: string): Promise<VoiceInfo[]>;

  /**
   * Obtiene información detallada de una voz
   */
  getVoiceInfo(voiceId: string): Promise<VoiceInfo>;

  /**
   * Genera preview de una voz
   */
  generateVoicePreview(
    voiceId: string,
    sampleText?: string
  ): Promise<SpeechSynthesisResult>;

  /**
   * Clona una voz (si el servicio lo soporta)
   */
  cloneVoice(options: VoiceCloningOptions): Promise<VoiceCloningResult>;

  /**
   * Obtiene estado de clonación de voz
   */
  getVoiceCloningStatus(voiceId: string): Promise<VoiceCloningResult>;

  /**
   * Elimina una voz clonada
   */
  deleteClonedVoice(voiceId: string): Promise<void>;

  /**
   * Valida texto para síntesis
   */
  validateText(text: string): Promise<{
    isValid: boolean;
    errors: string[];
    characterCount: number;
    estimatedDuration: number;
    estimatedCost?: number;
  }>;

  /**
   * Optimiza texto para mejor síntesis
   */
  optimizeText(text: string, language: string): Promise<{
    optimizedText: string;
    changes: Array<{
      original: string;
      optimized: string;
      reason: string;
    }>;
  }>;

  /**
   * Convierte SSML a texto plano
   */
  ssmlToText(ssml: string): string;

  /**
   * Convierte texto a SSML
   */
  textToSsml(
    text: string,
    options?: {
      addBreaks?: boolean;
      addEmphasis?: string[];
      speechRate?: 'slow' | 'medium' | 'fast';
      pitch?: 'low' | 'medium' | 'high';
    }
  ): string;

  /**
   * Obtiene estadísticas de uso
   */
  getUsageStats(period?: { from: Date; to: Date }): Promise<TTSUsageStats>;

  /**
   * Verifica disponibilidad del servicio
   */
  isAvailable(): Promise<boolean>;

  /**
   * Obtiene límites y cuotas
   */
  getLimits(): Promise<{
    maxCharactersPerRequest: number;
    maxRequestsPerDay: number;
    maxConcurrentRequests: number;
    supportedFormats: string[];
    supportedLanguages: string[];
  }>;
}

/**
 * Interface para cache de audio
 */
export interface ITTSCache {
  /**
   * Obtiene audio cacheado
   */
  get(key: string): Promise<SpeechSynthesisResult | null>;

  /**
   * Guarda audio en cache
   */
  set(
    key: string,
    result: SpeechSynthesisResult,
    ttl?: number
  ): Promise<void>;

  /**
   * Elimina audio del cache
   */
  delete(key: string): Promise<void>;

  /**
   * Genera clave de cache
   */
  generateKey(text: string, config: SpeechSynthesisConfig): string;

  /**
   * Obtiene estadísticas del cache
   */
  getStats(): Promise<{
    hitRate: number;
    totalRequests: number;
    cacheSize: number;
    itemCount: number;
  }>;
}

/**
 * Factory para crear instancias del servicio TTS
 */
export interface ITTSServiceFactory {
  /**
   * Crea instancia con configuración específica
   */
  create(config: {
    provider: 'elevenlabs' | 'azure' | 'google' | 'aws';
    apiKey: string;
    region?: string;
    baseUrl?: string;
  }): ITextToSpeechService;

  /**
   * Crea instancia por defecto
   */
  createDefault(): ITextToSpeechService;
}

/**
 * Constantes del servicio TTS
 */
export const TTS_SERVICE_CONSTANTS = {
  MAX_TEXT_LENGTH: 5000,
  MAX_SSML_LENGTH: 10000,
  DEFAULT_SAMPLE_RATE: 22050,
  DEFAULT_FORMAT: 'mp3',
  
  SUPPORTED_FORMATS: ['mp3', 'wav', 'ogg', 'webm'],
  SUPPORTED_SAMPLE_RATES: [8000, 16000, 22050, 44100, 48000],
  
  DEFAULT_VOICE_CONFIG: {
    speed: 1.0,
    pitch: 1.0,
    volume: 1.0,
    stability: 0.5,
    clarity: 0.75
  },
  
  LANGUAGE_CODES: {
    'es': 'es-ES',
    'en': 'en-US',
    'fr': 'fr-FR',
    'de': 'de-DE',
    'it': 'it-IT',
    'pt': 'pt-BR'
  },
  
  CACHE_TTL: {
    VOICE_LIST: 3600, // 1 hora
    VOICE_INFO: 3600, // 1 hora
    AUDIO_SYNTHESIS: 86400 // 24 horas
  },
  
  QUALITY_SETTINGS: {
    LOW: { sampleRate: 16000, bitrate: 64 },
    MEDIUM: { sampleRate: 22050, bitrate: 128 },
    HIGH: { sampleRate: 44100, bitrate: 192 },
    PREMIUM: { sampleRate: 48000, bitrate: 320 }
  }
} as const;

/**
 * Helper para trabajar con configuraciones de voz
 */
export class TTSConfigHelper {
  /**
   * Crea configuración por defecto para español
   */
  static createDefaultSpanishConfig(): SpeechSynthesisConfig {
    return {
      voice: {
        voiceId: 'es-ES-default',
        language: 'es-ES',
        gender: 'female',
        style: 'conversational'
      },
      speed: 1.0,
      pitch: 1.0,
      volume: 1.0,
      format: 'mp3',
      sampleRate: 22050
    };
  }

  /**
   * Optimiza configuración basada en el tipo de contenido
   */
  static optimizeForContent(
    baseConfig: SpeechSynthesisConfig,
    contentType: 'chat' | 'notification' | 'announcement' | 'marketing'
  ): SpeechSynthesisConfig {
    const config = { ...baseConfig };

    switch (contentType) {
      case 'chat':
        config.speed = 1.1;
        config.voice.style = 'conversational';
        break;
      case 'notification':
        config.speed = 0.9;
        config.pitch = 1.1;
        config.voice.style = 'professional';
        break;
      case 'announcement':
        config.speed = 0.8;
        config.pitch = 0.9;
        config.volume = 1.0;
        break;
      case 'marketing':
        config.speed = 1.0;
        config.voice.style = 'cheerful';
        break;
    }

    return config;
  }

  /**
   * Valida configuración de síntesis
   */
  static validateConfig(config: SpeechSynthesisConfig): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (config.speed && (config.speed < 0.25 || config.speed > 4.0)) {
      errors.push('Speed debe estar entre 0.25 y 4.0');
    }

    if (config.pitch && (config.pitch < 0.25 || config.pitch > 4.0)) {
      errors.push('Pitch debe estar entre 0.25 y 4.0');
    }

    if (config.volume && (config.volume < 0.0 || config.volume > 1.0)) {
      errors.push('Volume debe estar entre 0.0 y 1.0');
    }

    if (config.format && !TTS_SERVICE_CONSTANTS.SUPPORTED_FORMATS.includes(config.format)) {
      errors.push(`Formato no soportado: ${config.format}`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Calcula duración estimada del audio
   */
  static estimateDuration(text: string, speed: number = 1.0): number {
    // Estimación: ~150 palabras por minuto en velocidad normal
    const wordsPerMinute = 150 * speed;
    const wordCount = text.split(/\s+/).length;
    return (wordCount / wordsPerMinute) * 60; // en segundos
  }

  /**
   * Calcula tamaño estimado del archivo
   */
  static estimateFileSize(
    duration: number,
    format: string,
    sampleRate: number = 22050
  ): number {
    const bitsPerSample = 16;
    const channels = 1;
    
    let compressionRatio = 1;
    switch (format) {
      case 'mp3':
        compressionRatio = 0.1; // ~10:1 compression
        break;
      case 'ogg':
        compressionRatio = 0.12;
        break;
      case 'wav':
        compressionRatio = 1; // No compression
        break;
      default:
        compressionRatio = 0.1;
    }

    const uncompressedSize = duration * sampleRate * bitsPerSample * channels / 8;
    return Math.round(uncompressedSize * compressionRatio);
  }
}