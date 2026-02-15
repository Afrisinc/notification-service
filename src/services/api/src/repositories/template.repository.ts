import { db } from '@shared/db';
import { logger } from '../config/logger';
import { transformPrismaError } from '../utils/db-errors';

/**
 * Template Filters for list operations
 */
export interface TemplateFilters {
  channel?: string;
  locale?: string;
  active?: boolean;
  includeDeleted?: boolean;
}

/**
 * Template data for creation
 */
export interface CreateTemplateData {
  code: string;
  channel: any; // Can be string or Channel enum
  subject?: string;
  content: string;
  language: string;
  requiredVariables?: any;
  description?: string;
}

/**
 * Pagination metadata
 */
export interface PaginationMeta {
  limit: number;
  offset: number;
  total: number;
}

/**
 * Template Repository
 * Data access layer for template operations
 * Handles all database interactions with tenant isolation
 */
export class TemplateRepository {
  /**
   * Find template by ID with tenant isolation
   * Returns null if template is soft-deleted
   */
  async findById(tenantId: string, id: string): Promise<any> {
    try {
      const template = await db.template.findUnique({
        where: { id },
        include: {
          versions: {
            where: { isActive: true },
            select: { id: true, version: true, isActive: true, createdAt: true },
            take: 1,
          },
        },
      });

      // Verify tenant ownership and not soft-deleted
      if (template && template.tenantId !== tenantId) {
        return null;
      }

      if (template && template.deletedAt !== null) {
        return null;
      }

      return template;
    } catch (error) {
      logger.error({ error, tenantId, id }, 'Failed to find template by ID');
      throw transformPrismaError(error, 'template.repository');
    }
  }

  /**
   * Find template by code, channel, and language
   * Filters for active templates (deletedAt is null)
   */
  async findByCode(
    tenantId: string,
    code: string,
    channel: string,
    language: string = 'en',
  ): Promise<any> {
    try {
      // First try to find exact match
      const template = await db.template.findFirst({
        where: {
          tenantId,
          code,
          channel: channel as any,
          language,
          deletedAt: null,
        },
        include: {
          versions: {
            where: { isActive: true },
            select: { id: true, version: true, isActive: true },
            take: 1,
          },
        },
      });
      return template;
    } catch (error) {
      logger.error({ error, tenantId, code, channel, language }, 'Failed to find template by code');
      throw transformPrismaError(error, 'template.repository');
    }
  }

