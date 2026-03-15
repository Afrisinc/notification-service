import { FastifyRequest, FastifyReply } from 'fastify';

/**
 * Async wrapper middleware to handle errors in async route handlers
 * Catches promise rejections and passes them to Fastify error handler
 */
export const asyncWrapper =
  (fn: (request: FastifyRequest, reply: FastifyReply) => Promise<void> | void) =>
  (request: FastifyRequest, reply: FastifyReply) => {
    return Promise.resolve(fn(request, reply)).catch((error) => {
      request.server.errorHandler(error, request, reply);
    });
  };
