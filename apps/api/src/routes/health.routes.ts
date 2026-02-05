import { FastifyInstance } from 'fastify';
import { logger } from '../config/logger';
import { ApiResponseHelper } from '../utils';

const baseResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    resp_msg: { type: 'string' },
    resp_code: { type: 'number' },
    data: {
      type: 'object',
      properties: {
        status: { type: 'string' },
        service: { type: 'string' },
        timestamp: { type: 'string', format: 'date-time' },
      },
    },
  },
};

export async function registerHealthRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/health',
    {
      schema: {
        description: 'Liveness check',
        tags: ['Health'],
        response: { 200: baseResponseSchema },
      },
    },
    async (request, reply) => {
      logger.debug({ requestId: request.id }, 'Health check');
      ApiResponseHelper.success(reply, 'Service is healthy', {
        status: 'ok',
        service: 'afrisinc-notify-api',
        timestamp: new Date().toISOString(),
      });
    }
  );

  fastify.get(
    '/health/live',
    {
      schema: {
        description: 'Liveness probe for Kubernetes',
        tags: ['Health'],
        response: { 200: baseResponseSchema },
      },
    },
    async (request, reply) => {
      ApiResponseHelper.success(reply, 'Service is alive', {
        status: 'alive',
        service: 'afrisinc-notify-api',
        timestamp: new Date().toISOString(),
      });
    }
  );

  fastify.get(
    '/health/ready',
    {
      schema: {
        description: 'Readiness probe for Kubernetes',
        tags: ['Health'],
        response: { 200: baseResponseSchema },
      },
    },
    async (request, reply) => {
      ApiResponseHelper.success(reply, 'Service is ready', {
        status: 'ready',
        service: 'afrisinc-notify-api',
        timestamp: new Date().toISOString(),
      });
    }
  );
}