  /**
   * Find template by code with locale fallback
   * Tries: requested locale → 'en' → first available
   */
  async findByCodeWithFallback(
    tenantId: string,
    code: string,
    channel: string,
    requestedLocale: string = 'en',
  ): Promise<any> {
    try {
      logger.debug(
        { tenantId, code, channel, requestedLocale },
        'Finding template by code with fallback',
      );

      // Try requested locale
      let template = await this.findByCode(tenantId, code, channel, requestedLocale);
      logger.debug(
        { found: !!template, locale: requestedLocale },
        'First locale attempt',
      );

      if (template && template.active) {
        return template;
      }

      // Fallback to English
      if (requestedLocale !== 'en') {
        template = await this.findByCode(tenantId, code, channel, 'en');
        logger.debug(
          { found: !!template, locale: 'en' },
          'Fallback to English',
        );
        if (template && template.active) {
          return template;
        }
      }

      // Fallback to first available active template
      logger.debug({}, 'Trying first available active template');
      template = await db.template.findFirst({
        where: {
          tenantId,
          code,
          channel: channel as any,
          active: true,
          deletedAt: null,
        },
        include: {
          versions: {
            where: { isActive: true },
            select: { id: true, version: true, isActive: true },
            take: 1,
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      logger.debug(
        { found: !!template },
        'First available template result',
      );

      return template || null;
    } catch (error) {
      logger.error(
        { error, tenantId, code, channel, requestedLocale },
        'Failed to find template by code with fallback',
      );
      throw transformPrismaError(error, 'template.repository');
    }
  }

  /**
   * List templates with filtering and pagination
   */
  async findMany(
    tenantId: string,
    filters: TemplateFilters = {},
    limit: number = 20,
    offset: number = 0,
  ): Promise<{ data: any[]; meta: PaginationMeta }> {
    try {
      const where: any = {
        tenantId,
        deletedAt: filters.includeDeleted ? undefined : null,
      };

      if (filters.channel) {
        where.channel = filters.channel as any;
      }

      if (filters.locale) {
        where.language = filters.locale;
      }

      if (filters.active !== undefined) {
        where.active = filters.active;
      }

      const [data, total] = await Promise.all([
        db.template.findMany({
          where,
          skip: offset,
          take: Math.min(limit, 100), // Cap at 100
          orderBy: { createdAt: 'desc' },
          include: {
            versions: {
              where: { isActive: true },
              select: { id: true, version: true, isActive: true },
              take: 1,
            },
          },
        }),
        db.template.count({ where }),
      ]);

      return {
        data,
        meta: { limit: Math.min(limit, 100), offset, total },
      };
    } catch (error) {
      logger.error({ error, tenantId, filters, limit, offset }, 'Failed to list templates');
      throw transformPrismaError(error, 'template.repository');
    }
  }

  /**
   * Create new template
   */
  async create(tenantId: string, data: CreateTemplateData): Promise<any> {
    try {
      const template = await db.template.create({
        data: {
          tenantId,
          code: data.code,
          channel: data.channel,
          subject: data.subject,
          content: data.content,
          language: data.language,
          requiredVariables: data.requiredVariables,
          description: data.description,
          active: true,
          version: 1,
        },
        include: {
          versions: {
            where: { isActive: true },
            select: { id: true, version: true, isActive: true },
            take: 1,
          },
        },
      });

      logger.info({ tenantId, templateId: template.id, code: data.code }, 'Template created');
      return template;
    } catch (error) {
      logger.error({ error, tenantId, data }, 'Failed to create template');
      throw transformPrismaError(error, 'template.repository');
    }
  }

  /**
   * Update template
   */
  async update(tenantId: string, id: string, data: Partial<CreateTemplateData>): Promise<any> {
    try {
      const template = await this.findById(tenantId, id);
      if (!template) {
        throw new Error(`Template not found: ${id}`);
      }

      const updated = await db.template.update({
        where: { id },
        data: {
          ...(data.subject !== undefined && { subject: data.subject }),
          ...(data.content !== undefined && { content: data.content }),
          ...(data.requiredVariables !== undefined && { requiredVariables: data.requiredVariables }),
          ...(data.description !== undefined && { description: data.description }),
        },
        include: {
          versions: {
            where: { isActive: true },
            select: { id: true, version: true, isActive: true },
            take: 1,
          },
        },
      });

      logger.info({ tenantId, templateId: id }, 'Template updated');
      return updated;
    } catch (error) {
      logger.error({ error, tenantId, id }, 'Failed to update template');
      throw transformPrismaError(error, 'template.repository');
    }
  }

  /**
   * Soft delete template (set deletedAt)
   */
  async softDelete(tenantId: string, id: string): Promise<void> {
    try {
      const template = await this.findById(tenantId, id);
      if (!template) {
        throw new Error(`Template not found: ${id}`);
      }

      await db.template.update({
        where: { id },
        data: { deletedAt: new Date() },
      });

      logger.info({ tenantId, templateId: id }, 'Template soft deleted');
    } catch (error) {
      logger.error({ error, tenantId, id }, 'Failed to soft delete template');
      throw transformPrismaError(error, 'template.repository');
    }
  }

  /**
   * Activate template (set active = true)
   */
  async activate(tenantId: string, id: string): Promise<any> {
    try {
      const template = await this.findById(tenantId, id);
      if (!template) {
        throw new Error(`Template not found: ${id}`);
      }

      const activated = await db.template.update({
        where: { id },
        data: { active: true },
        include: {
          versions: {
            where: { isActive: true },
            select: { id: true, version: true, isActive: true },
            take: 1,
          },
        },
      });

      logger.info({ tenantId, templateId: id }, 'Template activated');
      return activated;
    } catch (error) {
      logger.error({ error, tenantId, id }, 'Failed to activate template');
      throw transformPrismaError(error, 'template.repository');
    }
  }

  /**
   * Deactivate template (set active = false)
   */
  async deactivate(tenantId: string, id: string): Promise<any> {
    try {
      const template = await this.findById(tenantId, id);
      if (!template) {
        throw new Error(`Template not found: ${id}`);
      }

      const deactivated = await db.template.update({
        where: { id },
        data: { active: false },
        include: {
          versions: {
            where: { isActive: true },
            select: { id: true, version: true, isActive: true },
            take: 1,
          },
        },
      });

      logger.info({ tenantId, templateId: id }, 'Template deactivated');
      return deactivated;
    } catch (error) {
      logger.error({ error, tenantId, id }, 'Failed to deactivate template');
      throw transformPrismaError(error, 'template.repository');
    }
  }
}

// Export singleton instance
export const templateRepository = new TemplateRepository();
