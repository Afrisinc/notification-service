import { FastifyInstance } from 'fastify';
import { registerHealthRoutes } from '../routes/health.routes';
import { registerNotifyRoutes } from '../routes/notify.routes';
import { registerTemplateRoutes } from '../routes/template.routes';

export async function registerRoutesPlugin(fastify: FastifyInstance) {
  await registerHealthRoutes(fastify);
  await registerNotifyRoutes(fastify);
  await registerTemplateRoutes(fastify);
}
