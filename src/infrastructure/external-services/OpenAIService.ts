// src/infrastructure/external-services/OpenAIService.ts

import OpenAI from 'openai';
import { 
  IAIService,
  AIGenerationConfig,
  AIMessageContext,
  AIResponse,
  AIMessage,
  SentimentAnalysisResult,
  SentimentAnalysisOptions,
  ContentModerationResult,
  ContentModerationOptions,
  TextSummaryOptions,
  TextSummaryResult,
  AIServiceStats
} from '../../application/interfaces/services/IAIService';
import { MessageType } from '../../domain/enums/MessageType';
import { AIServiceException } from '../../application/exceptions/AIServiceException';
import { logger } from '../../shared/utils/Logger';

/**
 * Configuración específica de OpenAI
 */
interface OpenAIConfig {
  apiKey: string;
  baseURL?: string;
  organization?: string;
  project?: string;
  maxRetries?: number;
  timeout?: number;
  defaultModel?: string;
}

/**
 * Implementación del servicio de IA usando OpenAI
 */
export class OpenAIService implements IAIService {
  private client: OpenAI;
  private config: OpenAIConfig;
  private requestCount: number = 0;
  private lastResetTime: Date = new Date();

  constructor(config: OpenAIConfig) {
    this.config = {
      maxRetries: 3,
      timeout: 30000,
      defaultModel: 'gpt-4',
      ...config
    };

    this.client = new OpenAI({
      apiKey: this.config.apiKey,
      baseURL: this.config.baseURL,
      organization: this.config.organization,
      project: this.config.project,
      maxRetries: this.config.maxRetries,
      timeout: this.config.timeout
    });

    logger.info('OpenAI Service inicializado', {
      model: this.config.defaultModel,
      maxRetries: this.config.maxRetries,
      timeout: this.config.timeout
    });
  }

  /**
   * Genera respuesta usando OpenAI GPT
   */
  async generateResponse(
    prompt: string,
    context: AIMessageContext,
    config?: AIGenerationConfig
  ): Promise<AIResponse> {
    const startTime = Date.now();
    this.requestCount++;

    try {
      const messages = this.buildMessages(prompt, context);
      const requestConfig = this.buildRequestConfig(config);

      logger.debug('Enviando request a OpenAI', {
        sessionId: context.sessionId,
        messageCount: messages.length,
        model: requestConfig.model,
        max_tokens: requestConfig.max_tokens
      });

      const completion = await this.client.chat.completions.create({
        messages,
        ...requestConfig
      }) as OpenAI.Chat.ChatCompletion;

      const response = this.processOpenAIResponse(completion, startTime, context);
      
      logger.info('Respuesta generada exitosamente', {
        sessionId: context.sessionId,
        tokensUsed: response.tokensUsed?.total,
        responseTime: response.responseTime,
        model: response.model
      });

      return response;

    } catch (error) {
      logger.error('Error generando respuesta OpenAI', undefined, {
        sessionId: context.sessionId,
        errorMessage: error instanceof Error ? error.message : 'Error desconocido',
        responseTime: Date.now() - startTime
      });

      throw AIServiceException.fromOpenAIError(error, {
        sessionId: context.sessionId,
        userId: context.userId || undefined,
        prompt: prompt.substring(0, 100),
        model: config?.model || this.config.defaultModel
      });
    }
  }

  /**
   * Analiza el sentimiento del texto
   */
  async analyzeSentiment(
    text: string,
    options?: SentimentAnalysisOptions
  ): Promise<SentimentAnalysisResult> {
    try {
      const prompt = this.buildSentimentPrompt(text, options);
      
      const completion = await this.client.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 200,
        temperature: 0.1
      });

      const result = completion.choices[0]?.message?.content;
      if (!result) {
        throw new Error('No se pudo obtener análisis de sentimiento');
      }

