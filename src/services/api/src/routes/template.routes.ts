import { FastifyInstance } from "fastify";
import { TemplateController } from "../controllers/template.controller";
import { asyncWrapper } from "../middlewares/async_wrapper.middleware";
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
} from "../schemas/routes/template.schema";

/**
 * Template management routes
 */
export async function registerTemplateRoutes(fastify: FastifyInstance) {
  const controller = new TemplateController();

  // Preview template rendering (specific path BEFORE generic params)
  fastify.post(
    "/templates/preview",
    { schema: PreviewTemplateRouteSchema },
    asyncWrapper(controller.previewTemplate.bind(controller)),
  );

  // Create new template
  fastify.post(
    "/templates",
    { schema: CreateTemplateRouteSchema },
    asyncWrapper(controller.createTemplate.bind(controller)),
  );

  // List templates (with filtering and pagination)
  fastify.get(
    "/templates",
    { schema: ListTemplatesRouteSchema },
    asyncWrapper(controller.listTemplates.bind(controller)),
  );

  // Get all templates without pagination (specific path BEFORE generic params)
  fastify.get(
    "/templates/all",
    { schema: GetAllTemplatesRouteSchema },
    asyncWrapper(controller.getAllTemplates.bind(controller)),
  );

  // Create new version
  fastify.post(
    "/templates/:id/versions",
    { schema: CreateVersionRouteSchema },
    asyncWrapper(controller.createVersion.bind(controller)),
  );

  // Activate version
  fastify.post(
    "/templates/:id/versions/:versionId/activate",
    { schema: ActivateVersionRouteSchema },
    asyncWrapper(controller.activateVersion.bind(controller)),
  );

  // Get template by ID
  fastify.get(
    "/templates/:id",
    { schema: GetTemplateRouteSchema },
    asyncWrapper(controller.getTemplate.bind(controller)),
  );

  // Update template
  fastify.put(
    "/templates/:id",
    { schema: UpdateTemplateRouteSchema },
    asyncWrapper(controller.updateTemplate.bind(controller)),
  );

  // Delete template
  fastify.delete(
    "/templates/:id",
    { schema: DeleteTemplateRouteSchema },
    asyncWrapper(controller.deleteTemplate.bind(controller)),
  );
}
