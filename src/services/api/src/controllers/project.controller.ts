import { FastifyRequest, FastifyReply } from 'fastify';
import { logger } from '../config/logger';
import { projectRepository } from '../repositories/project.repository';
import { tenantService } from '../services/tenant.service';
import { ApiResponseHelper } from '../utils';

interface CreateProjectRequest {
  name: string;
  description?: string;
}

interface UpdateProjectRequest {
  name?: string;
  description?: string;
}

export class ProjectController {
  /**
   * Create a new project for the authenticated user
   * POST /projects
   */
  async createProject(request: FastifyRequest, reply: FastifyReply) {
    try {
      const tenant = await tenantService.resolveTenant(request);
      const userId = request.headers['x-user-id'] as string;
      const body = request.body as CreateProjectRequest;

      if (!body.name || body.name.trim().length === 0) {
        return ApiResponseHelper.badRequest(reply, 'Project name is required and cannot be empty');
      }

      const project = await projectRepository.create({
        tenantId: tenant.id,
        userId,
        name: body.name,
        description: body.description,
      });

      logger.info({ projectId: project.id, userId, correlationId: request.id }, 'Project created');

      ApiResponseHelper.created(reply, 'Project created successfully', {
        id: project.id,
        name: project.name,
        description: project.description,
        createdAt: project.createdAt.toISOString(),
        updatedAt: project.updatedAt.toISOString(),
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage, correlationId: request.id }, 'Failed to create project');

      // Check for unique constraint violation
      if (errorMessage.includes('Unique constraint failed')) {
        return ApiResponseHelper.duplicate(reply, 'A project with this name already exists in your workspace');
      }

      ApiResponseHelper.badRequest(reply, errorMessage);
    }
  }

  /**
   * Get all projects for the authenticated user
   * GET /projects?limit=50&offset=0
   */
  async getUserProjects(request: FastifyRequest, reply: FastifyReply) {
    try {
      const tenant = await tenantService.resolveTenant(request);
      const userId = request.headers['x-user-id'] as string;
      const { limit, offset } = request.query as {
        limit?: string;
        offset?: string;
      };

      const result = await projectRepository.findByTenantAndUser(
        tenant.id,
        userId,
        limit ? parseInt(limit, 10) : 50,
        offset ? parseInt(offset, 10) : 0
      );

      logger.debug(
        {
          userId,
          count: result.data.length,
          total: result.meta.total,
          correlationId: request.id,
        },
        'Retrieved user projects'
      );

      ApiResponseHelper.successList(
        reply,
        'Projects retrieved successfully',
        result.data.map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          createdAt: p.createdAt.toISOString(),
          updatedAt: p.updatedAt.toISOString(),
        })),
        result.meta
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage, correlationId: request.id }, 'Failed to retrieve user projects');

      ApiResponseHelper.badRequest(reply, errorMessage);
    }
  }

  /**
   * Get a single project by ID
   * GET /projects/:id
   */
  async getProject(request: FastifyRequest, reply: FastifyReply) {
    try {
      const tenant = await tenantService.resolveTenant(request);
      const userId = request.headers['x-user-id'] as string;
      const { id } = request.params as { id: string };

      const project = await projectRepository.findById(id);

      if (!project || project.tenantId !== tenant.id || project.userId !== userId) {
        return ApiResponseHelper.notFound(reply, 'Project not found');
      }

      logger.debug({ projectId: id, correlationId: request.id }, 'Retrieved project');

      ApiResponseHelper.success(reply, 'Project retrieved successfully', {
        id: project.id,
        name: project.name,
        description: project.description,
        createdAt: project.createdAt.toISOString(),
        updatedAt: project.updatedAt.toISOString(),
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage, correlationId: request.id }, 'Failed to retrieve project');

      ApiResponseHelper.badRequest(reply, errorMessage);
    }
  }

  /**
   * Update a project
   * PUT /projects/:id
   */
  async updateProject(request: FastifyRequest, reply: FastifyReply) {
    try {
      const tenant = await tenantService.resolveTenant(request);
      const userId = request.headers['x-user-id'] as string;
      const { id } = request.params as { id: string };
      const body = request.body as UpdateProjectRequest;

      // Verify project ownership
      const project = await projectRepository.findById(id);
      if (!project || project.tenantId !== tenant.id || project.userId !== userId) {
        return ApiResponseHelper.notFound(reply, 'Project not found');
      }

      const updated = await projectRepository.update(id, {
        name: body.name,
        description: body.description,
      });

      logger.info({ projectId: id, correlationId: request.id }, 'Project updated');

      ApiResponseHelper.updated(reply, 'Project updated successfully', {
        id: updated.id,
        name: updated.name,
        description: updated.description,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage, correlationId: request.id }, 'Failed to update project');

      if (errorMessage.includes('Unique constraint failed')) {
        return ApiResponseHelper.duplicate(reply, 'A project with this name already exists in your workspace');
      }

      ApiResponseHelper.badRequest(reply, errorMessage);
    }
  }

  /**
   * Delete a project
   * DELETE /projects/:id
   */
  async deleteProject(request: FastifyRequest, reply: FastifyReply) {
    try {
      const tenant = await tenantService.resolveTenant(request);
      const userId = request.headers['x-user-id'] as string;
      const { id } = request.params as { id: string };

      // Verify project ownership
      const project = await projectRepository.findById(id);
      if (!project || project.tenantId !== tenant.id || project.userId !== userId) {
        return ApiResponseHelper.notFound(reply, 'Project not found');
      }

      await projectRepository.delete(id);

      logger.info({ projectId: id, correlationId: request.id }, 'Project deleted');

      ApiResponseHelper.deleted(reply, 'Project deleted successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage, correlationId: request.id }, 'Failed to delete project');

      ApiResponseHelper.badRequest(reply, errorMessage);
    }
  }
}
