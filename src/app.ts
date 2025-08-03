// src/app.ts

import 'reflect-metadata';
import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from 'dotenv';
import path from 'path';

// Configuraciones
import { getCorsConfig, corsLogger, securityHeaders } from './infrastructure/config/cors';

// Contenedor DI
import { createConfiguredContainer, getControllers, getConfigurations, DIContainer } from './dependency-injection/Container';

// Rutas
import { createAdvancedChatRoutes } from './infrastructure/web/routes/chatRoutes';
import { createAdvancedFormRoutes } from './infrastructure/web/routes/formRoutes';
import { createAdvancedWheelRoutes } from './infrastructure/web/routes/wheelRoutes';

// Middlewares
import { ErrorHandlerMiddleware } from './infrastructure/web/middlewares/ErrorHandlerMiddleware';
import { FileUploadMiddleware } from './infrastructure/web/middlewares/FileUploadMiddleware';

// Shared
import { logger } from './shared/utils/Logger';

// Tipos extendidos para Express
interface ExtendedRequest extends Request {
  id?: string;
  ip: string;
}

/**
 * Clase principal de la aplicación
 */
class IntelcobroApp {
  private app: Application;
  private container: any;
  private server: any;

  constructor() {
    // Cargar variables de entorno
    this.loadEnvironmentVariables();
    
    // Inicializar aplicación Express
    this.app = express();
    
    // Inicializar contenedor DI
    this.initializeDependencyInjection();
    
    // Configurar aplicación
    this.configureApplication();
  }

  /**
   * Carga variables de entorno
   */
  private loadEnvironmentVariables(): void {
    const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : 
                   process.env.NODE_ENV === 'staging' ? '.env.staging' : '.env';
    
    config({ path: envFile });
    
    // Validar variables críticas
    const requiredEnvVars = ['NODE_ENV'];
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      logger.warn('Missing environment variables', { missingVars });
    }

