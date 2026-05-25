import { FastifyInstance } from 'fastify';
import { TemplateController } from '../controllers/template.controller';
import { asyncWrapper } from '../middlewares/async_wrapper.middleware';
import { validateBaseToken } from '../middlewares/auth.middleware';
import { planGuards } from '../guards/plan-guard';
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
 * Protected routes use /organizations/:orgId/templates/... pattern
 * Public routes use /templates/... pattern
 */
export async function registerTemplateRoutes(fastify: FastifyInstance) {
  const controller = new TemplateController();

  // ==================== PUBLIC ENDPOINTS ====================

  // Search templates - PUBLIC
  fastify.get(
    '/templates/search',
    { schema: GetAllTemplatesRouteSchema },
    asyncWrapper(controller.searchTemplates.bind(controller))
  );

  // List templates (with filtering and pagination) - PUBLIC
  fastify.get(
    '/templates',
    { schema: ListTemplatesRouteSchema },
    asyncWrapper(controller.listTemplates.bind(controller))
  );

  // Get all templates without pagination - PUBLIC
  fastify.get(
    '/templates/all',
    { schema: GetAllTemplatesRouteSchema },
    asyncWrapper(controller.getAllTemplates.bind(controller))
  );

  // Get template by ID - PUBLIC
  fastify.get(
    '/templates/:id',
    { schema: GetTemplateRouteSchema },
    asyncWrapper(controller.getTemplate.bind(controller))
  );

  // ==================== PROTECTED ENDPOINTS ====================

  // Preview template rendering - PROTECTED
  fastify.post(
    '/organizations/:orgId/templates/preview',
    { onRequest: [validateBaseToken], schema: PreviewTemplateRouteSchema },
    asyncWrapper(controller.previewTemplate.bind(controller))
  );

  // List user's templates - PROTECTED
  fastify.get(
    '/organizations/:orgId/templates/my-templates',
    { onRequest: [validateBaseToken] },
    asyncWrapper(controller.listMyTemplates.bind(controller))
  );

  // Create new template - PROTECTED
  fastify.post(
    '/organizations/:orgId/templates',
    {
      onRequest: [validateBaseToken],
      preHandler: [planGuards.checkEntityLimit('templates')],
      schema: CreateTemplateRouteSchema,
    },
    asyncWrapper(controller.createTemplate.bind(controller))
  );

  // Create new version - PROTECTED
  fastify.post(
    '/organizations/:orgId/templates/:id/versions',
    { onRequest: [validateBaseToken], schema: CreateVersionRouteSchema },
    asyncWrapper(controller.createVersion.bind(controller))
  );

  // Activate version - PROTECTED
  fastify.post(
    '/organizations/:orgId/templates/:id/versions/:versionId/activate',
    { onRequest: [validateBaseToken], schema: ActivateVersionRouteSchema },
    asyncWrapper(controller.activateVersion.bind(controller))
  );

  // Publish template to marketplace - PROTECTED
  fastify.post(
    '/organizations/:orgId/templates/:id/publish',
    { onRequest: [validateBaseToken] },
    asyncWrapper(controller.publishTemplate.bind(controller))
  );

  // Unpublish template from marketplace - PROTECTED
  fastify.put(
    '/organizations/:orgId/templates/:id/unpublish',
    { onRequest: [validateBaseToken] },
    asyncWrapper(controller.unpublishTemplate.bind(controller))
  );

  // Duplicate template - PROTECTED
  fastify.post(
    '/organizations/:orgId/templates/:id/duplicate',
    {
      onRequest: [validateBaseToken],
      preHandler: [planGuards.checkEntityLimit('templates')],
    },
    asyncWrapper(controller.duplicateTemplate.bind(controller))
  );

  // Install template in project - PROTECTED
  fastify.post(
    '/organizations/:orgId/templates/:id/install',
    { onRequest: [validateBaseToken], schema: CreateTemplateRouteSchema },
    asyncWrapper(controller.installTemplate.bind(controller))
  );

  // Get template installation status - PROTECTED
  fastify.get(
    '/organizations/:orgId/templates/:id/status',
    { onRequest: [validateBaseToken], schema: GetTemplateRouteSchema },
    asyncWrapper(controller.getInstallationStatus.bind(controller))
  );

  // Get template analytics - PROTECTED (requires advanced_analytics feature)
  fastify.get(
    '/organizations/:orgId/templates/:id/analytics',
    {
      onRequest: [validateBaseToken],
      preHandler: [planGuards.requireFeature('advanced_analytics')],
      schema: GetTemplateRouteSchema,
    },
    asyncWrapper(controller.getTemplateAnalytics.bind(controller))
  );

  // Get template for editing - PROTECTED
  fastify.get(
    '/organizations/:orgId/templates/:id/edit',
    { onRequest: [validateBaseToken] },
    asyncWrapper(controller.getTemplateForEdit.bind(controller))
  );

  // Update template - PROTECTED
  fastify.put(
    '/organizations/:orgId/templates/:id',
    { onRequest: [validateBaseToken], schema: UpdateTemplateRouteSchema },
    asyncWrapper(controller.updateTemplate.bind(controller))
  );

  // Delete template - PROTECTED
  fastify.delete(
    '/organizations/:orgId/templates/:id',
    { onRequest: [validateBaseToken], schema: DeleteTemplateRouteSchema },
    asyncWrapper(controller.deleteTemplate.bind(controller))
  );
}
