import pino from 'pino';
import amqp from 'amqplib';
import { getConfig } from '@shared/config';
import { verifyDbConnections, closeDbConnections } from '@shared/database';
import { setupQueueWithDLQ, dlqConfigs, sendToDLQ } from '@shared/utils/dlq';
import { queueRetryConfigs, getQueueRetryDelay, shouldRetryQueueMessage } from '@shared/utils/retry';
import { EmailProcessor } from './processor';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => ({ level: label }),
  },
});

const DLQ_CONFIG = dlqConfigs.email;
const RETRY_CONFIG = queueRetryConfigs.email;

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function startEmailWorker() {
  let connection: any = null;
  let channel: amqp.Channel | null = null;
  let isShuttingDown = false;

  async function gracefulShutdown(signal: string) {
    if (isShuttingDown) return;
    isShuttingDown = true;

    logger.info({ signal }, 'Graceful shutdown initiated');

    try {
      if (channel) {
        await channel.close();
        logger.info('Channel closed');
      }

      if (connection) {
        await connection.close();
        logger.info('Connection closed');
      }

      await closeDbConnections();
      logger.info('Database connections closed');
      logger.info('Email worker shut down successfully');
      process.exit(0);
    } catch (error) {
      logger.error({ error }, 'Error during shutdown');
      process.exit(1);
    }
  }

  try {
    const config = getConfig();
    const rabbitmqUrl = config.RABBITMQ_URL || 'amqp://admin:password@localhost:5672';

    logger.info('Verifying database connection...');
    const dbConnected = await verifyDbConnections();
    if (!dbConnected) {
      logger.error('Failed to connect to database');
      process.exit(1);
    }
    logger.info('Database connection verified');

    logger.info('Connecting to RabbitMQ...');
    connection = await amqp.connect(rabbitmqUrl);
    const ch = await connection.createChannel();
    channel = ch;

    connection.on('error', (err: Error) => {
      logger.error({ error: err.message }, 'RabbitMQ connection error');
    });

    connection.on('close', () => {
      if (!isShuttingDown) {
        logger.error('RabbitMQ connection closed unexpectedly');
        process.exit(1);
      }
    });

    await setupQueueWithDLQ(ch, DLQ_CONFIG, logger);
    await ch.prefetch(1);

    logger.info(
      {
        queue: DLQ_CONFIG.mainQueue,
        dlq: DLQ_CONFIG.dlqQueue,
        exchange: DLQ_CONFIG.mainExchange,
      },
      'Email worker connected to RabbitMQ with DLQ support'
    );

    const processor = new EmailProcessor(logger);

    await ch.consume(DLQ_CONFIG.mainQueue, async (msg: amqp.ConsumeMessage | null) => {
      if (!msg || isShuttingDown) {
        return;
      }

      const startTime = Date.now();
      const headers = msg.properties?.headers || {};
      const retryCount = (headers['x-retry-count'] as number) || 0;

      let emailData: any;
      let notificationId: string = 'unknown';

      try {
        const content = JSON.parse(msg.content.toString());
        emailData = content.msg || content;
        notificationId = emailData.notificationId || emailData.id || 'unknown';

        logger.info(
          {
            notificationId,
            recipient: emailData.recipient || emailData.to,
            retryCount,
          },
          'Processing email from queue'
        );

        await processor.process(emailData);

        channel!.ack(msg);

        const duration = Date.now() - startTime;
        logger.info(
          {
            notificationId,
            duration,
            retryCount,
          },
          'Email processed successfully'
        );
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const duration = Date.now() - startTime;

        logger.error(
          {
            notificationId,
            error: errorMessage,
            retryCount,
            duration,
          },
          'Failed to process email'
        );

        channel!.ack(msg);

        if (shouldRetryQueueMessage(RETRY_CONFIG, retryCount)) {
          const delay = getQueueRetryDelay(RETRY_CONFIG, retryCount);
          const nextRetryCount = retryCount + 1;

          logger.info(
            {
              notificationId,
              nextRetryCount,
              maxRetries: RETRY_CONFIG.maxRetries,
              delayMs: delay,
            },
            'Scheduling retry with backoff'
          );

          await sleep(delay);

          channel!.publish(DLQ_CONFIG.mainExchange, DLQ_CONFIG.mainRoutingKey, msg.content, {
            persistent: true,
            headers: {
              ...headers,
              'x-retry-count': nextRetryCount,
              'x-last-error': errorMessage,
              'x-last-retry-at': new Date().toISOString(),
            },
          });
        } else {
          logger.error(
            {
              notificationId,
              retryCount,
              maxRetries: RETRY_CONFIG.maxRetries,
            },
            'Max retries exceeded, sending to DLQ'
          );

          await sendToDLQ(
            channel!,
            DLQ_CONFIG.dlxExchange,
            DLQ_CONFIG.dlqRoutingKey,
            msg.content,
            headers,
            error instanceof Error ? error : new Error(String(error)),
            logger
          );
        }
      }
    });

    logger.info('Email worker is listening for messages...');

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    process.on('uncaughtException', (error) => {
      logger.error({ error: error.message, stack: error.stack }, 'Uncaught exception');
      gracefulShutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason) => {
      logger.error({ reason }, 'Unhandled rejection');
    });
  } catch (error) {
    logger.error({ error }, 'Failed to start email worker');
    process.exit(1);
  }
}

startEmailWorker();
