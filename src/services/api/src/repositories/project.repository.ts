import { prismaWrite, prismaRead } from '@shared/database';
import { logger } from '../config/logger';

export class ProjectRepository {
  /**
   * Create a new project for a user
   */
  async create(data: { tenantId: string; userId: string; name: string; description?: string }): Promise<{
    id: string;
    tenantId: string;
    userId: string;
    name: string;
    description: string | null;
    createdAt: Date;
    updatedAt: Date;
  }> {
    try {
      const project = await prismaWrite.project.create({
        data: {
          tenantId: data.tenantId,
          userId: data.userId,
          name: data.name,
          description: data.description,
        },
      });

      logger.info({ projectId: project.id, name: project.name }, 'Project created');
      return project;
    } catch (error) {
      logger.error({ error, name: data.name }, 'Failed to create project');
      throw error;
    }
  }

  /**
   * Find project by ID
   */
  async findById(id: string): Promise<{
    id: string;
    tenantId: string;
    userId: string;
    name: string;
    description: string | null;
    createdAt: Date;
    updatedAt: Date;
  } | null> {
    try {
      return await prismaRead.project.findUnique({
        where: { id },
      });
    } catch (error) {
      logger.error({ error, id }, 'Failed to find project by ID');
      throw error;
    }
  }

  /**
   * Find all projects for a user within a tenant
   */
  async findByTenantAndUser(
    tenantId: string,
    userId: string,
    limit = 50,
    offset = 0
  ): Promise<{
    data: Array<{
      id: string;
      tenantId: string;
      userId: string;
      name: string;
      description: string | null;
      createdAt: Date;
      updatedAt: Date;
    }>;
    meta: { limit: number; offset: number; total: number };
  }> {
    try {
      const [data, total] = await Promise.all([
        prismaRead.project.findMany({
          where: {
            tenantId,
            userId,
          },
          skip: offset,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        prismaRead.project.count({
          where: {
            tenantId,
            userId,
          },
        }),
      ]);

      logger.debug({ tenantId, userId, limit, offset, total }, 'Projects fetched for user');
      return { data, meta: { limit, offset, total } };
    } catch (error) {
      logger.error({ error, tenantId, userId }, 'Failed to find projects for user');
      throw error;
    }
  }

  /**
   * Update project
   */
  async update(
    id: string,
    data: { name?: string; description?: string }
  ): Promise<{
    id: string;
    tenantId: string;
    userId: string;
    name: string;
    description: string | null;
    createdAt: Date;
    updatedAt: Date;
  }> {
    try {
      const project = await prismaWrite.project.update({
        where: { id },
        data,
      });

      logger.info({ projectId: id }, 'Project updated');
      return project;
    } catch (error) {
      logger.error({ error, id }, 'Failed to update project');
      throw error;
    }
  }

  /**
   * Delete project
   */
  async delete(id: string): Promise<void> {
    try {
      await prismaWrite.project.delete({
        where: { id },
      });

      logger.info({ projectId: id }, 'Project deleted');
    } catch (error) {
      logger.error({ error, id }, 'Failed to delete project');
      throw error;
    }
  }
}

export const projectRepository = new ProjectRepository();
