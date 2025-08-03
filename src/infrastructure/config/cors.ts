// src/infrastructure/config/cors.ts

import { CorsOptions } from 'cors';
import { logger } from '../../shared/utils/Logger';

/**
 * Configuración de CORS para diferentes entornos
 */
interface CorsEnvironmentConfig {
  development: CorsOptions;
  staging: CorsOptions;
  production: CorsOptions;
}

/**
 * Orígenes permitidos por entorno
 */
const allowedOrigins: Record<string, string[]> = {
  development: [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
    'http://localhost:8080',
    'http://localhost:8081'
  ],
  staging: [
    'https://staging.intelcobro.com',
    'https://staging-admin.intelcobro.com',
    'https://preview.intelcobro.com'
  ],
  production: [
    'https://intelcobro.com',
    'https://www.intelcobro.com',
    'https://admin.intelcobro.com',
    'https://app.intelcobro.com'
  ]
};

/**
 * Configuración base de CORS
 */
const baseCorsConfig: CorsOptions = {
  credentials: true,
  optionsSuccessStatus: 200, // Para IE11
  maxAge: 86400, // 24 horas para preflight cache
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'X-API-Key',
    'X-Session-ID',
    'X-Request-ID',
    'X-Forwarded-For',
    'User-Agent',
    'Cache-Control'
  ],
  exposedHeaders: [
    'X-Total-Count',
    'X-Rate-Limit-Limit',
    'X-Rate-Limit-Remaining',
    'X-Rate-Limit-Reset',
    'X-Request-ID',
    'Content-Disposition'
  ]
};

/**
 * Configuración específica por entorno
 */
const corsEnvironmentConfig: CorsEnvironmentConfig = {
  development: {
    ...baseCorsConfig,
    origin: (origin, callback) => {
      // En desarrollo, permitir requests sin origin (Postman, etc.)
      if (!origin) {
        return callback(null, true);
      }

      const allowed = allowedOrigins.development;
      if (allowed && allowed.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        logger.warn('CORS blocked origin in development');
        callback(null, true); // En desarrollo, ser permisivo
      }
    },
    // Headers adicionales para desarrollo
    allowedHeaders: [
      ...baseCorsConfig.allowedHeaders!,
      'X-Debug-Mode',
      'X-Test-User'
    ]
  },

  staging: {
    ...baseCorsConfig,
    origin: (origin, callback) => {
      if (!origin) {
        // En staging, bloquear requests sin origin por seguridad
        logger.warn('CORS blocked request without origin in staging');
        return callback(new Error('Not allowed by CORS - No origin'), false);
      }

      const allowed = allowedOrigins.staging;
      if (allowed && allowed.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        logger.warn('CORS blocked origin in staging');
        callback(new Error('Not allowed by CORS'), false);
      }
    },
    // Headers adicionales para staging
    allowedHeaders: [
      ...baseCorsConfig.allowedHeaders!,
      'X-Staging-Key'
    ]
  },

  production: {
    ...baseCorsConfig,
    origin: (origin, callback) => {
      if (!origin) {
        // En producción, bloquear requests sin origin
        logger.warn('CORS blocked request without origin in production');
        return callback(new Error('Not allowed by CORS - No origin'), false);
      }

      const allowed = allowedOrigins.production;
      if (allowed && allowed.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        logger.error('CORS blocked unauthorized origin in production');
        const corsError = new Error(`Not allowed by CORS - Origin: ${origin}`);
        corsError.name = 'CORSError';
        callback(corsError, false);
      }
    },
    // Configuración más estricta para producción
    maxAge: 3600, // 1 hora en producción
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] // Sin OPTIONS explícito
  }
};

/**
 * Obtiene la configuración CORS para el entorno actual
 */
export function getCorsConfig(): CorsOptions {
  const env = process.env.NODE_ENV || 'development';
  const config = corsEnvironmentConfig[env as keyof CorsEnvironmentConfig] || corsEnvironmentConfig.development;

  // Agregar orígenes adicionales desde variables de entorno
  const additionalOrigins = process.env.CORS_ADDITIONAL_ORIGINS?.split(',').map(origin => origin.trim()) || [];
  
  if (additionalOrigins.length > 0) {
    const originalOriginHandler = config.origin as Function;
    
    config.origin = (origin, callback) => {
      if (!origin) {
        return originalOriginHandler(origin, callback);
      }

      // Verificar orígenes adicionales primero
      if (additionalOrigins.includes(origin)) {
        logger.info('CORS allowed additional origin');
        return callback(null, true);
      }

      // Usar el handler original
      return originalOriginHandler(origin, callback);
    };
  }

  logger.info('CORS configuration loaded', {
    environment: env,
    credentialsEnabled: config.credentials,
    maxAge: config.maxAge,
    methodsCount: Array.isArray(config.methods) ? config.methods.length : 0,
    headersCount: Array.isArray(config.allowedHeaders) ? config.allowedHeaders.length : 0
  });

  return config;
}

/**
 * Configuración CORS específica para webhooks
 */
export const webhookCorsConfig: CorsOptions = {
  origin: false, // Webhooks no necesitan CORS
  credentials: false,
  methods: ['POST'],
  allowedHeaders: [
    'Content-Type',
    'X-Webhook-Signature',
    'X-Hub-Signature',
    'User-Agent'
  ]
};

