import { FastifyInstance } from 'fastify';
import { ProjectController } from '../controllers/project.controller';
import { asyncWrapper } from '../middlewares/async_wrapper.middleware';
import { authMiddleware } from '../middlewares/auth.middleware';
import {
  CreateProjectRouteSchema,
  ListProjectsRouteSchema,
  GetProjectRouteSchema,
  UpdateProjectRouteSchema,
  DeleteProjectRouteSchema,
} from '../schemas/routes/project.schema';

/**
 * Project management routes
 * All routes are protected with JWT authentication
 */
export async function registerProjectRoutes(fastify: FastifyInstance) {
  const controller = new ProjectController();

  // Create a new project
  fastify.post(
    '/projects',
    { onRequest: [authMiddleware], schema: CreateProjectRouteSchema },
    asyncWrapper(controller.createProject.bind(controller))
  );

  // List all projects for authenticated user with pagination
  fastify.get(
    '/projects',
    { onRequest: [authMiddleware], schema: ListProjectsRouteSchema },
    asyncWrapper(controller.getUserProjects.bind(controller))
  );

  // Get a single project by ID
  fastify.get(
    '/projects/:id',
    { onRequest: [authMiddleware], schema: GetProjectRouteSchema },
    asyncWrapper(controller.getProject.bind(controller))
  );

  // Update a project
  fastify.put(
    '/projects/:id',
    { onRequest: [authMiddleware], schema: UpdateProjectRouteSchema },
    asyncWrapper(controller.updateProject.bind(controller))
  );

  // Delete a project
  fastify.delete(
    '/projects/:id',
    { onRequest: [authMiddleware], schema: DeleteProjectRouteSchema },
    asyncWrapper(controller.deleteProject.bind(controller))
  );
}
