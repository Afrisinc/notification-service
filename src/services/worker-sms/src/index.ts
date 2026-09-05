import pino from 'pino';
import { getConfig } from '@shared/config';
import { verifyDbConnections, closeDbConnections } from '@shared/database';
import { dlqConfigs } from '@shared/utils/dlq';
import { queueRetryConfigs } from '@shared/utils/retry';
import { RabbitConsumer, type QueueMessage } from '@shared/queue';
import { refundFailedNotification } from '@shared/billing/payg-refund';
import { SMSProcessor } from './processor';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: { level: (label) => ({ level: label }) },
});

async function startSMSWorker() {
  const config = getConfig();

  const dbConnected = await verifyDbConnections();
  if (!dbConnected) {
    logger.error('Failed to connect to database');
    process.exit(1);
  }

  const processor = new SMSProcessor(logger);
  const consumer = new RabbitConsumer<QueueMessage>({
    url: config.RABBITMQ_URL,
    dlqConfig: dlqConfigs.sms,
    retryConfig: queueRetryConfigs.sms,
    logger,
    onExhausted: async (message, error) => {
      const notificationId = message.notificationId;
      if (!notificationId) return;

      try {
        const result = await refundFailedNotification(
          notificationId,
          `SMS delivery failed permanently: ${error.message}`
        );

        if (result.refunded) {
          logger.info(
            { notificationId, amount: result.amount, newBalance: result.newBalance },
            'PAYG credits refunded for permanently failed SMS'
          );
        }
      } catch (refundError) {
        logger.error(
          {
            notificationId,
            error: refundError instanceof Error ? refundError.message : String(refundError),
          },
          'Failed to refund PAYG credits for permanently failed SMS'
        );
      }
    },
  });

  await consumer.start((message) => processor.process(message));
  logger.info('SMS worker is listening for messages');

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'Shutting down SMS worker');
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

startSMSWorker().catch((error) => {
  logger.error({ error }, 'Failed to start SMS worker');
  process.exit(1);
});
