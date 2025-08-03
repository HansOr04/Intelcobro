// src/dependency-injection/Container.ts

import 'reflect-metadata';

// Domain
import { ChatMessage } from '../domain/entities/ChatMessage';
import { WheelResult } from '../domain/entities/WheelResult';
import { FormSubmission } from '../domain/entities/FormSubmission';

// Application - Interfaces
import { IAIService } from '../application/interfaces/services/IAIService';
import { IEmailService } from '../application/interfaces/services/IEmailService';
import { ITextToSpeechService } from '../application/interfaces/services/ITextToSpeechService';

// Application - Use Cases
import { SendMessageUseCase } from '../application/use-cases/chat/SendMessageUseCase';
import { SubmitJobApplicationUseCase } from '../application/use-cases/forms/SubmitJobApplicationUseCase';
import { SubmitDiscountFormUseCase } from '../application/use-cases/forms/SubmitDiscountFormUseCase';
import { SpinWheelUseCase } from '../application/use-cases/wheel/SpinWheelUseCase';

// Infrastructure - External Services
import { OpenAIService } from '../infrastructure/external-services/OpenAIService';
import { ResendService } from '../infrastructure/external-services/ResendService';
import { ElevenLabsService, TTSMemoryCache } from '../infrastructure/external-services/ElevenLabsService';

// Infrastructure - Controllers
import { ChatController } from '../infrastructure/web/controllers/ChatController';
import { FormController } from '../infrastructure/web/controllers/FormController';
import { WheelController } from '../infrastructure/web/controllers/WheelController';

// Shared
import { logger } from '../shared/utils/Logger';

/**
 * Símbolos para identificación de dependencias
 */
export const TYPES = {
  // Services
  AIService: Symbol.for('AIService'),
  EmailService: Symbol.for('EmailService'),
  TextToSpeechService: Symbol.for('TextToSpeechService'),
  TTSCache: Symbol.for('TTSCache'),

  // Use Cases
  SendMessageUseCase: Symbol.for('SendMessageUseCase'),
  SubmitJobApplicationUseCase: Symbol.for('SubmitJobApplicationUseCase'),
  SubmitDiscountFormUseCase: Symbol.for('SubmitDiscountFormUseCase'),
  SpinWheelUseCase: Symbol.for('SpinWheelUseCase'),

  // Controllers
  ChatController: Symbol.for('ChatController'),
  FormController: Symbol.for('FormController'),
  WheelController: Symbol.for('WheelController'),

  // Configuration
  OpenAIConfig: Symbol.for('OpenAIConfig'),
  ResendConfig: Symbol.for('ResendConfig'),
  ElevenLabsConfig: Symbol.for('ElevenLabsConfig')
};

/**
 * Interfaz simple para el contenedor de dependencias
 */
interface IContainer {
  bind(identifier: symbol | string): IBindingContext<any>;
  get<T>(identifier: symbol | string): T;
  getServiceIdentifierArray(): (symbol | string)[];
  isBound(identifier: symbol | string): boolean;
  unbindAll(): void;
}

interface IBindingContext<T> {
  to(constructor: new (...args: any[]) => T): IBindingWhenOnSyntax<T>;
  toConstantValue(value: T): IBindingWhenOnSyntax<T>;
  toDynamicValue(func: (context: any) => T): IBindingWhenOnSyntax<T>;
}

interface IBindingWhenOnSyntax<T> {
  inSingletonScope(): IBindingWhenOnSyntax<T>;
}

/**
 * Implementación simple del contenedor de dependencias
 */
class SimpleContainer implements IContainer {
  private bindings = new Map<symbol | string, any>();
  private instances = new Map<symbol | string, any>();
  private singletons = new Set<symbol | string>();

  bind(identifier: symbol | string): IBindingContext<any> {
    return {
      to: (constructor: new (...args: any[]) => any) => {
        this.bindings.set(identifier, { type: 'constructor', value: constructor });
        return this.createBindingWhenOn(identifier);
      },
      toConstantValue: (value: any) => {
        this.bindings.set(identifier, { type: 'constant', value });
        return this.createBindingWhenOn(identifier);
      },
      toDynamicValue: (func: (context: any) => any) => {
        this.bindings.set(identifier, { type: 'dynamic', value: func });
        return this.createBindingWhenOn(identifier);
      }
    };
  }

  private createBindingWhenOn(identifier: symbol | string): IBindingWhenOnSyntax<any> {
    return {
      inSingletonScope: () => {
        this.singletons.add(identifier);
        return this.createBindingWhenOn(identifier);
      }
    };
  }

