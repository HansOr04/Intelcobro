// src/application/interfaces/services/IAIService.ts

import { MessageType } from '../../../domain/enums/MessageType';

/**
 * Configuración para la generación de respuestas de IA
 */
export interface AIGenerationConfig {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stopSequences?: string[];
  stream?: boolean;
}

/**
 * Contexto del mensaje para la IA
 */
export interface AIMessageContext {
  sessionId: string;
  userId?: string | undefined;
  messageHistory?: AIMessage[] | undefined;
  userProfile?: Record<string, any> | undefined;
  businessContext?: string | undefined;
  language?: string | undefined;
  metadata?: Record<string, any> | undefined;
}

/**
 * Contexto de la solicitud de IA
 */
export interface AIRequestContext {
  messageId?: string | undefined;
  sessionId?: string | undefined;
  userId?: string | undefined;
  prompt?: string | undefined;
  model?: string | undefined;
  temperature?: number | undefined;
  maxTokens?: number | undefined;
  metadata?: Record<string, any> | undefined;
}

/**
 * Mensaje para la conversación con IA
 */
export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp?: Date;
  metadata?: Record<string, any>;
}

/**
 * Respuesta de la IA
 */
export interface AIResponse {
  content: string;
  messageType: MessageType;
  confidence?: number;
  tokensUsed?: {
    prompt: number;
    completion: number;
    total: number;
  };
  model?: string;
  finishReason?: 'stop' | 'length' | 'content_filter' | 'function_call';
  responseTime?: number;
  metadata?: Record<string, any>;
}

/**
 * Opciones para análisis de sentimiento
 */
export interface SentimentAnalysisOptions {
  includeEmotions?: boolean;
  includeIntent?: boolean;
  language?: string;
}

/**
 * Resultado del análisis de sentimiento
 */
export interface SentimentAnalysisResult {
  sentiment: 'positive' | 'negative' | 'neutral';
  confidence: number;
  emotions?: Record<string, number>;
  intent?: string;
  keywords?: string[];
  urgency?: 'low' | 'medium' | 'high';
}

/**
 * Opciones para moderación de contenido
 */
export interface ContentModerationOptions {
  categories?: string[];
  threshold?: number;
  includeReasons?: boolean;
}

/**
 * Resultado de la moderación de contenido
 */
export interface ContentModerationResult {
  flagged: boolean;
  confidence?: number | undefined;
  categories: Record<string, boolean>;
  categoryScores?: Record<string, number> | undefined;
  reasons?: string[] | undefined;
  suggestion?: string | undefined;
  metadata?: Record<string, any> | undefined;
}

/**
 * Opciones para resumen de texto - ADDED MISSING INTERFACE
 */
export interface TextSummaryOptions {
  maxLength?: number;
  style?: 'concise' | 'detailed' | 'balanced';
  language?: string;
  model?: string;
}

/**
 * Resultado del resumen de texto - ADDED MISSING INTERFACE
 */
export interface TextSummaryResult {
  summary: string;
  originalLength: number;
  summaryLength: number;
  compressionRatio: number;
  keyPoints?: string[];
  confidence?: number;
  language?: string;
}

/**
 * Estadísticas del servicio de IA - ADDED MISSING INTERFACE
 */
export interface AIServiceStats {
  provider: string;
  requestCount: number;
  successRate: number;
  averageResponseTime: number;
  uptime: number;
  lastRequestTime: Date;
  modelsAvailable: string[];
  rateLimits: {
    requestsPerMinute: number;
    tokensPerMinute: number;
    requestsPerDay: number;
  };
}

/**
 * Opciones para resumen de texto - LEGACY SUPPORT
 */
export interface TextSummarizationOptions {
  maxLength?: number;
  style?: 'concise' | 'detailed' | 'bullet-points';
  language?: string;
  preserveKeyPoints?: boolean;
}

/**
 * Resultado del resumen de texto - LEGACY SUPPORT
 */
export interface TextSummarizationResult {
  summary: string;
  keyPoints?: string[];
  originalLength: number;
  summaryLength: number;
  compressionRatio: number;
}

/**
 * Opciones para clasificación de texto
 */
export interface TextClassificationOptions {
  categories: string[];
  confidence?: number;
  multiLabel?: boolean;
}

/**
 * Resultado de la clasificación de texto
 */
