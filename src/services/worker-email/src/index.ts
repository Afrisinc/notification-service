import pino from 'pino';
import { connect } from 'amqplib';
import { getConfig } from '@shared/config';
import { verifyDbConnections, closeDbConnections } from '@shared/database';
import { EmailProcessor } from './processor';

const logger = pino();

async function startEmailWorker() {
  let connection: any = null;
  let channel: any = null;

  try {
    const config = getConfig();
    const rabbitmqUrl = config.RABBITMQ_URL || 'amqp://admin:password@localhost:5672';
    const exchangeName = 'notifications';
    const routingKey = 'send_message.email';
    const queueName = 'notifications.email';

    // Connect to database
    logger.info('Verifying database connection...');
    const dbConnected = await verifyDbConnections();
    if (!dbConnected) {
      logger.error('Failed to connect to database');
      process.exit(1);
    }
    logger.info('✅ Database connection verified');

    logger.info({ url: rabbitmqUrl }, 'Connecting to RabbitMQ...');

    // Connect to RabbitMQ
    connection = await connect(rabbitmqUrl);
    channel = await connection.createChannel();

    // Assert exchange
    await channel.assertExchange(exchangeName, 'direct', {
      durable: true,
    });

    // Assert queue
    await channel.assertQueue(queueName, {
      durable: true,
    });

    // Bind queue to exchange
    await channel.bindQueue(queueName, exchangeName, routingKey);

    // Set prefetch to 1 for fair distribution
    await channel.prefetch(1);

    logger.info({ queueName, exchange: exchangeName, routingKey }, '✅ Email worker connected to RabbitMQ');

    // Initialize processor
    const processor = new EmailProcessor(logger);

    // Consume messages
    await channel.consume(queueName, async (msg: any) => {
      if (!msg) {
        return;
      }

      try {
        const content = JSON.parse(msg.content.toString());
        const emailData = content.msg;

        logger.info(
          { notificationId: emailData.notificationId, recipient: emailData.recipient },
          '🔄 Processing email from queue'
        );

        await processor.process(emailData);

        // Acknowledge message
        channel!.ack(msg);

        logger.info({ notificationId: emailData.notificationId }, '✅ Email job completed and acknowledged');
      } catch (error) {
        logger.error({ error, message: msg.content.toString() }, '❌ Failed to process email job');

        // Reject and requeue message (up to 3 times)
        const retryCount = (msg.properties?.headers?.['x-retry-count'] as number) || 0;

        if (retryCount < 3) {
          // Acknowledge the original message so it doesn't get stuck in an infinite loop
          channel!.ack(msg);

          // Republish with incremented retry count
          const nextRetryCount = retryCount + 1;
          channel!.publish(exchangeName, routingKey, msg.content, {
            headers: {
              ...msg.properties?.headers,
              'x-retry-count': nextRetryCount,
            },
          });
          logger.info({ retryCount: nextRetryCount }, 'Message requeued with incremented retry count');
        } else {
          // Discard after 3 retries by acknowledging it
          channel!.ack(msg);
          logger.error('Max retries exceeded, message discarded');
        }
      }
    });

    logger.info('📧 Email worker is listening for messages...');

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received, shutting down gracefully...');

      if (channel) {
        await channel.close();
      }

      if (connection) {
        await connection.close();
      }

      await closeDbConnections();
      logger.info('✅ Email worker shut down successfully');
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      logger.info('SIGINT received, shutting down gracefully...');

      if (channel) {
        await channel.close();
      }

      if (connection) {
        await connection.close();
      }

      await closeDbConnections();
      logger.info('✅ Email worker shut down successfully');
      process.exit(0);
    });
  } catch (error) {
    logger.error(error, 'Failed to start email worker');
    process.exit(1);
  }
}

startEmailWorker();
