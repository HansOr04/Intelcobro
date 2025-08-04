// server.ts (archivo principal del servidor)
import { IntelcobroApp } from './src/app';
import { logger } from './src/shared/utils/Logger';

async function startServer() {
  try {
    const app = new IntelcobroApp();
    await app.start();
  } catch (error) {
    logger.error('Failed to start server', undefined, error instanceof Error ? error : new Error(String(error)));
    process.exit(1);
  }
}

// Manejo de errores no capturados
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', undefined, error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at Promise', undefined, new Error(`${promise} reason: ${reason}`));
  process.exit(1);
});

startServer();