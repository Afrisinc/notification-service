import { createFastifyApp } from './app';
import { getConfig } from './config/env';
import { logger } from './config/logger';

async function startServer() {
  try {
    const config = getConfig();

    const fastify = await createFastifyApp();

    await fastify.listen({ port: config.port, host: config.host });

    logger.info(
      { port: config.port, host: config.host },
      'API Server started successfully'
    );

    logger.info(
      { docsUrl: `http://${config.host}:${config.port}/docs` },
      'Swagger UI available at'
    );
  } catch (error) {
    logger.error(error, 'Failed to start API server');
    process.exit(1);
  }
}

startServer();
