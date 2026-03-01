/**
 * Queue Services Index
 *
 * Orchestrates all RabbitMQ consumers and publishers
 * Consumers: Process incoming notification messages from RabbitMQ
 * Publishers: Publish notification messages to RabbitMQ
 */

import { logger } from '../config/logger';
import { emailConsumer } from './email.consumer';

export { notificationConsumer, NotificationConsumer } from './notification.consumer';
export { notificationPublisher, NotificationPublisher, BatchPublishResult } from './notification.publisher';

/**
 * Main Consumer Watch Function
 *
 * Initializes all RabbitMQ consumers after server startup
 * Called from server.ts after fastify server is ready and listening
 *
 * Consumers:
 * - Email Notifications: Listens to notifications exchange (send_message routing key)
 *
 * @throws Error if any consumer fails to initialize
 */
export const ConsumerWatch = async (): Promise<void> => {
  try {
    logger.info('===================================================');
    logger.info('[CONSUMERS] Starting RabbitMQ message consumers...');
    logger.info('===================================================');

    // Initialize all consumers in parallel
    await Promise.all([
      emailConsumer(),
      // Add more consumers here as needed
      // smsConsumer(),
      // pushConsumer(),
    ]);

    logger.info('===================================================');
    logger.info('[CONSUMERS] ✅ All message consumers started successfully');
    logger.info('===================================================');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error({ error: errorMessage }, '❌ Failed to start message consumers');
    throw error;
  }
};
