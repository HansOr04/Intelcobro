"use strict";
// src/shared/utils/Logger.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = exports.Logger = exports.LogLevel = void 0;
exports.createLogger = createLogger;
/**
 * Niveles de log disponibles
 */
var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["ERROR"] = 0] = "ERROR";
    LogLevel[LogLevel["WARN"] = 1] = "WARN";
    LogLevel[LogLevel["INFO"] = 2] = "INFO";
    LogLevel[LogLevel["DEBUG"] = 3] = "DEBUG";
})(LogLevel || (exports.LogLevel = LogLevel = {}));
/**
 * Colores para los diferentes niveles de log en consola
 */
const LOG_COLORS = {
    [LogLevel.ERROR]: '\x1b[31m', // Rojo
    [LogLevel.WARN]: '\x1b[33m', // Amarillo
    [LogLevel.INFO]: '\x1b[36m', // Cian
    [LogLevel.DEBUG]: '\x1b[37m' // Blanco
};
const RESET_COLOR = '\x1b[0m';
/**
 * Clase Logger para manejo centralizado de logs
 */
class Logger {
    constructor() {
        this.context = {};
        // Obtener nivel de log desde variables de entorno
        const envLevel = process.env.LOG_LEVEL?.toUpperCase();
        this.currentLevel = this.parseLogLevel(envLevel) ?? LogLevel.INFO;
    }
    /**
     * Obtiene la instancia singleton del logger
     */
    static getInstance() {
        if (!Logger.instance) {
            Logger.instance = new Logger();
        }
        return Logger.instance;
    }
    /**
     * Parsea el nivel de log desde string
     */
    parseLogLevel(level) {
        switch (level) {
            case 'ERROR': return LogLevel.ERROR;
            case 'WARN': return LogLevel.WARN;
            case 'INFO': return LogLevel.INFO;
            case 'DEBUG': return LogLevel.DEBUG;
            default: return undefined;
        }
    }
    /**
     * Establece el contexto global para todos los logs
     */
    setContext(context) {
        this.context = { ...this.context, ...context };
    }
    /**
     * Limpia el contexto global
     */
    clearContext() {
        this.context = {};
    }
    /**
     * Establece el nivel mínimo de log
     */
    setLevel(level) {
        this.currentLevel = level;
    }
    /**
     * Obtiene el nivel actual de log
     */
    getLevel() {
        return this.currentLevel;
    }
    /**
     * Verifica si un nivel de log debe ser procesado
     */
    shouldLog(level) {
        return level <= this.currentLevel;
    }
    /**
     * Crea una entrada de log
     */
    createLogEntry(level, message, context, error) {
        const entry = {
            timestamp: new Date().toISOString(),
            level,
            message,
            context: { ...this.context, ...context }
        };
        if (error) {
            entry.error = error;
        }
        if (this.context.requestId) {
            entry.requestId = this.context.requestId;
        }
        if (this.context.userId) {
            entry.userId = this.context.userId;
        }
        return entry;
    }
    /**
     * Formatea la entrada de log para consola
     */
    formatConsoleMessage(entry) {
        const levelName = LogLevel[entry.level];
        const color = LOG_COLORS[entry.level];
        const timestamp = entry.timestamp;
        let formatted = `${color}[${timestamp}] ${levelName}${RESET_COLOR}: ${entry.message}`;
        if (entry.requestId) {
            formatted += ` [ReqID: ${entry.requestId}]`;
        }
        if (entry.userId) {
            formatted += ` [UserID: ${entry.userId}]`;
        }
        if (entry.context && Object.keys(entry.context).length > 0) {
            formatted += `\n  Context: ${JSON.stringify(entry.context, null, 2)}`;
        }
        if (entry.error) {
            formatted += `\n  Error: ${entry.error.message}`;
            if (entry.error.stack) {
                formatted += `\n  Stack: ${entry.error.stack}`;
            }
        }
        return formatted;
    }
    /**
     * Método genérico para hacer log
     */
    log(level, message, context, error) {
        if (!this.shouldLog(level)) {
            return;
        }
        const entry = this.createLogEntry(level, message, context, error);
        // Output a consola
        console.log(this.formatConsoleMessage(entry));
        // En producción, aquí se podría enviar a un servicio de logging externo
        // como CloudWatch, Loggly, etc.
        if (process.env.NODE_ENV === 'production') {
            this.sendToExternalService(entry);
        }
    }
    /**
     * Envía logs a servicio externo (implementación placeholder)
     */
    sendToExternalService(entry) {
        // Implementar envío a servicio de logging externo
        // Por ejemplo: AWS CloudWatch, Datadog, Loggly, etc.
        // Placeholder: en una implementación real, esto enviaría el log
        // a un servicio externo de manera asíncrona
    }
    /**
     * Log de nivel ERROR
     */
    error(message, error, context) {
        this.log(LogLevel.ERROR, message, context, error);
    }
    /**
     * Log de nivel WARN
     */
    warn(message, context) {
        this.log(LogLevel.WARN, message, context);
    }
    /**
     * Log de nivel INFO
     */
    info(message, context) {
        this.log(LogLevel.INFO, message, context);
    }
    /**
     * Log de nivel DEBUG
     */
    debug(message, context) {
        this.log(LogLevel.DEBUG, message, context);
    }
    /**
     * Log específico para requests HTTP
     */
    http(method, url, statusCode, duration, context) {
        const message = `${method} ${url} ${statusCode} - ${duration}ms`;
        const httpContext = {
            ...context,
            method,
            url,
            statusCode,
            duration,
            type: 'HTTP_REQUEST'
        };
        if (statusCode >= 400) {
            this.error(message, undefined, httpContext);
        }
        else {
            this.info(message, httpContext);
        }
    }
    /**
     * Log específico para operaciones de base de datos
     */
    database(operation, table, duration, context) {
        const message = `DB ${operation} on ${table} - ${duration}ms`;
        const dbContext = {
            ...context,
            operation,
            table,
            duration,
            type: 'DATABASE_OPERATION'
        };
        this.debug(message, dbContext);
    }
    /**
     * Log específico para servicios externos
     */
    external(service, operation, success, duration, context) {
        const status = success ? 'SUCCESS' : 'FAILED';
        const message = `External ${service} ${operation} ${status} - ${duration}ms`;
        const externalContext = {
            ...context,
            service,
            operation,
            success,
            duration,
            type: 'EXTERNAL_SERVICE'
        };
        if (success) {
            this.info(message, externalContext);
        }
        else {
            this.error(message, undefined, externalContext);
        }
    }
    /**
     * Crea un logger con contexto específico
     */
    child(context) {
        const childLogger = Object.create(this);
        childLogger.context = { ...this.context, ...context };
        return childLogger;
    }
}
exports.Logger = Logger;
/**
 * Instancia global del logger
 */
exports.logger = Logger.getInstance();
/**
 * Función helper para crear loggers con contexto específico
 */
function createLogger(context) {
    return exports.logger.child(context);
}