  get<T>(identifier: symbol | string): T {
    // Check if singleton instance exists
    if (this.singletons.has(identifier) && this.instances.has(identifier)) {
      return this.instances.get(identifier);
    }

    const binding = this.bindings.get(identifier);
    if (!binding) {
      throw new Error(`No binding found for ${identifier.toString()}`);
    }

    let instance: T;

    switch (binding.type) {
      case 'constant':
        instance = binding.value;
        break;
      case 'constructor':
        instance = new binding.value();
        break;
      case 'dynamic':
        instance = binding.value({ container: this });
        break;
      default:
        throw new Error(`Unknown binding type: ${binding.type}`);
    }

    // Store singleton instance
    if (this.singletons.has(identifier)) {
      this.instances.set(identifier, instance);
    }

    return instance;
  }

  getServiceIdentifierArray(): (symbol | string)[] {
    return Array.from(this.bindings.keys());
  }

  isBound(identifier: symbol | string): boolean {
    return this.bindings.has(identifier);
  }

  unbindAll(): void {
    this.bindings.clear();
    this.instances.clear();
    this.singletons.clear();
  }
}

/**
 * Configuración del contenedor de dependencias
 */
export class DIContainer {
  private static instance: IContainer;
  
  /**
   * Obtiene la instancia singleton del contenedor
   */
  public static getInstance(): IContainer {
    if (!DIContainer.instance) {
      DIContainer.instance = DIContainer.createContainer();
    }
    return DIContainer.instance;
  }