export interface TextClassificationResult {
  category: string;
  confidence: number;
  allCategories?: Record<string, number>;
  isMultiLabel?: boolean;
}

/**
 * Opciones para extracción de entidades
 */
export interface EntityExtractionOptions {
  types?: string[];
  includeConfidence?: boolean;
  language?: string;
}

/**
 * Entidad extraída del texto
 */
export interface ExtractedEntity {
  text: string;
  type: string;
  confidence?: number;
  startIndex: number;
  endIndex: number;
  metadata?: Record<string, any>;
}

/**
 * Resultado de la extracción de entidades
 */
export interface EntityExtractionResult {
  entities: ExtractedEntity[];
  entityCount: number;
  types: string[];
}

/**
 * Interface principal del servicio de IA
 */
export interface IAIService {
  /**
   * Genera una respuesta contextual para un mensaje del usuario
   */
  generateResponse(
    userMessage: string,
    context: AIMessageContext,
    config?: AIGenerationConfig
  ): Promise<AIResponse>;

  /**
   * Genera una respuesta conversacional básica
   */
  generateChatResponse?(
    message: string,
    conversationHistory?: AIMessage[],
    config?: AIGenerationConfig
  ): Promise<AIResponse>;

  /**
   * Analiza el sentimiento de un texto
   */
  analyzeSentiment(
    text: string,
    options?: SentimentAnalysisOptions
  ): Promise<SentimentAnalysisResult>;

  /**
   * Modera contenido para detectar contenido inapropiado
   */
  moderateContent(
    text: string,
    options?: ContentModerationOptions
  ): Promise<ContentModerationResult>;

  /**
   * Resume un texto largo
   */
  summarizeText(
    text: string,
    options?: TextSummaryOptions
  ): Promise<TextSummaryResult>;

  /**
   * Clasifica texto en categorías predefinidas
   */
  classifyText?(
    text: string,
    options: TextClassificationOptions
  ): Promise<TextClassificationResult>;

  /**
   * Extrae entidades nombradas del texto
   */
  extractEntities?(
    text: string,
    options?: EntityExtractionOptions
  ): Promise<EntityExtractionResult>;

  /**
   * Genera respuestas para diferentes tipos de formularios
   */
  generateFormResponse?(
    formType: string,
    formData: Record<string, any>,
    config?: AIGenerationConfig
  ): Promise<AIResponse>;

  /**
   * Genera contenido personalizado basado en plantillas
   */
  generateFromTemplate?(
    templateName: string,
    variables: Record<string, any>,
    config?: AIGenerationConfig
  ): Promise<AIResponse>;

  /**
   * Traduce texto a otro idioma
   */
  translateText?(
    text: string,
    targetLanguage: string,
    sourceLanguage?: string
  ): Promise<string>;

  /**
   * Detecta el idioma de un texto
   */
  detectLanguage?(text: string): Promise<{
    language: string;
    confidence: number;
    supportedLanguages: string[];
  }>;

  /**
   * Genera texto creativo basado en un prompt
   */
  generateCreativeText?(
    prompt: string,
    style?: 'formal' | 'casual' | 'creative' | 'technical',
    config?: AIGenerationConfig
  ): Promise<AIResponse>;

  /**
   * Mejora un texto existente
   */
  improveText?(
    text: string,
    improvements: string[],
    config?: AIGenerationConfig
  ): Promise<AIResponse>;

  /**
   * Genera sugerencias de preguntas frecuentes
   */
  generateFAQSuggestions?(
    context: string,
    config?: AIGenerationConfig
  ): Promise<Array<{ question: string; answer: string }>>;

  /**
   * Evalúa la calidad de un texto
   */
  evaluateTextQuality?(
    text: string,
    criteria: string[]
  ): Promise<{
    overallScore: number;
    criteriaScores: Record<string, number>;
    suggestions: string[];
  }>;

  /**
   * Obtiene estadísticas del servicio
   */
  getStats?(): Promise<AIServiceStats>;

  /**
   * Verifica disponibilidad del servicio
   */
  isAvailable(): Promise<boolean>;

  /**
   * Obtiene información del modelo actual
   */
  getModelInfo?(): Promise<{
    name: string;
    version: string;
    capabilities: string[];
    limits: {
      maxTokens: number;
      maxContext: number;
      rateLimit: number;
    };
  }>;
}