      return this.parseSentimentResponse(result);

    } catch (error) {
      logger.error('Error analizando sentimiento', undefined, { 
        errorMessage: error instanceof Error ? error.message : 'Error desconocido' 
      });
      throw AIServiceException.unknown('openai', error);
    }
  }

  /**
   * Modera contenido usando OpenAI
   */
  async moderateContent(
    text: string,
    options?: ContentModerationOptions
  ): Promise<ContentModerationResult> {
    try {
      const moderation = await this.client.moderations.create({
        input: text,
        model: 'text-moderation-latest'
      });

      const result = moderation.results[0];
      if (!result) {
        throw new Error('No se pudo obtener resultado de moderación');
      }
      
      return {
        flagged: result.flagged,
        confidence: this.calculateModerationConfidence(result),
        categories: result.categories as unknown as Record<string, boolean>,
        categoryScores: result.category_scores as unknown as Record<string, number>,
        reasons: this.extractModerationReasons(result),
        suggestion: result.flagged 
          ? 'Contenido requiere revisión manual'
          : 'Contenido aprobado',
        metadata: {
          model: 'text-moderation-latest',
          categories: result.categories,
          categoryScores: result.category_scores
        }
      };

    } catch (error) {
      logger.error('Error moderando contenido', undefined, { 
        errorMessage: error instanceof Error ? error.message : 'Error desconocido' 
      });
      throw AIServiceException.unknown('openai', error);
    }
  }

  /**
   * Resume texto usando OpenAI
   */
  async summarizeText(
    text: string,
    options?: TextSummaryOptions
  ): Promise<TextSummaryResult> {
    try {
      const prompt = this.buildSummaryPrompt(text, options);
      
      const completion = await this.client.chat.completions.create({
        model: options?.model || 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: options?.maxLength || 200,
        temperature: 0.3
      });

      const summary = completion.choices[0]?.message?.content;
      if (!summary) {
        throw new Error('No se pudo generar resumen');
      }

      return {
        summary,
        originalLength: text.length,
        summaryLength: summary.length,
        compressionRatio: summary.length / text.length,
        keyPoints: this.extractKeyPoints(summary),
        confidence: 0.85, // Valor estimado para OpenAI
        language: options?.language || 'es'
      };

    } catch (error) {
      logger.error('Error resumiendo texto', undefined, { 
        errorMessage: error instanceof Error ? error.message : 'Error desconocido' 
      });
      throw AIServiceException.unknown('openai', error);
    }
  }

  /**
   * Obtiene estadísticas del servicio
   */
  async getStats(): Promise<AIServiceStats> {
    const now = new Date();
    const timeSinceReset = now.getTime() - this.lastResetTime.getTime();
    const hoursActive = timeSinceReset / (1000 * 60 * 60);

    return {
      provider: 'openai',
      requestCount: this.requestCount,
      successRate: 0.95, // Estimado
      averageResponseTime: 2500, // Estimado en ms
      uptime: hoursActive,
      lastRequestTime: now,
      modelsAvailable: ['gpt-4', 'gpt-3.5-turbo', 'gpt-4-turbo'],
      rateLimits: {
        requestsPerMinute: 60,
        tokensPerMinute: 90000,
        requestsPerDay: 10000
      }
    };
  }

  /**
   * Verifica si el servicio está disponible
   */
  async isAvailable(): Promise<boolean> {
    try {
      await this.client.models.list();
      return true;
    } catch (error) {
      logger.warn('OpenAI Service no disponible', { 
        errorMessage: error instanceof Error ? error.message : 'Error desconocido' 
      });
      return false;
    }
  }

  /**
   * Construye los mensajes para OpenAI
   */
  private buildMessages(prompt: string, context: AIMessageContext): OpenAI.Chat.ChatCompletionMessageParam[] {
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

    // Sistema de prompt base
    messages.push({
      role: 'system',
      content: this.buildSystemPrompt(context)
    });

    // Historial de mensajes si existe
    if (context.messageHistory && context.messageHistory.length > 0) {
      const relevantHistory = context.messageHistory.slice(-10); // Últimos 10 mensajes
      
      relevantHistory.forEach(msg => {
        messages.push({
          role: msg.role,
          content: msg.content
        });
      });
    }

    // Mensaje actual del usuario
    messages.push({
      role: 'user',
      content: prompt
    });

    return messages;
  }

  /**
   * Construye el prompt del sistema
   */
  private buildSystemPrompt(context: AIMessageContext): string {
    const businessContext = context.businessContext || 'Intelcobro - Empresa de desarrollo de software';
    const language = context.language || 'español';

    return `Eres un asistente de IA especializado en ${businessContext}.

INSTRUCCIONES:
- Responde siempre en ${language}
- Mantén un tono profesional pero amigable
- Proporciona información útil y relevante
- Si no sabes algo, admítelo honestamente
- Sugiere productos o servicios cuando sea apropiado
- Mantén las respuestas concisas pero informativas

CONTEXTO DE LA CONVERSACIÓN:
- Sesión: ${context.sessionId}
- Usuario: ${context.userId || 'Anónimo'}
- Negocio: ${businessContext}

Responde de manera que ayude al usuario a resolver su consulta de forma efectiva.`;
  }

  /**
   * Construye la configuración de la request
   */
  private buildRequestConfig(config?: AIGenerationConfig): Omit<OpenAI.Chat.ChatCompletionCreateParams, 'messages'> {
    return {
      model: config?.model || this.config.defaultModel || 'gpt-4',
      max_tokens: config?.maxTokens || 1000,
      temperature: config?.temperature || 0.7,
      top_p: config?.topP || 1,
      frequency_penalty: config?.frequencyPenalty || 0,
      presence_penalty: config?.presencePenalty || 0,
      stop: config?.stopSequences ?? null
    };
  }

  /**
   * Procesa la respuesta de OpenAI
   */
  private processOpenAIResponse(
    completion: OpenAI.Chat.ChatCompletion,
    startTime: number,
    context: AIMessageContext
  ): AIResponse {
    const choice = completion.choices[0];
    if (!choice) {
      throw new Error('No choice available in OpenAI response');
    }
    
    const content = choice.message?.content || '';
    
    return {
      content,
      messageType: this.detectMessageType(content),
      confidence: this.calculateConfidence(choice),
      tokensUsed: {
        prompt: completion.usage?.prompt_tokens || 0,
        completion: completion.usage?.completion_tokens || 0,
        total: completion.usage?.total_tokens || 0
      },
      model: completion.model,
      finishReason: this.mapFinishReason(choice.finish_reason),
      responseTime: Date.now() - startTime,
      metadata: {
        sessionId: context.sessionId,
        userId: context.userId,
        timestamp: new Date().toISOString()
      }
    };
  }

  /**
   * Mapea finish_reason de OpenAI al tipo esperado
   */
  private mapFinishReason(finishReason: string | null): 'stop' | 'length' | 'content_filter' | 'function_call' {
    switch (finishReason) {
      case 'stop':
        return 'stop';
      case 'length':
        return 'length';
      case 'content_filter':
        return 'content_filter';
      case 'function_call':
      case 'tool_calls':
        return 'function_call';
      default:
        return 'stop';
    }
  }

  /**
   * Detecta el tipo de mensaje basado en el contenido
   */
  private detectMessageType(content: string): MessageType {
    // Análisis básico del contenido para determinar el tipo
    if (content.includes('?') && content.length < 100) {
      return MessageType.ASSISTANT_TEXT;
    }
    
    if (content.toLowerCase().includes('servicio') || 
        content.toLowerCase().includes('producto') ||
        content.toLowerCase().includes('desarrollo')) {
      return MessageType.ASSISTANT_TEXT;
    }

    return MessageType.ASSISTANT_TEXT;
  }

  /**
   * Calcula la confianza de la respuesta
   */
  private calculateConfidence(choice: OpenAI.Chat.ChatCompletion.Choice): number {
    // Lógica simple de confianza basada en finish_reason
    switch (choice?.finish_reason) {
      case 'stop':
        return 0.9;
      case 'length':
        return 0.7;
      case 'content_filter':
        return 0.3;
      default:
        return 0.5;
    }
  }

  /**
   * Construye prompt para análisis de sentimiento
   */
  private buildSentimentPrompt(text: string, options?: SentimentAnalysisOptions): string {
    return `Analiza el sentimiento del siguiente texto y responde SOLO con un JSON válido:

Texto: "${text}"

Formato de respuesta:
{
  "sentiment": "positive|negative|neutral",
  "confidence": 0.0-1.0,
  "emotions": {"joy": 0.0-1.0, "anger": 0.0-1.0, "sadness": 0.0-1.0, "fear": 0.0-1.0},
  "intent": "descripción de la intención",
  "keywords": ["palabra1", "palabra2"],
  "urgency": "low|medium|high"
}`;
  }

  /**
   * Parsea la respuesta de análisis de sentimiento
   */
  private parseSentimentResponse(response: string): SentimentAnalysisResult {
    try {
      const parsed = JSON.parse(response);
      return {
        sentiment: parsed.sentiment || 'neutral',
        confidence: parsed.confidence || 0.5,
        emotions: parsed.emotions || {},
        intent: parsed.intent || '',
        keywords: parsed.keywords || [],
        urgency: parsed.urgency || 'low'
      };
    } catch (error) {
      logger.warn('Error parseando respuesta de sentimiento', { 
        response, 
        errorMessage: error instanceof Error ? error.message : 'Error desconocido' 
      });
      return {
        sentiment: 'neutral',
        confidence: 0.5,
        urgency: 'low'
      };
    }
  }

  /**
   * Calcula confianza de moderación
   */
  private calculateModerationConfidence(result: any): number {
    if (!result.flagged) return 0.95;
    
    const scores = Object.values(result.category_scores) as number[];
    const maxScore = Math.max(...scores);
    return maxScore;
  }

  /**
   * Extrae razones de moderación
   */
  private extractModerationReasons(result: any): string[] {
    const flaggedCategories = Object.entries(result.categories)
      .filter(([_, flagged]) => flagged)
      .map(([category, _]) => category);
    
    return flaggedCategories.map(category => 
      `Contenido marcado por: ${category}`
    );
  }

  /**
   * Construye prompt para resumen
   */
  private buildSummaryPrompt(text: string, options?: TextSummaryOptions): string {
    const maxLength = options?.maxLength || 200;
    const style = options?.style || 'balanced';
    
    return `Resume el siguiente texto en máximo ${maxLength} caracteres, usando un estilo ${style}:

${text}

Resumen:`;
  }

  /**
   * Extrae puntos clave del resumen
   */
  private extractKeyPoints(summary: string): string[] {
    // Lógica simple para extraer puntos clave
    const sentences = summary.split(/[.!?]+/).filter(s => s.trim().length > 0);
    return sentences.slice(0, 3).map(s => s.trim());
  }
}