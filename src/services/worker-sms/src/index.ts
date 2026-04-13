import pino from 'pino';
import { connect } from 'amqplib';
import { getConfig } from '@shared/config';
import { verifyDbConnections, closeDbConnections } from '@shared/database';
import { SMSProcessor } from './processor';

const logger = pino();

async function startSMSWorker() {
  let connection: any = null;
  let channel: any = null;

  try {
    const config = getConfig();
    const rabbitmqUrl = config.RABBITMQ_URL || 'amqp://admin:password@localhost:5672';
    const exchangeName = 'notifications';
    const routingKey = 'send_message';
    const queueName = 'notifications.sms';

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

    logger.info({ queueName, exchange: exchangeName, routingKey }, '✅ SMS worker connected to RabbitMQ');

    // Initialize processor
    const processor = new SMSProcessor(logger);

    // Consume messages
    await channel.consume(queueName, async (msg: any) => {
      if (!msg) {
        return;
      }

      try {
        const content = JSON.parse(msg.content.toString());
        const smsData = content.msg;

        logger.info(
          { notificationId: smsData.notificationId, recipient: smsData.recipient },
          '🔄 Processing SMS from queue'
        );

        await processor.process(smsData);

        // Acknowledge message
        channel!.ack(msg);

        logger.info({ notificationId: smsData.notificationId }, '✅ SMS job completed and acknowledged');
      } catch (error) {
        logger.error({ error, message: msg.content.toString() }, '❌ Failed to process SMS job');

        // Reject and requeue message (up to 3 times)
        const retryCount = (msg.properties?.headers?.['x-retry-count'] as number) || 0;

        if (retryCount < 3) {
          await channel!.nack(msg, false, true); // Requeue
          logger.info({ retryCount }, 'Message requeued');
        } else {
          // Discard after 3 retries
          channel!.nack(msg, false, false);
          logger.error('Max retries exceeded, message discarded');
        }
      }
    });

    logger.info('📱 SMS worker is listening for messages...');

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
      logger.info('✅ SMS worker shut down successfully');
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
      logger.info('✅ SMS worker shut down successfully');
      process.exit(0);
    });
  } catch (error) {
    logger.error(error, 'Failed to start SMS worker');
    process.exit(1);
  }
}

startSMSWorker();
