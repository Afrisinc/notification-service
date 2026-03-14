import { FastifyInstance } from 'fastify';
import { TemplateController } from '../controllers/template.controller';
import { asyncWrapper } from '../middlewares/async_wrapper.middleware';
import { validateBaseToken } from '../middlewares/auth.middleware';
import { GetTemplatesByOrganizationRouteSchema } from '../schemas/routes/template.schema';

/**
 * Organization management routes
 */
export async function registerOrganizationRoutes(fastify: FastifyInstance) {
  const templateController = new TemplateController();

  // Get templates by organization
  fastify.get(
    '/organizations/:orgId/templates',
    { onRequest: [validateBaseToken], schema: GetTemplatesByOrganizationRouteSchema },
    asyncWrapper(templateController.getTemplatesByOrganization.bind(templateController))
  );
}