  /**
   * Crea y configura el contenedor de dependencias
   */
  private static createContainer(): IContainer {
    const container = new SimpleContainer();

    logger.info('Initializing Dependency Injection Container');

    try {
      // Configurar servicios
      DIContainer.configureServices(container);
      
      // Configurar casos de uso
      DIContainer.configureUseCases(container);
      
      // Configurar controladores
      DIContainer.configureControllers(container);
      
      // Configurar configuraciones
      DIContainer.configureConfigurations(container);

      logger.info('Dependency Injection Container initialized successfully', {
        bindingsCount: container.getServiceIdentifierArray().length
      });

      return container;
      
    } catch (error) {
      logger.error('Error initializing DI Container', undefined, error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Configura los servicios externos
   */
  private static configureServices(container: IContainer): void {
    logger.debug('Configuring external services');

    // Configuraciones de servicios
    container.bind(TYPES.OpenAIConfig).toConstantValue({
      apiKey: process.env.OPENAI_API_KEY || '',
      defaultModel: process.env.OPENAI_MODEL || 'gpt-4',
      maxRetries: 3,
      timeout: 30000
    });

    container.bind(TYPES.ResendConfig).toConstantValue({
      apiKey: process.env.RESEND_API_KEY || '',
      defaultFromEmail: process.env.RESEND_FROM_EMAIL || 'noreply@intelcobro.com',
      defaultFromName: process.env.RESEND_FROM_NAME || 'Intelcobro',
      timeout: 10000
    });

    container.bind(TYPES.ElevenLabsConfig).toConstantValue({
      apiKey: process.env.ELEVENLABS_API_KEY || '',
      defaultVoiceId: process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM',
      timeout: 30000,
      cacheEnabled: true
    });

    // Cache para TTS
    container.bind(TYPES.TTSCache).to(TTSMemoryCache).inSingletonScope();

    // Servicios
    container.bind(TYPES.AIService).toDynamicValue((context: any) => {
      const config = context.container.get(TYPES.OpenAIConfig);
      return new OpenAIService(config);
    }).inSingletonScope();

    container.bind(TYPES.EmailService).toDynamicValue((context: any) => {
      const config = context.container.get(TYPES.ResendConfig);
      return new ResendService(config);
    }).inSingletonScope();

    container.bind(TYPES.TextToSpeechService).toDynamicValue((context: any) => {
      const config = context.container.get(TYPES.ElevenLabsConfig);
      const cache = context.container.get(TYPES.TTSCache);
      return new ElevenLabsService(config, cache);
    }).inSingletonScope();

    logger.debug('External services configured successfully');
  }

  /**
   * Configura los casos de uso
   */
  private static configureUseCases(container: IContainer): void {
    logger.debug('Configuring use cases');

    // Chat Use Cases
    container.bind(TYPES.SendMessageUseCase).toDynamicValue((context: any) => {
      const aiService = context.container.get(TYPES.AIService);
      const ttsService = context.container.get(TYPES.TextToSpeechService);
      return new SendMessageUseCase(aiService, ttsService);
    }).inSingletonScope();

    // Form Use Cases
    container.bind(TYPES.SubmitJobApplicationUseCase).toDynamicValue((context: any) => {
      const emailService = context.container.get(TYPES.EmailService);
      const aiService = context.container.get(TYPES.AIService);
      return new SubmitJobApplicationUseCase(emailService, aiService);
    }).inSingletonScope();

    container.bind(TYPES.SubmitDiscountFormUseCase).toDynamicValue((context: any) => {
      const emailService = context.container.get(TYPES.EmailService);
      return new SubmitDiscountFormUseCase(emailService);
    }).inSingletonScope();

    // Wheel Use Cases
    container.bind(TYPES.SpinWheelUseCase).toDynamicValue((context: any) => {
      return new SpinWheelUseCase();
    }).inSingletonScope();

    logger.debug('Use cases configured successfully');
  }

  /**
   * Configura los controladores
   */
  private static configureControllers(container: IContainer): void {
    logger.debug('Configuring controllers');

    // Chat Controller
    container.bind(TYPES.ChatController).toDynamicValue((context: any) => {
      const sendMessageUseCase = context.container.get(TYPES.SendMessageUseCase);
      return new ChatController(sendMessageUseCase);
    }).inSingletonScope();

    // Form Controller
    container.bind(TYPES.FormController).toDynamicValue((context: any) => {
      const submitJobApplicationUseCase = context.container.get(TYPES.SubmitJobApplicationUseCase);
      const submitDiscountFormUseCase = context.container.get(TYPES.SubmitDiscountFormUseCase);
      return new FormController(submitJobApplicationUseCase, submitDiscountFormUseCase);
    }).inSingletonScope();

    // Wheel Controller
    container.bind(TYPES.WheelController).toDynamicValue((context: any) => {
      const spinWheelUseCase = context.container.get(TYPES.SpinWheelUseCase);
      return new WheelController(spinWheelUseCase);
    }).inSingletonScope();

    logger.debug('Controllers configured successfully');
  }

  /**
   * Configura las configuraciones adicionales
   */
  private static configureConfigurations(container: IContainer): void {
    logger.debug('Configuring additional configurations');

    // Configuración de la aplicación
    container.bind('AppConfig').toConstantValue({
      port: parseInt(process.env.PORT || '5000'),
      host: process.env.HOST || 'localhost',
      nodeEnv: process.env.NODE_ENV || 'development',
      logLevel: process.env.LOG_LEVEL || 'info',
      corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
      uploadDir: process.env.UPLOAD_DIR || 'uploads',
      maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '5242880'), // 5MB
      apiVersion: process.env.API_VERSION || 'v1'
    });

    // Configuración de base de datos (para futuro uso)
    container.bind('DatabaseConfig').toConstantValue({
      url: process.env.DATABASE_URL || '',
      maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '10'),
      timeout: parseInt(process.env.DB_TIMEOUT || '30000')
    });

    // Configuración de Rate Limiting
    container.bind('RateLimitConfig').toConstantValue({
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutos
      maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
      enabled: process.env.RATE_LIMIT_ENABLED !== 'false'
    });

    logger.debug('Additional configurations configured successfully');
  }

  /**
   * Valida que todas las dependencias requeridas estén configuradas
   */
  public static validateConfiguration(container: IContainer): boolean {
    logger.info('Validating container configuration');

    const requiredBindings = [
      TYPES.AIService,
      TYPES.EmailService,
      TYPES.TextToSpeechService,
      TYPES.SendMessageUseCase,
      TYPES.SubmitJobApplicationUseCase,
      TYPES.SubmitDiscountFormUseCase,
      TYPES.SpinWheelUseCase,
      TYPES.ChatController,
      TYPES.FormController,
      TYPES.WheelController
    ];

    const missingBindings: string[] = [];

    for (const binding of requiredBindings) {
      try {
        container.get(binding);
      } catch (error) {
        missingBindings.push(binding.toString());
      }
    }

    if (missingBindings.length > 0) {
      logger.error('Missing required bindings in DI Container', undefined, new Error(`Missing ${missingBindings.length} required bindings`));
      return false;
    }

    // Validar configuraciones críticas
    const criticalConfigs = [
      { name: 'OPENAI_API_KEY', value: process.env.OPENAI_API_KEY },
      { name: 'RESEND_API_KEY', value: process.env.RESEND_API_KEY }
    ];

    const missingConfigs = criticalConfigs.filter(config => !config.value);

    if (missingConfigs.length > 0) {
      logger.warn('Missing critical configuration values', {
        missingConfigs: missingConfigs.map(c => c.name)
      });
      // No fallar por configuraciones faltantes en desarrollo
      if (process.env.NODE_ENV !== 'development') {
        return false;
      }
    }

    logger.info('Container configuration validation completed successfully', {
      bindingsCount: container.getServiceIdentifierArray().length,
      requiredBindingsCount: requiredBindings.length
    });

    return true;
  }

  /**
   * Obtiene estadísticas del contenedor
   */
  public static getContainerStats(container: IContainer): any {
    const serviceIdentifiers = container.getServiceIdentifierArray();
    
    return {
      totalBindings: serviceIdentifiers.length,
      services: serviceIdentifiers.filter((id: any) => id.toString().includes('Service')).length,
      useCases: serviceIdentifiers.filter((id: any) => id.toString().includes('UseCase')).length,
      controllers: serviceIdentifiers.filter((id: any) => id.toString().includes('Controller')).length,
      configs: serviceIdentifiers.filter((id: any) => id.toString().includes('Config')).length,
      bindings: serviceIdentifiers.map((id: any) => ({
        identifier: id.toString(),
        isBound: container.isBound(id)
      }))
    };
  }

  /**
   * Recarga la configuración del contenedor
   */
  public static reloadContainer(): IContainer {
    logger.info('Reloading DI Container');
    
    if (DIContainer.instance) {
      try {
        DIContainer.instance.unbindAll();
      } catch (error) {
        logger.warn('Error unbinding previous container', { 
          errorMessage: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }
    
    DIContainer.instance = DIContainer.createContainer();
    
    if (!DIContainer.validateConfiguration(DIContainer.instance)) {
      throw new Error('Container validation failed after reload');
    }
    
    logger.info('DI Container reloaded successfully');
    return DIContainer.instance;
  }

  /**
   * Cierra el contenedor y limpia recursos
   */
  public static async closeContainer(): Promise<void> {
    logger.info('Closing DI Container');
    
    if (DIContainer.instance) {
      try {
        // Limpiar servicios que implementen cleanup
        const serviceIdentifiers = DIContainer.instance.getServiceIdentifierArray();
        
        for (const identifier of serviceIdentifiers) {
          try {
            const service = DIContainer.instance.get(identifier);
            
            // Si el servicio tiene un método cleanup, llamarlo
            if (service && typeof (service as any).cleanup === 'function') {
              await (service as any).cleanup();
              logger.debug('Service cleanup completed', { service: identifier.toString() });
            }
          } catch (error) {
            logger.warn('Error during service cleanup', {
              service: identifier.toString(),
              errorMessage: error instanceof Error ? error.message : 'Unknown error'
            });
          }
        }
        
        DIContainer.instance.unbindAll();
        logger.info('DI Container closed successfully');
        
      } catch (error) {
        logger.error('Error closing DI Container', undefined, error instanceof Error ? error : new Error(String(error)));
        throw error;
      }
    }
  }

  /**
   * Registra middleware personalizado en el contenedor
   */
  public static registerMiddleware(container: IContainer, middlewares: Record<string, any>): void {
    Object.entries(middlewares).forEach(([name, middleware]) => {
      const symbol = Symbol.for(`Middleware.${name}`);
      container.bind(symbol).toConstantValue(middleware);
      logger.debug('Middleware registered', { name });
    });
  }

  /**
   * Obtiene servicio con manejo de errores
   */
  public static safeGet<T>(container: IContainer, serviceIdentifier: symbol): T | null {
    try {
      return container.get<T>(serviceIdentifier);
    } catch (error) {
      logger.error('Error getting service from container', undefined, error instanceof Error ? error : new Error(`Failed to get service: ${serviceIdentifier.toString()}`));
      return null;
    }
  }

  /**
   * Verifica si un servicio está disponible
   */
  public static isServiceAvailable(container: IContainer, serviceIdentifier: symbol): boolean {
    try {
      return container.isBound(serviceIdentifier);
    } catch (error) {
      return false;
    }
  }
}

/**
 * Factory para crear el contenedor configurado
 */
export function createConfiguredContainer(): IContainer {
  const container = DIContainer.getInstance();
  
  if (!DIContainer.validateConfiguration(container)) {
    throw new Error('Container configuration validation failed');
  }
  
  return container;
}

/**
 * Helper para obtener controladores del contenedor
 */
export function getControllers(container: IContainer) {
  return {
    chatController: container.get(TYPES.ChatController) as ChatController,
    formController: container.get(TYPES.FormController) as FormController,
    wheelController: container.get(TYPES.WheelController) as WheelController
  };
}

/**
 * Helper para obtener servicios del contenedor
 */
export function getServices(container: IContainer) {
  return {
    aiService: container.get(TYPES.AIService) as IAIService,
    emailService: container.get(TYPES.EmailService) as IEmailService,
    ttsService: container.get(TYPES.TextToSpeechService) as ITextToSpeechService
  };
}

/**
 * Helper para obtener configuraciones del contenedor
 */
export function getConfigurations(container: IContainer) {
  return {
    appConfig: container.get('AppConfig'),
    databaseConfig: container.get('DatabaseConfig'),
    rateLimitConfig: container.get('RateLimitConfig')
  };
}