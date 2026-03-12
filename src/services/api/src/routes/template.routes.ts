import { FastifyInstance } from 'fastify';
import { TemplateController } from '../controllers/template.controller';
import { asyncWrapper } from '../middlewares/async_wrapper.middleware';
import { authMiddleware } from '../middlewares/auth.middleware';
import {
  CreateTemplateRouteSchema,
  ListTemplatesRouteSchema,
  GetAllTemplatesRouteSchema,
  GetTemplateRouteSchema,
  UpdateTemplateRouteSchema,
  DeleteTemplateRouteSchema,
  CreateVersionRouteSchema,
  ActivateVersionRouteSchema,
  PreviewTemplateRouteSchema,
} from '../schemas/routes/template.schema';

/**
 * Template management routes
 */
export async function registerTemplateRoutes(fastify: FastifyInstance) {
  const controller = new TemplateController();

  // Search templates (specific path BEFORE generic params) - PUBLIC ENDPOINT
  fastify.get(
    '/templates/search',
    { schema: GetAllTemplatesRouteSchema },
    asyncWrapper(controller.searchTemplates.bind(controller))
  );

  // Preview template rendering (specific path BEFORE generic params)
  fastify.post(
    '/templates/preview',
    { onRequest: [authMiddleware], schema: PreviewTemplateRouteSchema },
    asyncWrapper(controller.previewTemplate.bind(controller))
  );

  // Create new template
  fastify.post(
    '/templates',
    { onRequest: [authMiddleware], schema: CreateTemplateRouteSchema },
    asyncWrapper(controller.createTemplate.bind(controller))
  );

  // List templates (with filtering and pagination) - PUBLIC ENDPOINT
  fastify.get(
    '/templates',
    { schema: ListTemplatesRouteSchema },
    asyncWrapper(controller.listTemplates.bind(controller))
  );

  // Get all templates without pagination (specific path BEFORE generic params) - PUBLIC ENDPOINT
  fastify.get(
    '/templates/all',
    { schema: GetAllTemplatesRouteSchema },
    asyncWrapper(controller.getAllTemplates.bind(controller))
  );

  // Create new version
  fastify.post(
    '/templates/:id/versions',
    { onRequest: [authMiddleware], schema: CreateVersionRouteSchema },
    asyncWrapper(controller.createVersion.bind(controller))
  );

  // Activate version
  fastify.post(
    '/templates/:id/versions/:versionId/activate',
    { onRequest: [authMiddleware], schema: ActivateVersionRouteSchema },
    asyncWrapper(controller.activateVersion.bind(controller))
  );

  // Install template in project (specific path BEFORE generic :id) - PROTECTED
  fastify.post(
    '/templates/:id/install',
    { onRequest: [authMiddleware], schema: CreateTemplateRouteSchema },
    asyncWrapper(controller.installTemplate.bind(controller))
  );

  // Get template installation status (specific path BEFORE generic :id) - PROTECTED
  fastify.get(
    '/templates/:id/status',
    { onRequest: [authMiddleware], schema: GetTemplateRouteSchema },
    asyncWrapper(controller.getInstallationStatus.bind(controller))
  );

  // Get template analytics (specific path BEFORE generic :id) - PROTECTED
  fastify.get(
    '/templates/:id/analytics',
    { onRequest: [authMiddleware], schema: GetTemplateRouteSchema },
    asyncWrapper(controller.getTemplateAnalytics.bind(controller))
  );

  // Get template by ID - PUBLIC ENDPOINT
  fastify.get(
    '/templates/:id',
    { schema: GetTemplateRouteSchema },
    asyncWrapper(controller.getTemplate.bind(controller))
  );

  // Update template
  fastify.put(
    '/templates/:id',
    { onRequest: [authMiddleware], schema: UpdateTemplateRouteSchema },
    asyncWrapper(controller.updateTemplate.bind(controller))
  );

  // Delete template
  fastify.delete(
    '/templates/:id',
    { onRequest: [authMiddleware], schema: DeleteTemplateRouteSchema },
    asyncWrapper(controller.deleteTemplate.bind(controller))
  );
}
