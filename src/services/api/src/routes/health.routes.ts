import { FastifyInstance } from 'fastify';
import { checkDBHealth, checkRedisHealth } from '@shared/utils';
import { livenessSchema, readinessSchema } from '../schemas/routes/health.schema';
import { resolveRabbitHealth } from '../utils/rabbit-health';

export async function registerHealthRoutes(fastify: FastifyInstance) {
  fastify.get('/live', { schema: livenessSchema }, async (_req, reply) => {
    reply.code(200).send({ status: 'up' });
  });

  fastify.get('/ready', { schema: readinessSchema }, async (_req, reply) => {
    const [dbResult, rabbitResult, redisResult] = await Promise.all([
      checkDBHealth(),
      resolveRabbitHealth(),
      checkRedisHealth(),
    ]);

    const allUp = dbResult.statusCode === 200 && rabbitResult.statusCode === 200 && redisResult.statusCode === 200;

    reply.code(allUp ? 200 : 503).send({
      status: allUp ? 'healthy' : 'degraded',
      statusCode: allUp ? 200 : 503,
      db: dbResult.db,
      rabbit: rabbitResult.rabbit,
      redis: redisResult.redis,
    });
  });
}
