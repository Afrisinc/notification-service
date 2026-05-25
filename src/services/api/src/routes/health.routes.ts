import { FastifyInstance } from 'fastify';
import { connect } from 'amqplib';
import { logger } from '../config/logger';
import { ApiResponseHelper } from '../utils';
import { prismaRead, prismaWrite } from '@shared/database';
import { getConfig } from '@shared/config';
import { getAllCircuitBreakerStats } from '@shared/utils/circuit-breaker';
import { dlqConfigs } from '@shared/utils/dlq';
import { adminAlerts } from '../services/admin-alerts.service';

interface DependencyStatus {
  name: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  latencyMs?: number;
  error?: string;
}

async function checkDatabase(): Promise<DependencyStatus> {
  const start = Date.now();
  try {
    await prismaRead.$queryRaw`SELECT 1`;
    await prismaWrite.$queryRaw`SELECT 1`;
    return {
      name: 'database',
      status: 'healthy',
      latencyMs: Date.now() - start,
    };
  } catch (error) {
    return {
      name: 'database',
      status: 'unhealthy',
      latencyMs: Date.now() - start,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function checkRabbitMQ(): Promise<DependencyStatus> {
  const start = Date.now();
  let connection: any = null;
  try {
    const config = getConfig();
    connection = await connect(config.RABBITMQ_URL);
    await connection.close();
    return {
      name: 'rabbitmq',
      status: 'healthy',
      latencyMs: Date.now() - start,
    };
  } catch (error) {
    return {
      name: 'rabbitmq',
      status: 'unhealthy',
      latencyMs: Date.now() - start,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch {
        // Ignore close errors
      }
    }
  }
}

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

const detailedHealthSchema = {
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
        version: { type: 'string' },
        uptime: { type: 'number' },
        dependencies: { type: 'array' },
        circuitBreakers: { type: 'object' },
      },
    },
  },
};

export async function registerHealthRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/',
    {
      schema: {
        description: 'Basic health check',
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
    '/live',
    {
      schema: {
        description: 'Liveness probe for Kubernetes',
        tags: ['Health'],
        response: { 200: baseResponseSchema },
      },
    },
    async (_request, reply) => {
      ApiResponseHelper.success(reply, 'Service is alive', {
        status: 'alive',
        service: 'afrisinc-notify-api',
        timestamp: new Date().toISOString(),
      });
    }
  );

  fastify.get(
    '/ready',
    {
      schema: {
        description: 'Readiness probe for Kubernetes - verifies all dependencies',
        tags: ['Health'],
        response: {
          200: detailedHealthSchema,
          503: detailedHealthSchema,
        },
      },
    },
    async (_request, reply) => {
      const [dbStatus, rabbitStatus] = await Promise.all([checkDatabase(), checkRabbitMQ()]);

      const dependencies = [dbStatus, rabbitStatus];
      const allHealthy = dependencies.every((d) => d.status === 'healthy');
      const circuitBreakers = getAllCircuitBreakerStats();

      const response = {
        status: allHealthy ? 'ready' : 'not_ready',
        service: 'afrisinc-notify-api',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
        uptime: process.uptime(),
        dependencies,
        circuitBreakers,
      };

      if (allHealthy) {
        ApiResponseHelper.success(reply, 'Service is ready', response);
      } else {
        reply.code(503);
        ApiResponseHelper.error(reply, 'Service not ready - dependencies unhealthy', 5030, 503);
      }
    }
  );

  fastify.get(
    '/detailed',
    {
      schema: {
        description: 'Detailed health check with all dependency statuses',
        tags: ['Health'],
        response: { 200: detailedHealthSchema },
      },
    },
    async (_request, reply) => {
      const [dbStatus, rabbitStatus] = await Promise.all([checkDatabase(), checkRabbitMQ()]);

      const dependencies = [dbStatus, rabbitStatus];
      const allHealthy = dependencies.every((d) => d.status === 'healthy');
      const circuitBreakers = getAllCircuitBreakerStats();

      const memUsage = process.memoryUsage();

      ApiResponseHelper.success(reply, 'Health check complete', {
        status: allHealthy ? 'healthy' : 'degraded',
        service: 'afrisinc-notify-api',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
        uptime: process.uptime(),
        memory: {
          heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
          heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
          rss: Math.round(memUsage.rss / 1024 / 1024),
        },
        dependencies,
        circuitBreakers,
      });
    }
  );

  fastify.get(
    '/dlq',
    {
      schema: {
        description: 'Dead Letter Queue monitoring',
        tags: ['Health'],
        response: { 200: detailedHealthSchema },
      },
    },
    async (_request, reply) => {
      const config = getConfig();
      const threshold = config.DLQ_ALERT_THRESHOLD;
      let connection: any = null;
      let channel: any = null;

      try {
        connection = await connect(config.RABBITMQ_URL);
        channel = await connection.createChannel();

        const dlqStatus = await Promise.all(
          Object.entries(dlqConfigs).map(async ([name, cfg]) => {
            try {
              const queue = await channel.checkQueue(cfg.dlqQueue);
              const messageCount = queue.messageCount;

              if (messageCount >= threshold) {
                adminAlerts.dlqThresholdExceeded(cfg.dlqQueue, messageCount, threshold);
              }

              return {
                name,
                queue: cfg.dlqQueue,
                messageCount,
                consumerCount: queue.consumerCount,
                status: messageCount >= threshold ? 'warning' : 'healthy',
              };
            } catch {
              return {
                name,
                queue: cfg.dlqQueue,
                messageCount: -1,
                consumerCount: 0,
                status: 'unknown',
                error: 'Queue not found',
              };
            }
          })
        );

        const hasWarnings = dlqStatus.some((s) => s.status === 'warning');

        await channel.close();
        await connection.close();

        ApiResponseHelper.success(reply, 'DLQ status retrieved', {
          status: hasWarnings ? 'warning' : 'healthy',
          service: 'afrisinc-notify-api',
          timestamp: new Date().toISOString(),
          threshold,
          queues: dlqStatus,
        });
      } catch (error) {
        if (channel)
          try {
            await channel.close();
          } catch {
            /* ignore */
          }
        if (connection)
          try {
            await connection.close();
          } catch {
            /* ignore */
          }

        ApiResponseHelper.error(reply, 'Failed to check DLQ status', 5000, 500);
      }
    }
  );
}
