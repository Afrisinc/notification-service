import { FastifyInstance } from 'fastify';
import { checkDBHealth, checkRabbitHealth } from '@shared/utils';
import { livenessSchema, readinessSchema } from '../schemas/routes/health.schema';
import { RabbitMQExchange } from '../utils/rabbitmq';

export async function registerHealthRoutes(fastify: FastifyInstance) {
  fastify.get('/live', { schema: livenessSchema }, async (_req, reply) => {
    reply.code(200).send({ status: 'up' });
  });

  fastify.get('/ready', { schema: readinessSchema }, async (_req, reply) => {
    const [dbResult, rabbitResult] = await Promise.all([
      checkDBHealth(),
      checkRabbitHealth(RabbitMQExchange.consumerChannel, RabbitMQExchange.publisherChannel),
    ]);

    const allUp = dbResult.statusCode === 200 && rabbitResult.statusCode === 200;

    reply.code(allUp ? 200 : 503).send({
      status: allUp ? 'healthy' : 'degraded',
      ...dbResult,
      ...rabbitResult,
    });
  });
}
