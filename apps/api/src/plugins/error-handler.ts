import { FastifyInstance, FastifyError } from 'fastify';
import { logger } from '../config/logger';

interface ErrorWithStatusCode extends FastifyError {
  statusCode?: number;
}

export async function registerErrorHandlerPlugin(fastify: FastifyInstance) {
  fastify.setErrorHandler((error: ErrorWithStatusCode, request, reply) => {
    const statusCode = error.statusCode || 500;
    const message = error.message || 'Internal server error';

    logger.error(
      {
        error: message,
        stack: error.stack,
        statusCode,
        requestId: request.id,
        method: request.method,
        url: request.url,
      },
      'Unhandled error'
    );

    reply.code(statusCode).send({
      error: message,
      requestId: request.id,
      ...(process.env.NODE_ENV !== 'production' && { stack: error.stack }),
    });
  });
}
