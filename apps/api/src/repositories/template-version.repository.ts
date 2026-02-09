import { db } from '@afrisinc-notify/db';
import { logger } from '../config/logger';
import { transformPrismaError } from '../utils/db-errors';

/**
 * Data for creating a new template version
 */
export interface CreateVersionData {
  subject?: string;
  content: string;
  requiredVariables?: any;
  createdBy?: string;
}

/**
 * Template Version Repository
 * Data access layer for template version operations
 */
export class TemplateVersionRepository {
  /**
   * Find version by ID
   */
  async findById(id: string): Promise<any> {
    try {
      return await db.templateVersion.findUnique({
        where: { id },
      });
    } catch (error) {
      logger.error({ error, id }, 'Failed to find template version by ID');
      throw transformPrismaError(error, 'template-version.repository');
    }
  }

  /**
   * Find all versions for a template
   */
  async findByTemplateId(templateId: string): Promise<any[]> {
    try {
      return await db.templateVersion.findMany({
        where: { templateId },
        orderBy: { version: 'desc' },
      });
    } catch (error) {
      logger.error({ error, templateId }, 'Failed to find template versions');
      throw transformPrismaError(error, 'template-version.repository');
    }
  }

  /**
   * Find active version for a template
   */
  async findActiveVersion(templateId: string): Promise<any> {
    try {
      return await db.templateVersion.findFirst({
        where: {
          templateId,
          isActive: true,
        },
      });
    } catch (error) {
      logger.error({ error, templateId }, 'Failed to find active template version');
      throw transformPrismaError(error, 'template-version.repository');
    }
  }

  /**
   * Find version by template ID and version number
   */
  async findByVersion(templateId: string, version: number): Promise<any> {
    try {
      return await db.templateVersion.findUnique({
        where: {
          templateId_version: {
            templateId,
            version,
          },
        },
      });
    } catch (error) {
      logger.error({ error, templateId, version }, 'Failed to find template version');
      throw transformPrismaError(error, 'template-version.repository');
    }
  }

  /**
   * Create new version
   */
  async create(templateId: string, version: number, data: CreateVersionData): Promise<any> {
    try {
      const newVersion = await db.templateVersion.create({
        data: {
          templateId,
          version,
          subject: data.subject,
          content: data.content,
          requiredVariables: data.requiredVariables,
          isActive: false,
          createdBy: data.createdBy,
        },
      });

      logger.info(
        { templateId, version: newVersion.version },
        'Template version created',
      );

      return newVersion;
    } catch (error) {
      logger.error({ error, templateId, version }, 'Failed to create template version');
      throw transformPrismaError(error, 'template-version.repository');
    }
  }

  /**
   * Activate version and deactivate all other versions for the same template
   */
  async activate(id: string, templateId: string): Promise<any> {
    try {
      // Start transaction: deactivate all, then activate this one
      const [activated] = await Promise.all([
        // Activate this version
        db.templateVersion.update({
          where: { id },
          data: { isActive: true },
        }),
        // Deactivate all other versions
        db.templateVersion.updateMany({
          where: {
            templateId,
            id: { not: id },
          },
          data: { isActive: false },
        }),
      ]);

      logger.info(
        { templateId, versionId: id, version: activated.version },
        'Template version activated',
      );

      return activated;
    } catch (error) {
      logger.error({ error, id, templateId }, 'Failed to activate template version');
      throw transformPrismaError(error, 'template-version.repository');
    }
  }

  /**
   * Get next version number for a template
   */
  async getNextVersion(templateId: string): Promise<number> {
    try {
      const latestVersion = await db.templateVersion.findFirst({
        where: { templateId },
        orderBy: { version: 'desc' },
        select: { version: true },
      });

      return (latestVersion?.version || 0) + 1;
    } catch (error) {
      logger.error({ error, templateId }, 'Failed to get next version');
      throw transformPrismaError(error, 'template-version.repository');
    }
  }
}

// Export singleton instance
export const templateVersionRepository = new TemplateVersionRepository();
