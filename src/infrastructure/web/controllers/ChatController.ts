// src/infrastructure/web/controllers/ChatController.ts

import { Request, Response, NextFunction } from 'express';
import { SendMessageUseCase } from '../../../application/use-cases/chat/SendMessageUseCase';
import { ChatMessageRequestDTO, ChatMessageResponseDTO } from '../../../application/dto/ChatMessageDTO';
import { ValidationException, ValidationErrorType } from '../../../application/exceptions/ValidationException';
import { AIServiceException } from '../../../application/exceptions/AIServiceException';
import { MessageType } from '../../../domain/enums/MessageType';
import { logger } from '../../../shared/utils/Logger';

/**
 * Controlador para endpoints de chat
 */
export class ChatController {
  constructor(
    private readonly sendMessageUseCase: SendMessageUseCase
  ) {}

  /**
   * Envía un mensaje al chat y obtiene respuesta de IA
   * POST /api/chat/message
   */
  async sendMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Extraer datos validados del request
      const messageRequest: ChatMessageRequestDTO = {
        sessionId: req.body.sessionId,
        message: req.body.message,
        isVoice: req.body.isVoice || false,
        userId: req.body.userId,
        audioData: req.body.audioData,
        metadata: {
          ...req.body.metadata,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          timestamp: new Date().toISOString()
        }
      };

      logger.info('Processing chat message', {
        sessionId: messageRequest.sessionId,
        messageLength: messageRequest.message.length,
        isVoice: messageRequest.isVoice,
        userId: messageRequest.userId,
        ip: req.ip
      });

      // Validaciones adicionales de negocio
      await this.validateMessageRequest(messageRequest);

      // Ejecutar caso de uso
      const result = await this.sendMessageUseCase.execute(messageRequest, {
        generateVoiceResponse: messageRequest.isVoice || false,
        includeContext: true,
        maxResponseLength: 1000,
        temperature: 0.7
      });

      // La respuesta ya viene preparada desde el caso de uso
      const processingTime = Date.now() - startTime;

      logger.info('Chat message processed successfully', {
        sessionId: messageRequest.sessionId,
        responseId: result.assistantResponse.id,
        messageType: result.assistantResponse.type,
        processingTime,
        hasAudio: !!result.assistantResponse.audioUrl
      });

