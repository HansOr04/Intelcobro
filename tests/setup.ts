// tests/setup.ts

import { Logger } from '../src/shared/utils/Logger';

/**
 * Configuración global para todos los tests
 */

// Configurar variables de entorno para testing
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'ERROR'; // Solo mostrar errores en tests
process.env.PORT = '5001'; // Puerto diferente para tests

// Mock de console para evitar output durante tests
const originalConsole = { ...console };

beforeAll(() => {
  // Silenciar logs durante tests excepto errores críticos
  console.log = jest.fn();
  console.info = jest.fn();
  console.warn = jest.fn();
  console.debug = jest.fn();
  
  // Mantener console.error para errores importantes
  console.error = originalConsole.error;
});

afterAll(() => {
  // Restaurar console original
  Object.assign(console, originalConsole);
});

beforeEach(() => {
  // Limpiar todos los mocks antes de cada test
  jest.clearAllMocks();
  
  // Resetear el logger
  const logger = Logger.getInstance();
  logger.clearContext();
});

afterEach(() => {
  // Limpiar timers y mocks después de cada test
  jest.clearAllTimers();
  jest.restoreAllMocks();
});

/**
 * Helpers globales para testing
 */

// Helper para crear delays en tests
global.delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper para generar datos de prueba
global.createTestEmail = () => `test${Date.now()}@example.com`;
global.createTestPhone = () => `+593987654321`;
global.createTestId = () => `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// Configurar timezone para tests consistentes
process.env.TZ = 'UTC';

// Extender Jest matchers si es necesario
declare global {
  namespace jest {
    interface Matchers<R> {
      // Aquí se pueden añadir matchers personalizados
    }
  }
  
  // Helpers globales
  var delay: (ms: number) => Promise<void>;
  var createTestEmail: () => string;
  var createTestPhone: () => string;
  var createTestId: () => string;
}