    logger.info('Environment variables loaded', {
      nodeEnv: process.env.NODE_ENV,
      port: process.env.PORT,
      logLevel: process.env.LOG_LEVEL
    });
  }

  /**
   * Inicializa el contenedor de dependencias
   */
  private initializeDependencyInjection(): void {
    try {
      this.container = createConfiguredContainer();
      logger.info('Dependency injection container initialized');
    } catch (error) {
      logger.error('Failed to initialize DI container', undefined, error instanceof Error ? error : new Error(String(error)));
      process.exit(1);
    }
  }

  /**
   * Configura la aplicación Express
   */
  private configureApplication(): void {
    logger.info('Configuring Express application');

    // Configurar confianza en proxies
    this.configureTrust();
    
    // Configurar middlewares de seguridad
    this.configureSecurityMiddlewares();
    
    // Configurar middlewares generales
    this.configureGeneralMiddlewares();
    
    // Configurar rutas
    this.configureRoutes();
    
    // Configurar manejo de errores
    this.configureErrorHandling();

    logger.info('Express application configured successfully');
  }

  /**
   * Configura confianza en proxies
   */
  private configureTrust(): void {
    // Confiar en proxies (para headers X-Forwarded-*)
    this.app.set('trust proxy', process.env.TRUST_PROXY === 'true' || process.env.NODE_ENV === 'production');
    
    // Configurar view engine para templates (si se necesita)
    this.app.set('view engine', 'html');
    this.app.set('views', path.join(__dirname, '../views'));
  }

  /**
   * Configura middlewares de seguridad
   */
  private configureSecurityMiddlewares(): void {
    logger.debug('Configuring security middlewares');

    // Helmet para headers de seguridad
    const helmetOptions: any = {
      crossOriginEmbedderPolicy: false // Para desarrollo
    };
    
    if (process.env.NODE_ENV !== 'production') {
      helmetOptions.contentSecurityPolicy = false;
    }
    
    this.app.use(helmet(helmetOptions));

    // Headers de seguridad adicionales
    this.app.use(securityHeaders());

    // CORS
    this.app.use(corsLogger());
    this.app.use(cors(getCorsConfig()));

    // Rate limiting general - implementación básica
    if (process.env.RATE_LIMIT_ENABLED !== 'false') {
      this.app.use(this.createBasicRateLimit());
    }

    logger.debug('Security middlewares configured');
  }

  /**
   * Crea un rate limiter básico
   */
  private createBasicRateLimit() {
    const requests = new Map<string, { count: number; resetTime: number }>();
    const windowMs = 15 * 60 * 1000; // 15 minutos
    const maxRequests = 100;

    return (req: Request, res: Response, next: NextFunction) => {
      const clientId = req.ip || 'unknown';
      const now = Date.now();
      
      const clientData = requests.get(clientId);
      
      if (!clientData || now > clientData.resetTime) {
        requests.set(clientId, { count: 1, resetTime: now + windowMs });
        return next();
      }
      
      if (clientData.count >= maxRequests) {
        return res.status(429).json({
          success: false,
          message: 'Too many requests',
          retryAfter: Math.ceil((clientData.resetTime - now) / 1000)
        });
      }
      
      clientData.count++;
      next();
    };
  }

  /**
   * Configura middlewares generales
   */
  private configureGeneralMiddlewares(): void {
    logger.debug('Configuring general middlewares');

    // Compresión de respuestas básica
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      if (req.headers['accept-encoding']?.includes('gzip')) {
        res.setHeader('Content-Encoding', 'gzip');
      }
      next();
    });

    // Logging de requests
    const morganFormat = process.env.NODE_ENV === 'production' 
      ? 'combined' 
      : 'dev';
      
    this.app.use(morgan(morganFormat, {
      stream: {
        write: (message: string) => {
          logger.info(message.trim(), { source: 'morgan' });
        }
      },
      skip: (req, res) => {
        // Skip health checks en logs
        return req.path === '/health' && res.statusCode < 400;
      }
    }));

    // Parsing de JSON y URL encoded
    this.app.use(express.json({ 
      limit: process.env.JSON_LIMIT || '10mb',
      verify: (req, res, buf) => {
        // Verificar que el JSON no esté corrupto
        try {
          JSON.parse(buf.toString());
        } catch (error) {
          logger.warn('Invalid JSON received', {
            ip: (req as any).ip || 'unknown',
            path: req.url,
            contentLength: buf.length
          });
          throw new Error('Invalid JSON');
        }
      }
    }));

    this.app.use(express.urlencoded({ 
      extended: true, 
      limit: process.env.URL_ENCODED_LIMIT || '10mb' 
    }));

    // Middleware para agregar request ID
    this.app.use((req: Request, res, next) => {
      (req as any).id = req.headers['x-request-id'] as string || 
               `req_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      res.setHeader('X-Request-ID', (req as any).id);
      next();
    });

    // Middleware para timeout de requests
    this.app.use(ErrorHandlerMiddleware.timeout(30000)); // 30 segundos

    // Inicializar directorios de upload
    FileUploadMiddleware.initializeDirectories();

    logger.debug('General middlewares configured');
  }

  /**
   * Configura las rutas de la aplicación
   */
  private configureRoutes(): void {
    logger.debug('Configuring application routes');

    const controllers = getControllers(this.container);
    const config = getConfigurations(this.container);

    // Health check general
    this.app.get('/health', this.createHealthCheckHandler());

    // Información de la API
    this.app.get('/', this.createApiInfoHandler());

    // Rutas de la API v1
    const apiRouter = express.Router();

    // Chat routes
    apiRouter.use('/chat', createAdvancedChatRoutes(controllers.chatController));

    // Form routes  
    apiRouter.use('/forms', createAdvancedFormRoutes(controllers.formController));

    // Wheel routes
    apiRouter.use('/wheel', createAdvancedWheelRoutes(controllers.wheelController));

    // Montar rutas API
    this.app.use(`/api/${(config.appConfig as any).apiVersion}`, apiRouter);
    this.app.use('/api', apiRouter); // Alias sin versión

    // Servir archivos estáticos
    this.configureStaticFiles();

    // Manejo de rutas no encontradas
    this.app.use(ErrorHandlerMiddleware.notFound());

    logger.debug('Application routes configured');
  }

  /**
   * Configura servicio de archivos estáticos
   */
  private configureStaticFiles(): void {
    const uploadsPath = process.env.UPLOAD_DIR || 'uploads';
    
    // Servir archivos de upload con autenticación básica
    this.app.use('/uploads', (req: Request, res, next) => {
      // En producción, aquí verificarías autenticación
      // Por ahora, solo logging
      logger.debug('Static file access', {
        path: req.path,
        ip: req.ip || 'unknown',
        userAgent: req.get('User-Agent')
      });
      next();
    }, express.static(uploadsPath, {
      maxAge: process.env.NODE_ENV === 'production' ? '1d' : '0',
      dotfiles: 'deny',
      index: false
    }));

    // Servir documentación (si existe)
    const docsPath = path.join(__dirname, '../docs');
    this.app.use('/docs', express.static(docsPath, {
      maxAge: '1h',
      index: 'index.html'
    }));
  }

  /**
   * Configura manejo de errores
   */
  private configureErrorHandling(): void {
    logger.debug('Configuring error handling');

    // Middleware de desarrollo para errores detallados
    if (process.env.NODE_ENV === 'development') {
      this.app.use(ErrorHandlerMiddleware.developmentErrorHandler());
    }

    // Middleware principal de manejo de errores
    this.app.use(ErrorHandlerMiddleware.handle());

    // Configurar manejadores de errores no capturados
    ErrorHandlerMiddleware.catchUnhandled();

    logger.debug('Error handling configured');
  }

  /**
   * Crea handler para health check
   */
  private createHealthCheckHandler() {
    return async (req: Request, res: Response) => {
      const startTime = Date.now();
      
      try {
        const detailed = req.query.detailed === 'true';
        const config = getConfigurations(this.container);
        
        const healthData: any = {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          version: process.env.npm_package_version || '1.0.0',
          environment: process.env.NODE_ENV || 'development',
          node: process.version,
          memory: process.memoryUsage(),
          pid: process.pid
        };

        if (detailed) {
          // Verificar servicios
          const containerStats = DIContainer.getContainerStats(this.container);
          
          healthData.services = {
            dependencyInjection: 'operational',
            totalBindings: containerStats.totalBindings
          };

          healthData.configuration = {
            port: (config.appConfig as any).port,
            apiVersion: (config.appConfig as any).apiVersion,
            corsOrigin: (config.appConfig as any).corsOrigin,
            rateLimitEnabled: process.env.RATE_LIMIT_ENABLED !== 'false'
          };

          healthData.performance = {
            responseTime: Date.now() - startTime,
            cpuUsage: process.cpuUsage(),
            loadavg: require('os').loadavg()
          };
        }

        res.status(200).json({
          success: true,
          message: 'Service is healthy',
          data: healthData
        });

      } catch (error) {
        logger.error('Health check failed', undefined, error instanceof Error ? error : new Error(String(error)));

        res.status(503).json({
          success: false,
          message: 'Service is unhealthy',
          data: {
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            errorMessage: error instanceof Error ? error.message : 'Unknown error'
          }
        });
      }
    };
  }

  /**
   * Crea handler para información de la API
   */
  private createApiInfoHandler() {
    return (req: Request, res: Response) => {
      const config = getConfigurations(this.container);
      
      res.json({
        name: 'Intelcobro Backend API',
        version: process.env.npm_package_version || '1.0.0',
        description: 'Backend API para sistema de chat inteligente con ruleta de descuentos',
        environment: process.env.NODE_ENV || 'development',
        apiVersion: (config.appConfig as any).apiVersion,
        endpoints: {
          health: '/health',
          chat: `/api/${(config.appConfig as any).apiVersion}/chat`,
          forms: `/api/${(config.appConfig as any).apiVersion}/forms`,
          wheel: `/api/${(config.appConfig as any).apiVersion}/wheel`,
          docs: '/docs'
        },
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
      });
    };
  }

  /**
   * Inicia el servidor
   */
  public async start(): Promise<void> {
    const config = getConfigurations(this.container);
    const port = (config.appConfig as any).port;
    const host = (config.appConfig as any).host;

    try {
      // Validar configuración antes de iniciar
      await this.validateConfiguration();

      // Iniciar servidor
      this.server = this.app.listen(port, host, () => {
        logger.info('Server started successfully', {
          port,
          host,
          environment: process.env.NODE_ENV,
          pid: process.pid,
          version: process.env.npm_package_version || '1.0.0'
        });

        // Log de rutas disponibles
        this.logAvailableRoutes();
      });

      // Configurar graceful shutdown
      this.configureGracefulShutdown();

      // Log de métricas iniciales
      this.logStartupMetrics();

    } catch (error) {
      logger.error('Failed to start server', undefined, error instanceof Error ? error : new Error(String(error)));
      process.exit(1);
    }
  }

  /**
   * Valida la configuración antes de iniciar
   */
  private async validateConfiguration(): Promise<void> {
    logger.info('Validating application configuration');

    // Verificar puerto disponible
    const config = getConfigurations(this.container);
    const port = (config.appConfig as any).port;
    
    if (port < 1 || port > 65535) {
      throw new Error(`Invalid port number: ${port}`);
    }

    // Verificar servicios críticos
    try {
      const containerStats = DIContainer.getContainerStats(this.container);
      if (containerStats.totalBindings === 0) {
        throw new Error('No services bound in DI container');
      }
    } catch (error) {
      throw new Error('DI container validation failed');
    }

    // Verificar directorios necesarios
    const uploadsDir = process.env.UPLOAD_DIR || 'uploads';
    try {
      await require('fs').promises.access(uploadsDir);
    } catch (error) {
      logger.warn('Uploads directory not accessible, will be created on first use');
    }

    logger.info('Application configuration validated successfully');
  }

  /**
   * Configura graceful shutdown
   */
  private configureGracefulShutdown(): void {
    const gracefulShutdown = async (signal: string) => {
      logger.info('Graceful shutdown initiated', { signal });

      // Cerrar servidor HTTP
      if (this.server) {
        this.server.close(async () => {
          logger.info('HTTP server closed');

          try {
            // Cerrar contenedor DI
            await DIContainer.closeContainer();
            
            logger.info('Graceful shutdown completed');
            process.exit(0);
          } catch (error) {
            logger.error('Error during graceful shutdown', undefined, error instanceof Error ? error : new Error(String(error)));
            process.exit(1);
          }
        });

        // Forzar cierre después de timeout
        setTimeout(() => {
          logger.error('Graceful shutdown timeout, forcing exit');
          process.exit(1);
        }, 10000); // 10 segundos
      } else {
        process.exit(0);
      }
    };

    // Escuchar señales de terminación
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Manejar errores no capturados
    process.on('uncaughtException', (error) => {
      const errorObj = new Error(error.message);
      errorObj.name = error.name;
      errorObj.stack = error.stack || '';
      logger.error('Uncaught exception', undefined, errorObj);
      gracefulShutdown('UNCAUGHT_EXCEPTION');
    });

    process.on('unhandledRejection', (reason, promise) => {
      const rejectionError = new Error(`Unhandled promise rejection: ${reason instanceof Error ? reason.message : String(reason)}`);
      rejectionError.name = 'UnhandledPromiseRejection';
      logger.error('Unhandled promise rejection', undefined, rejectionError);
      gracefulShutdown('UNHANDLED_REJECTION');
    });
  }

  /**
   * Log de rutas disponibles
   */
  private logAvailableRoutes(): void {
    const config = getConfigurations(this.container);
    const baseUrl = `http://${(config.appConfig as any).host}:${(config.appConfig as any).port}`;
    
    logger.info('Available endpoints', {
      health: `${baseUrl}/health`,
      api: `${baseUrl}/api/${(config.appConfig as any).apiVersion}`,
      chat: `${baseUrl}/api/${(config.appConfig as any).apiVersion}/chat`,
      forms: `${baseUrl}/api/${(config.appConfig as any).apiVersion}/forms`,
      wheel: `${baseUrl}/api/${(config.appConfig as any).apiVersion}/wheel`,
      docs: `${baseUrl}/docs`
    });
  }

  /**
   * Log de métricas iniciales
   */
  private logStartupMetrics(): void {
    const memUsage = process.memoryUsage();
    const containerStats = DIContainer.getContainerStats(this.container);
    
    logger.info('Startup metrics', {
      memory: {
        rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
        heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`
      },
      dependencyInjection: {
        totalBindings: containerStats.totalBindings,
        services: containerStats.services,
        useCases: containerStats.useCases,
        controllers: containerStats.controllers
      },
      process: {
        pid: process.pid,
        version: process.version,
        platform: process.platform,
        arch: process.arch
      }
    });
  }

  /**
   * Detiene el servidor
   */
  public async stop(): Promise<void> {
    if (this.server) {
      logger.info('Stopping server');
      
      return new Promise((resolve, reject) => {
        this.server.close(async (err: any) => {
          if (err) {
            logger.error('Error stopping server', undefined, err instanceof Error ? err : new Error(String(err)));
            reject(err);
          } else {
            try {
              await DIContainer.closeContainer();
              logger.info('Server stopped successfully');
              resolve();
            } catch (cleanupError) {
              logger.error('Error during cleanup', undefined, cleanupError instanceof Error ? cleanupError : new Error(String(cleanupError)));
              reject(cleanupError);
            }
          }
        });
      });
    }
  }

  /**
   * Obtiene la instancia de Express
   */
  public getApp(): Application {
    return this.app;
  }

  /**
   * Obtiene el contenedor DI
   */
  public getContainer(): any {
    return this.container;
  }
}

/**
 * Función principal para iniciar la aplicación
 */
async function main(): Promise<void> {
  try {
    logger.info('Starting Intelcobro Backend Application');
    
    const app = new IntelcobroApp();
    await app.start();
    
  } catch (error) {
    logger.error('Failed to start application', undefined, error instanceof Error ? error : new Error(String(error)));
    process.exit(1);
  }
}

// Iniciar aplicación si es el archivo principal
if (require.main === module) {
  main();
}

export { IntelcobroApp };