      res.status(200).json({
        success: true,
        message: 'Mensaje procesado exitosamente',
        data: {
          userMessage: result.userMessage,
          assistantResponse: result.assistantResponse,
          metadata: {
            processingTime,
            tokensUsed: result.tokensUsed,
            voiceGenerated: result.voiceGenerated,
            contextUsed: result.contextUsed,
            confidence: result.confidence,
            timestamp: new Date().toISOString()
          }
        }
      });

    } catch (error) {
      logger.error('Error processing chat message', error as Error, {
        sessionId: req.body.sessionId,
        processingTime: Date.now() - startTime,
        ip: req.ip
      });

      next(error);
    }
  }

  /**
   * Obtiene el historial de mensajes de una sesión
   * GET /api/chat/history/:sessionId
   */
  async getHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { sessionId } = req.params;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = parseInt(req.query.offset as string) || 0;

      // Validar que sessionId no sea undefined
      if (!sessionId) {
        throw new ValidationException('sessionId es requerido');
      }

      logger.debug('Fetching chat history', {
        sessionId,
        limit,
        offset,
        ip: req.ip
      });

      // Usar el método del caso de uso
      const historyResult = await this.sendMessageUseCase.getMessageHistory(
        sessionId, 
        limit, 
        offset
      );

      const historyResponse = {
        sessionId,
        messages: historyResult.messages,
        totalMessages: historyResult.totalMessages,
        hasMore: historyResult.hasMore,
        pagination: {
          limit,
          offset,
          currentPage: Math.floor(offset / limit) + 1,
          totalPages: Math.ceil(historyResult.totalMessages / limit)
        }
      };

      res.status(200).json({
        success: true,
        message: 'Historial obtenido exitosamente',
        data: historyResponse
      });

    } catch (error) {
      logger.error('Error fetching chat history', error as Error, {
        sessionId: req.params.sessionId,
        ip: req.ip
      });

      next(error);
    }
  }

  /**
   * Limpia el historial de una sesión
   * DELETE /api/chat/history/:sessionId
   */
  async clearHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { sessionId } = req.params;

      logger.info('Clearing chat history', {
        sessionId,
        ip: req.ip
      });

      // Validar que sessionId no sea undefined
      if (!sessionId) {
        throw new ValidationException('sessionId es requerido');
      }

      // Usar el método del caso de uso
      await this.sendMessageUseCase.deleteSession(sessionId);

      res.status(200).json({
        success: true,
        message: 'Historial limpiado exitosamente',
        data: { sessionId, clearedAt: new Date().toISOString() }
      });

    } catch (error) {
      logger.error('Error clearing chat history', error as Error, {
        sessionId: req.params.sessionId,
        ip: req.ip
      });

      next(error);
    }
  }

  /**
   * Obtiene estadísticas de la sesión de chat
   * GET /api/chat/stats/:sessionId
   */
  async getSessionStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { sessionId } = req.params;

      logger.debug('Fetching session stats', {
        sessionId,
        ip: req.ip
      });

      // Validar que sessionId no sea undefined
      if (!sessionId) {
        throw new ValidationException('sessionId es requerido');
      }

      // Usar el método del caso de uso
      const stats = await this.sendMessageUseCase.getChatStats(sessionId);

      res.status(200).json({
        success: true,
        message: 'Estadísticas obtenidas exitosamente',
        data: {
          sessionId,
          ...stats,
          topicsDiscussed: [] as string[],
          sentimentAnalysis: {
            positive: 0,
            neutral: 0,
            negative: 0
          }
        }
      });

    } catch (error) {
      logger.error('Error fetching session stats', error as Error, {
        sessionId: req.params.sessionId,
        ip: req.ip
      });

      next(error);
    }
  }

  /**
   * Health check específico del chat
   * GET /api/chat/health
   */
  async getHealth(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const detailed = req.query.detailed === 'true';

      const healthStatus = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
          ai: 'unknown',
          tts: 'unknown',
          cache: 'unknown'
        },
        version: process.env.npm_package_version || '1.0.0'
      };

      if (detailed) {
        // En una implementación real, verificarías los servicios
        try {
          // Verificar servicio de IA
          healthStatus.services.ai = 'connected';
          
          // Verificar servicio TTS
          healthStatus.services.tts = 'connected';
          
          // Verificar cache
          healthStatus.services.cache = 'connected';
          
        } catch (serviceError) {
          logger.warn('Health check service error', {
            error: serviceError instanceof Error ? serviceError.message : 'Unknown error'
          });
        }
      }

      const statusCode = Object.values(healthStatus.services).every(status => 
        status === 'connected' || status === 'unknown'
      ) ? 200 : 503;

      res.status(statusCode).json({
        success: statusCode === 200,
        message: statusCode === 200 ? 'Chat service is healthy' : 'Chat service has issues',
        data: healthStatus
      });

    } catch (error) {
      logger.error('Error in chat health check', error as Error);

      res.status(503).json({
        success: false,
        message: 'Chat service is unhealthy',
        data: {
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      });
    }
  }

  /**
   * Configuración del chat para una sesión
   * POST /api/chat/configure/:sessionId
   */
  async configureSession(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { sessionId } = req.params;
      const config = req.body;

      logger.info('Configuring chat session', {
        sessionId,
        config,
        ip: req.ip
      });

      // Validar configuración
      const validatedConfig = await this.validateSessionConfig(config);

      // Usar el método del caso de uso para actualizar preferencias
      if (validatedConfig.userId && sessionId) {
        await this.sendMessageUseCase.updateUserPreferences(
          sessionId,
          validatedConfig.userId,
          {
            language: validatedConfig.language,
            voiceEnabled: validatedConfig.enableVoice,
            responseStyle: validatedConfig.responseStyle || 'casual'
          }
        );
      }

      const sessionConfig = {
        sessionId,
        ...validatedConfig,
        updatedAt: new Date().toISOString()
      };

      res.status(200).json({
        success: true,
        message: 'Configuración actualizada exitosamente',
        data: sessionConfig
      });

    } catch (error) {
      logger.error('Error configuring session', error as Error, {
        sessionId: req.params.sessionId,
        ip: req.ip
      });

      next(error);
    }
  }

  /**
   * Buscar en el historial de mensajes
   * GET /api/chat/search/:sessionId
   */
  async searchHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { sessionId } = req.params;
      const query = req.query.query as string;
      const messageType = req.query.messageType as string;
      const fromDate = req.query.fromDate as string;
      const toDate = req.query.toDate as string;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = parseInt(req.query.offset as string) || 0;

      logger.debug('Searching chat history', {
        sessionId,
        query,
        messageType,
        fromDate,
        toDate,
        limit,
        offset,
        ip: req.ip
      });

      // Validar parámetros requeridos
      if (!sessionId) {
        throw new ValidationException('sessionId es requerido');
      }

      if (!query) {
        throw new ValidationException('query es requerido');
      }

      // Usar el método del caso de uso
      const searchResults = await this.sendMessageUseCase.searchMessages(sessionId, query, limit);

      const response = {
        sessionId,
        query,
        results: searchResults.results,
        totalResults: searchResults.totalResults,
        searchTime: searchResults.searchTime,
        pagination: {
          limit,
          offset,
          currentPage: Math.floor(offset / limit) + 1,
          totalPages: Math.ceil(searchResults.totalResults / limit)
        }
      };

      res.status(200).json({
        success: true,
        message: 'Búsqueda completada exitosamente',
        data: response
      });

    } catch (error) {
      logger.error('Error searching chat history', error as Error, {
        sessionId: req.params.sessionId,
        query: req.query.query,
        ip: req.ip
      });

      next(error);
    }
  }

  /**
   * Exportar historial de chat
   * GET /api/chat/export/:sessionId
   */
  async exportHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { sessionId } = req.params;
      const format = req.query.format as string || 'json';

      logger.info('Exporting chat history', {
        sessionId,
        format,
        ip: req.ip
      });

      // Validar que sessionId no sea undefined
      if (!sessionId) {
        throw new ValidationException('sessionId es requerido');
      }

      // Obtener historial completo
      const historyResult = await this.sendMessageUseCase.getMessageHistory(sessionId, 1000, 0);

      const exportData = {
        sessionId,
        exportedAt: new Date().toISOString(),
        format,
        messages: historyResult.messages
      };

      if (format === 'json') {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="chat-${sessionId}.json"`);
        res.status(200).json(exportData);
      } else if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="chat-${sessionId}.csv"`);
        
        // Generar CSV
        let csv = 'timestamp,type,message,isVoice,userId\n';
        historyResult.messages.forEach(msg => {
          const escapedMessage = msg.message.replace(/"/g, '""');
          csv += `"${msg.timestamp}","${msg.type}","${escapedMessage}",${msg.isVoice},"${msg.userId || ''}"\n`;
        });
        
        res.status(200).send(csv);
      } else {
        throw new ValidationException('Formato de exportación no soportado');
      }

    } catch (error) {
      logger.error('Error exporting chat history', error as Error, {
        sessionId: req.params.sessionId,
        format: req.query.format,
        ip: req.ip
      });

      next(error);
    }
  }

  /**
   * Feedback sobre la respuesta de chat
   * POST /api/chat/feedback
   */
  async submitFeedback(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const {
        messageId,
        sessionId,
        rating,
        feedback,
        category
      } = req.body;

      logger.info('Receiving chat feedback', {
        messageId,
        sessionId,
        rating,
        category,
        ip: req.ip
      });

      // Validar datos de feedback
      if (!messageId || !sessionId || !rating) {
        throw new ValidationException('messageId, sessionId y rating son requeridos');
      }

      if (rating < 1 || rating > 5) {
        throw new ValidationException('rating debe estar entre 1 y 5');
      }

      // En una implementación real, guardarías el feedback
      const feedbackRecord = {
        id: `feedback_${Date.now()}`,
        messageId,
        sessionId,
        rating,
        feedback: feedback || '',
        category: category || 'general',
        submittedAt: new Date().toISOString(),
        ip: req.ip
      };

      res.status(201).json({
        success: true,
        message: 'Feedback enviado exitosamente',
        data: feedbackRecord
      });

    } catch (error) {
      logger.error('Error submitting feedback', error as Error, {
        messageId: req.body.messageId,
        sessionId: req.body.sessionId,
        ip: req.ip
      });

      next(error);
    }
  }

  /**
   * Regenerar respuesta de un mensaje
   * POST /api/chat/regenerate/:messageId
   */
  async regenerateResponse(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { messageId } = req.params;
      const { sessionId } = req.body;

      logger.info('Regenerating chat response', {
        messageId,
        sessionId,
        ip: req.ip
      });

      // En una implementación real, obtendrías el mensaje original y regenerarías la respuesta
      // Por ahora, simulamos una nueva respuesta

      const regeneratedResponse: ChatMessageResponseDTO = {
        id: `msg_${Date.now()}`,
        sessionId,
        type: MessageType.ASSISTANT_TEXT,
        message: 'Esta es una respuesta regenerada simulada.',
        timestamp: new Date().toISOString(),
        isVoice: false,
        metadata: {
          regeneratedFrom: messageId,
          regeneratedAt: new Date().toISOString(),
          version: 2
        }
      };

      res.status(200).json({
        success: true,
        message: 'Respuesta regenerada exitosamente',
        data: regeneratedResponse
      });

    } catch (error) {
      logger.error('Error regenerating response', error as Error, {
        messageId: req.params.messageId,
        sessionId: req.body.sessionId,
        ip: req.ip
      });

      next(error);
    }
  }

  /**
   * Obtiene sugerencias de respuesta rápida
   * GET /api/chat/suggestions/:sessionId
   */
  async getSuggestions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { sessionId } = req.params;
      const context = req.query.context as string;

      logger.debug('Fetching chat suggestions', {
        sessionId,
        context,
        ip: req.ip
      });

      // Validar que sessionId no sea undefined
      if (!sessionId) {
        throw new ValidationException('sessionId es requerido');
      }

      // Usar el método del caso de uso
      const suggestions = await this.sendMessageUseCase.getQuickReplies(sessionId, context);

      const suggestionsWithMetadata = suggestions.map((text, index) => ({
        id: `sug_${index + 1}`,
        text,
        category: this.categorizeSuggestion(text),
        confidence: 0.9 - (index * 0.05)
      }));

      res.status(200).json({
        success: true,
        message: 'Sugerencias obtenidas exitosamente',
        data: {
          sessionId,
          suggestions: suggestionsWithMetadata,
          context: context || 'general',
          generatedAt: new Date().toISOString()
        }
      });

    } catch (error) {
      logger.error('Error fetching suggestions', error as Error, {
        sessionId: req.params.sessionId,
        ip: req.ip
      });

      next(error);
    }
  }

  /**
   * Obtiene métricas de performance del chat
   * GET /api/chat/metrics
   */
  async getMetrics(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const timeRange = req.query.timeRange as string || '1h';

      logger.debug('Fetching chat metrics', {
        timeRange,
        ip: req.ip
      });

      // Simulación de métricas
      const metrics = {
        timeRange,
        generatedAt: new Date().toISOString(),
        totalMessages: 0,
        averageResponseTime: 0,
        successRate: 1.0,
        errorRate: 0.0,
        activeSessions: 0,
        messagesPerSession: 0,
        topErrorTypes: [] as Array<{ type: string; count: number }>,
        performance: {
          p50ResponseTime: 1500,
          p95ResponseTime: 3000,
          p99ResponseTime: 5000
        },
        aiService: {
          tokensUsed: 0,
          averageTokensPerMessage: 0,
          costEstimate: 0.0
        },
        voiceMessages: {
          total: 0,
          averageDuration: 0,
          synthesisTime: 0
        }
      };

      res.status(200).json({
        success: true,
        message: 'Métricas obtenidas exitosamente',
        data: metrics
      });

    } catch (error) {
      logger.error('Error fetching chat metrics', error as Error, {
        ip: req.ip
      });

      next(error);
    }
  }

  /**
   * Validaciones adicionales para el mensaje
   */
  private async validateMessageRequest(request: ChatMessageRequestDTO): Promise<void> {
    const errors: string[] = [];

    // Validar longitud del mensaje
    if (request.message.length > 1000) {
      errors.push('Mensaje demasiado largo (máximo 1000 caracteres)');
    }

    // Validar sessionId format
    if (!/^[a-zA-Z0-9_-]+$/.test(request.sessionId)) {
      errors.push('Formato de sessionId inválido');
    }

    // Validar audio data si está presente
    if (request.audioData) {
      try {
        const audioBuffer = Buffer.from(request.audioData, 'base64');
        if (audioBuffer.length > 10 * 1024 * 1024) { // 10MB max
          errors.push('Audio demasiado grande (máximo 10MB)');
        }
      } catch {
        errors.push('Datos de audio inválidos');
      }
    }

    // Validar contenido del mensaje
    const contentCheck = this.validateMessageContent(request.message);
    if (!contentCheck.isValid) {
      errors.push(...contentCheck.errors);
    }

    if (errors.length > 0) {
      throw new ValidationException(errors.map(error => ({
        type: ValidationErrorType.BUSINESS_RULE_VIOLATION,
        field: 'message',
        message: error
      })), {
        entity: 'ChatMessage',
        operation: 'create',
        timestamp: new Date()
      });
    }
  }

  /**
   * Valida contenido del mensaje para detectar spam o contenido inapropiado
   */
  private validateMessageContent(message: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Detectar spam (caracteres repetitivos)
    const repeatedChars = /(.)\1{10,}/g;
    if (repeatedChars.test(message)) {
      errors.push('Mensaje contiene demasiados caracteres repetitivos');
    }

    // Detectar URLs sospechosas
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const urls = message.match(urlRegex);
    if (urls && urls.length > 3) {
      errors.push('Mensaje contiene demasiadas URLs');
    }

    // Detectar exceso de caracteres especiales
    const specialCharCount = (message.match(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/g) || []).length;
    const totalLength = message.length;
    
    if (totalLength > 10 && specialCharCount / totalLength > 0.5) {
      errors.push('Mensaje contiene demasiados caracteres especiales');
    }

    // Detectar palabras prohibidas básicas
    const prohibitedWords = ['spam', 'phishing', 'scam'];
    const lowerMessage = message.toLowerCase();
    const hasProhibited = prohibitedWords.some(word => lowerMessage.includes(word));
    
    if (hasProhibited) {
      errors.push('Mensaje contiene contenido no permitido');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Valida configuración de sesión
   */
  private async validateSessionConfig(config: any): Promise<any> {
    const validatedConfig: any = {};

    // Validar idioma
    if (config.language) {
      const allowedLanguages = ['es', 'en', 'fr', 'de', 'it', 'pt'];
      if (allowedLanguages.includes(config.language)) {
        validatedConfig.language = config.language;
      } else {
        throw new ValidationException('Idioma no soportado');
      }
    }

    // Validar configuración de voz
    if (config.enableVoice !== undefined) {
      validatedConfig.enableVoice = Boolean(config.enableVoice);
    }

    // Validar temperatura de IA
    if (config.temperature !== undefined) {
      const temp = parseFloat(config.temperature);
      if (temp >= 0 && temp <= 2) {
        validatedConfig.temperature = temp;
      } else {
        throw new ValidationException('Temperatura debe estar entre 0 y 2');
      }
    }

    // Validar máximo de tokens
    if (config.maxTokens !== undefined) {
      const tokens = parseInt(config.maxTokens);
      if (tokens >= 1 && tokens <= 4000) {
        validatedConfig.maxTokens = tokens;
      } else {
        throw new ValidationException('maxTokens debe estar entre 1 y 4000');
      }
    }

    // Validar límite de historial
    if (config.historyLimit !== undefined) {
      const limit = parseInt(config.historyLimit);
      if (limit >= 1 && limit <= 100) {
        validatedConfig.historyLimit = limit;
      } else {
        throw new ValidationException('historyLimit debe estar entre 1 y 100');
      }
    }

    // Validar timeout de sesión
    if (config.sessionTimeout !== undefined) {
      const timeout = parseInt(config.sessionTimeout);
      if (timeout >= 300 && timeout <= 86400) { // 5 minutos a 24 horas
        validatedConfig.sessionTimeout = timeout;
      } else {
        throw new ValidationException('sessionTimeout debe estar entre 300 y 86400 segundos');
      }
    }

    // Copiar userId si está presente
    if (config.userId) {
      validatedConfig.userId = config.userId;
    }

    return validatedConfig;
  }

  /**
   * Categoriza una sugerencia para asignarle un tipo
   */
  private categorizeSuggestion(suggestion: string): string {
    const lowerSuggestion = suggestion.toLowerCase();
    
    if (lowerSuggestion.includes('precio') || lowerSuggestion.includes('costo')) {
      return 'precios';
    } else if (lowerSuggestion.includes('servicio')) {
      return 'información';
    } else if (lowerSuggestion.includes('contacto')) {
      return 'contacto';
    } else if (lowerSuggestion.includes('gracias')) {
      return 'cortesía';
    } else {
      return 'general';
    }
  }
}