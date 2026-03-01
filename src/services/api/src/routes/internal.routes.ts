import { FastifyInstance } from 'fastify';
import { provisioning } from '../controllers/provisioning.controller';
import { asyncWrapper } from '../middlewares/async_wrapper.middleware';

export async function registerInternalRoutes(fastify: FastifyInstance) {
  /**
   * POST /internal/provision
   * Internal endpoint - Not exposed on Swagger
   * Creates a tenant, seeds default roles and templates
   */
  fastify.post('/provision', { schema: { hide: true } }, asyncWrapper(provisioning.provision.bind(provisioning)));
}
