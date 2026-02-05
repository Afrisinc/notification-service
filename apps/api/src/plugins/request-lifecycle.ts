import { FastifyInstance } from 'fastify';
import { correlationIdMiddleware } from '../middlewares/correlation-id.middleware';
import { logger } from '../config/logger';

export async function registerRequestLifecyclePlugin(fastify: FastifyInstance) {
  // Correlation ID middleware
  fastify.addHook('onRequest', correlationIdMiddleware);

  // Request logging
  fastify.addHook('onRequest', async (request, reply) => {
    logger.debug(
      {
        method: request.method,
        url: request.url,
        requestId: request.id,
      },
      'Incoming request'
    );
  });

  // Response logging
  fastify.addHook('onResponse', async (request, reply) => {
    logger.debug(
      {
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode,
        responseTime: reply.elapsedTime,
        requestId: request.id,
      },
      'Request completed'
    );
  });
}