/**
 * Configuración CORS específica para APIs públicas
 */
export const publicApiCorsConfig: CorsOptions = {
  origin: '*', // APIs públicas permiten cualquier origen
  credentials: false,
  methods: ['GET'],
  allowedHeaders: [
    'Content-Type',
    'X-API-Key',
    'User-Agent'
  ],
  maxAge: 86400 // 24 horas
};

/**
 * Configuración CORS específica para archivos estáticos
 */
export const staticFilesCorsConfig: CorsOptions = {
  origin: '*',
  credentials: false,
  methods: ['GET', 'HEAD'],
  allowedHeaders: [
    'Range',
    'Content-Type',
    'Cache-Control'
  ],
  exposedHeaders: [
    'Content-Length',
    'Content-Range',
    'Accept-Ranges'
  ],
  maxAge: 2592000 // 30 días
};

/**
 * Middleware para logging de requests CORS
 */
export function corsLogger() {
  return (req: any, res: any, next: any) => {
    const origin = req.get('Origin');
    const method = req.method;
    
    if (method === 'OPTIONS') {
      logger.debug('CORS preflight request');
    } else if (origin) {
      logger.debug('CORS request');
    }

    next();
  };
}

/**
 * Middleware para agregar headers de seguridad adicionales
 */
export function securityHeaders() {
  return (req: any, res: any, next: any) => {
    // Prevenir embedding en iframes (clickjacking)
    res.set('X-Frame-Options', 'DENY');
    
    // Prevenir MIME type sniffing
    res.set('X-Content-Type-Options', 'nosniff');
    
    // Habilitar XSS protection
    res.set('X-XSS-Protection', '1; mode=block');
    
    // Referrer policy
    res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // Content Security Policy básico
    if (process.env.NODE_ENV === 'production') {
      res.set('Content-Security-Policy', 
        "default-src 'self'; " +
        "script-src 'self' 'unsafe-inline'; " +
        "style-src 'self' 'unsafe-inline'; " +
        "img-src 'self' data: https:; " +
        "font-src 'self' https:; " +
        "connect-src 'self' https:; " +
        "frame-ancestors 'none';"
      );
    }

    next();
  };
}

/**
 * Configuración de CORS dinámico basado en subdominios
 */
export function createSubdomainCorsConfig(baseDomain: string): CorsOptions {
  return {
    ...baseCorsConfig,
    origin: (origin, callback) => {
      if (!origin) {
        return callback(new Error('Not allowed by CORS - No origin'), false);
      }

      try {
        const url = new URL(origin);
        const hostname = url.hostname;

        // Permitir el dominio base y todos sus subdominios
        if (hostname === baseDomain || hostname.endsWith(`.${baseDomain}`)) {
          callback(null, true);
        } else {
          logger.warn('CORS blocked subdomain origin');
          callback(new Error('Not allowed by CORS'), false);
        }
      } catch (error) {
        logger.error('CORS origin parsing error', undefined, error instanceof Error ? error : new Error(`Invalid origin: ${origin}`));
        callback(new Error('Invalid origin'), false);
      }
    }
  };
}

/**
 * Configuración de CORS para desarrollo local con auto-detección
 */
export function createDevelopmentCorsConfig(): CorsOptions {
  return {
    ...baseCorsConfig,
    origin: (origin, callback) => {
      if (!origin) {
        return callback(null, true);
      }

      try {
        const url = new URL(origin);
        
        // Permitir localhost y 127.0.0.1 en cualquier puerto
        if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
          callback(null, true);
        } else {
          // Verificar en la lista de orígenes permitidos
          const allowed = allowedOrigins.development;
          if (allowed && allowed.indexOf(origin) !== -1) {
            callback(null, true);
          } else {
            logger.warn('CORS blocked development origin');
            callback(null, true); // En desarrollo, ser permisivo
          }
        }
      } catch (error) {
        callback(null, true); // En desarrollo, permitir incluso orígenes malformados
      }
    }
  };
}

/**
 * Validador de configuración CORS
 */
export function validateCorsConfig(config: CorsOptions): boolean {
  try {
    // Validar métodos
    if (config.methods && Array.isArray(config.methods)) {
      const validMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'];
      const invalidMethods = config.methods.filter(method => !validMethods.includes(method));
      
      if (invalidMethods.length > 0) {
        logger.error('Invalid CORS methods', undefined, new Error(`Invalid methods: ${invalidMethods.join(', ')}`));
        return false;
      }
    }

    // Validar maxAge
    if (config.maxAge && (config.maxAge < 0 || config.maxAge > 86400)) {
      logger.warn('CORS maxAge outside recommended range');
    }

    // Validar headers
    if (config.allowedHeaders && Array.isArray(config.allowedHeaders)) {
      const suspiciousHeaders = config.allowedHeaders.filter(header => 
        header.toLowerCase().includes('password') || 
        header.toLowerCase().includes('secret')
      );
      
      if (suspiciousHeaders.length > 0) {
        logger.warn('Suspicious CORS headers detected');
      }
    }

    return true;
  } catch (error) {
    logger.error('CORS configuration validation error', undefined, error instanceof Error ? error : new Error('CORS validation failed'));
    return false;
  }
}