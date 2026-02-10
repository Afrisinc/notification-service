import pino from "pino";
import { connect, Channel, Connection } from "amqplib";
import { getConfig } from "@afrisinc-notify/config";
import { EmailNotification } from "@afrisinc-notify/common";
import { EmailProcessor } from "./processor";

const logger = pino();

async function startEmailWorker() {
  let connection: Connection | null = null;
  let channel: Channel | null = null;

  try {
    const config = getConfig();
    const rabbitmqUrl = config.RABBITMQ_URL || "amqp://admin:password@localhost:5672";
    const queueName = "email-notifications";

    logger.info({ url: rabbitmqUrl }, "Connecting to RabbitMQ...");

    // Connect to RabbitMQ
    connection = await connect(rabbitmqUrl);
    channel = await connection.createChannel();

    // Assert queue
    await channel.assertQueue(queueName, {
      durable: true,
      arguments: {
        "x-message-ttl": 86400000, // 24 hours
      },
    });

    // Set prefetch to 1 for fair distribution
    await channel.prefetch(1);

    logger.info({ queueName }, "✅ Email worker connected to RabbitMQ");

    // Initialize processor
    const processor = new EmailProcessor(logger);

    // Consume messages
    await channel.consume(queueName, async (msg) => {
      if (!msg) {
        return;
      }

      try {
        const emailData = JSON.parse(msg.content.toString()) as EmailNotification;

        logger.info(
          { notificationId: emailData.id, to: emailData.to },
          "🔄 Processing email from queue",
        );

        await processor.process(emailData);

        // Acknowledge message
        channel!.ack(msg);

        logger.info(
          { notificationId: emailData.id },
          "✅ Email job completed and acknowledged",
        );
      } catch (error) {
        logger.error(
          { error, message: msg.content.toString() },
          "❌ Failed to process email job",
        );

        // Reject and requeue message (up to 3 times)
        const retryCount = (msg.properties.headers["x-retry-count"] as number) || 0;

        if (retryCount < 3) {
          await channel!.nack(msg, false, true); // Requeue
          logger.info({ retryCount }, "Message requeued");
        } else {
          // Discard after 3 retries
          channel!.nack(msg, false, false);
          logger.error("Max retries exceeded, message discarded");
        }
      }
    });

    logger.info("📧 Email worker is listening for messages...");

    // Graceful shutdown
    process.on("SIGTERM", async () => {
      logger.info("SIGTERM received, shutting down gracefully...");

      if (channel) {
        await channel.close();
      }

      if (connection) {
        await connection.close();
      }

      logger.info("✅ Email worker shut down successfully");
      process.exit(0);
    });

    process.on("SIGINT", async () => {
      logger.info("SIGINT received, shutting down gracefully...");

      if (channel) {
        await channel.close();
      }

      if (connection) {
        await connection.close();
      }

      logger.info("✅ Email worker shut down successfully");
      process.exit(0);
    });
  } catch (error) {
    logger.error(error, "Failed to start email worker");
    process.exit(1);
  }
}

startEmailWorker();
