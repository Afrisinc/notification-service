import pino from 'pino';
import { getConfig } from '@shared/config';
import { verifyDbConnections, closeDbConnections } from '@shared/database';
import { dlqConfigs } from '@shared/utils/dlq';
import { queueRetryConfigs } from '@shared/utils/retry';
import { RabbitConsumer } from '@shared/queue';
import { EmailProcessor } from './processor';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: { level: (label) => ({ level: label }) },
});

async function startEmailWorker() {
  const config = getConfig();

  const dbConnected = await verifyDbConnections();
  if (!dbConnected) {
    logger.error('Failed to connect to database');
    process.exit(1);
  }

  const processor = new EmailProcessor(logger);
  const consumer = new RabbitConsumer({
    url: config.RABBITMQ_URL,
    dlqConfig: dlqConfigs.email,
    retryConfig: queueRetryConfigs.email,
    logger,
  });

  await consumer.start((message) => processor.process(message));
  logger.info('Email worker is listening for messages');

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'Shutting down email worker');
    try {
      await consumer.stop();
      await closeDbConnections();
      process.exit(0);
    } catch (error) {
      logger.error({ error }, 'Error during shutdown');
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

startEmailWorker().catch((error) => {
  logger.error({ error }, 'Failed to start email worker');
  process.exit(1);
});
