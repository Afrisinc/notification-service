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
    const routingKey = 'send_message.sms';
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
        logger.warn('Received empty message from queue');
        return;
      }

      let smsData: any;
      const startTime = Date.now();

      try {
        const content = JSON.parse(msg.content.toString());
        smsData = content.msg;

        logger.info(
          {
            notificationId: smsData.notificationId,
            recipient: smsData.recipient,
            channel: smsData.channel,
            templateCode: smsData.templateCode,
            deliveryTag: msg.fields?.deliveryTag,
          },
          '📨 [SMS WORKER] Received message from queue'
        );

        // Process the SMS
        await processor.process(smsData);

        // Acknowledge message only after successful processing
        channel!.ack(msg);

        const duration = Date.now() - startTime;
        logger.info(
          {
            notificationId: smsData.notificationId,
            recipient: smsData.recipient,
            duration: `${duration}ms`,
            deliveryTag: msg.fields?.deliveryTag,
          },
          '✅ [SMS WORKER] Message processed and acknowledged successfully'
        );
      } catch (error) {
        const duration = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : String(error);

        logger.error(
          {
            notificationId: smsData?.notificationId || 'unknown',
            recipient: smsData?.recipient || 'unknown',
            error: errorMessage,
            duration: `${duration}ms`,
            deliveryTag: msg.fields?.deliveryTag,
            messageContent: msg.content.toString(),
          },
          '❌ [SMS WORKER] Failed to process SMS message'
        );

        // Reject and requeue message (up to 3 times)
        const retryCount = (msg.properties?.headers?.['x-retry-count'] as number) || 0;

        if (retryCount < 3) {
          await channel!.nack(msg, false, true); // Requeue
          logger.warn(
            {
              notificationId: smsData?.notificationId,
              retryCount: retryCount + 1,
              maxRetries: 3,
              deliveryTag: msg.fields?.deliveryTag,
            },
            '🔄 [SMS WORKER] Message requeued for retry'
          );
        } else {
          // Discard after 3 retries
          channel!.nack(msg, false, false);
          logger.error(
            {
              notificationId: smsData?.notificationId,
              recipient: smsData?.recipient,
              deliveryTag: msg.fields?.deliveryTag,
            },
            '🚫 [SMS WORKER] Max retries exceeded, message discarded'
          );
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
