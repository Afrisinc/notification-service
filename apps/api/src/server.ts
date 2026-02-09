import { getConfig } from "@afrisinc-notify/config";
import { verifyDbConnection } from "@afrisinc-notify/db";
import { createFastifyApp } from "./app";
import { logger } from "./config/logger";
import { initializeNotifyService, getQueuePublisher } from "./services/notify.service";

async function startServer() {
  let fastify: any = null;

  try {
    const config = getConfig();

    // Verify database connection before starting the server
    logger.info("===================================================");
    logger.info("[DB CHECK] Verifying database connectivity...");
    logger.info("===================================================");

    const dbConnected = await verifyDbConnection();

    if (!dbConnected) {
      logger.error("[ERROR] Failed to start server - database connection failed");
      process.exit(1);
    }

    logger.info("===================================================");
    logger.info("[QUEUE] Initializing queue publisher...");
    logger.info("===================================================");

    await initializeNotifyService();

    logger.info("===================================================");
    logger.info("[SERVER] Starting Fastify API server...");
    logger.info("===================================================");

    fastify = await createFastifyApp();

    await fastify.listen({ port: config.PORT, host: config.HOST });

    logger.info(
      { port: config.PORT, host: config.HOST },
      "[OK] API Server started successfully",
    );

    logger.info(
      { docsUrl: `http://${config.HOST}:${config.PORT}/docs` },
      "[DOCS] Swagger UI available at",
    );

    // Handle graceful shutdown
    const gracefulShutdown = async () => {
      logger.info("Shutting down gracefully...");

      // Disconnect queue publisher if available
      try {
        const queuePublisher = getQueuePublisher();
        if (queuePublisher && typeof queuePublisher.disconnect === "function") {
          await queuePublisher.disconnect();
          logger.info("Queue publisher disconnected");
        }
      } catch (error) {
        logger.error(error, "Error disconnecting queue publisher");
      }

      if (fastify) {
        await fastify.close();
      }
      process.exit(0);
    };

    process.on("SIGTERM", gracefulShutdown);
    process.on("SIGINT", gracefulShutdown);
  } catch (error) {
    logger.error(error, "Failed to start API server");
    if (fastify) {
      await fastify.close();
    }
    process.exit(1);
  }
}

startServer();
