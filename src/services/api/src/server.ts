import { getConfig } from '@shared/config';
import { verifyDbConnections } from '@shared/database';
import { createFastifyApp } from './app';
import { logger } from './config/logger';
import { initializeNotifyService, getQueuePublisher } from './services/notify.service';
import {
  startNotificationIntakeConsumer,
  stopNotificationIntakeConsumer,
} from './consumers/notification-intake.consumer';
import { initAssetsClient } from './utils/assets-client';
import { initializeJobs, stopAllJobs } from './jobs';

async function startServer() {
  let fastify: any = null;

  try {
    const config = getConfig();

    // Verify database connection before starting the server
    logger.info('===================================================');
    logger.info('[DB CHECK] Verifying database connectivity...');
    logger.info('===================================================');

    const dbConnected = await verifyDbConnections();

    if (!dbConnected) {
      logger.error('[ERROR] Failed to start server - database connection failed');
      process.exit(1);
    }

    logger.info('===================================================');
    logger.info('[QUEUE] Initializing queue publisher...');
    logger.info('===================================================');

    await initializeNotifyService();

    if (config.QUEUE_PROVIDER === 'rabbitmq') {
      logger.info('[QUEUE] Starting notification intake consumer...');
      await startNotificationIntakeConsumer();
      logger.info('[OK] Notification intake consumer started');
    }

    logger.info('===================================================');
    logger.info('[ASSETS] Initializing Assets Client...');
    logger.info('===================================================');

    try {
      initAssetsClient(config.ASSETS_API_URL || 'http://localhost:8080', config.ASSETS_API_KEY || 'api-key');
      logger.info('[OK] Assets Client initialized successfully');
    } catch (error) {
      logger.warn('[WARN] Assets Client initialization failed - marketplace features may not work');
      logger.warn({ error: error instanceof Error ? error.message : error }, 'Proceeding without Assets integration');
    }

    // Initialize scheduled jobs (trial reminders, etc.)
    initializeJobs();

    logger.info('===================================================');
    logger.info('[SERVER] Starting Fastify API server...');
    logger.info('===================================================');

    fastify = await createFastifyApp();

    await fastify.listen({ port: config.PORT, host: config.HOST });

    logger.info({ port: config.PORT, host: config.HOST }, '[OK] API Server started successfully');

    logger.info({ docsUrl: `http://${config.HOST}:${config.PORT}/docs` }, '[DOCS] Swagger UI available at');

    // Handle graceful shutdown
    const gracefulShutdown = async () => {
      logger.info('Shutting down gracefully...');

      // Stop all scheduled jobs
      stopAllJobs();

      // Stop the notification intake consumer
      try {
        await stopNotificationIntakeConsumer();
        logger.info('Notification intake consumer stopped');
      } catch (error) {
        logger.error(error, 'Error stopping notification intake consumer');
      }

      // Disconnect queue publisher if available
      try {
        const queuePublisher = getQueuePublisher();
        if (queuePublisher && typeof queuePublisher.disconnect === 'function') {
          await queuePublisher.disconnect();
          logger.info('Queue publisher disconnected');
        }
      } catch (error) {
        logger.error(error, 'Error disconnecting queue publisher');
      }

      if (fastify) {
        await fastify.close();
      }
      process.exit(0);
    };

    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);
  } catch (error) {
    logger.error(error, 'Failed to start API server');
    if (fastify) {
      await fastify.close();
    }
    process.exit(1);
  }
}

startServer();
