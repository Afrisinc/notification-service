import { logger } from '../config/logger';
import { templateRepository } from '../repositories/template.repository';
import { templateVersionRepository } from '../repositories/template-version.repository';
import { templateRenderer, RenderResult } from '../template/renderer';
import { extractRequiredVariables } from '../template/validators/template.validator';

export interface Template {
  id: string;
  tenantId: string;
  code: string;
  channel: string;
  subject?: string;
  content: string;
  language: string;
  requiredVariables?: any;
  description?: string;
  version: number;
  active: boolean;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTemplateRequest {
  code: string;
  channel: string;
  subject?: string;
  content: string;
  language: string;
  description?: string;
}

export interface UpdateTemplateRequest {
  subject?: string;
  content?: string;
  active?: boolean;
}

export interface CreateVersionRequest {
  subject?: string;
  content: string;
  createdBy?: string;
}

/**
 * Template Service
 * Business logic for template operations
 * Uses Prisma repositories for data access
 */
export class TemplateService {
  /**
   * Create a new template with initial version
   */
  async createTemplate(
    tenantId: string,
    request: CreateTemplateRequest,
  ): Promise<Template> {
    try {
      // Extract required variables from content
      const requiredVariables = extractRequiredVariables(request.content);

      // Create template in database
      const template = await templateRepository.create(tenantId, {
        code: request.code,
        channel: request.channel,
        subject: request.subject,
        content: request.content,
        language: request.language,
        requiredVariables: requiredVariables.length > 0 ? requiredVariables : null,
        description: request.description,
      });

      // Create initial version (v1)
      await templateVersionRepository.create(template.id, 1, {
        subject: request.subject,
        content: request.content,
        requiredVariables: requiredVariables.length > 0 ? requiredVariables : null,
      });

      logger.info(
        { tenantId, templateId: template.id, code: request.code },
        'Template created with initial version',
      );

      return template;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage, tenantId, code: request.code }, 'Failed to create template');
      throw error;
    }
  }

  /**
   * Get template by ID
   */
  async getTemplate(
    tenantId: string,
    templateId: string,
  ): Promise<Template | null> {
    try {
      return await templateRepository.findById(tenantId, templateId);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage, tenantId, templateId }, 'Failed to get template');
      throw error;
    }
  }

  /**
   * Get template by code with locale fallback
   */
  async getTemplateByCode(
    tenantId: string,
    code: string,
    channel: string,
    locale: string = 'en',
  ): Promise<Template | null> {
    try {
      logger.debug(
        { tenantId, code, channel, locale },
        'Looking up template by code',
      );

      const template = await templateRepository.findByCodeWithFallback(
        tenantId,
        code,
        channel,
        locale,
      );

      logger.debug(
        { found: !!template, active: template?.active },
        'Template lookup result',
      );

      if (!template || !template.active) {
        return null;
      }

      return template;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(
        { error: errorMessage, tenantId, code, channel },
        'Failed to get template by code',
      );
      throw error;
    }
  }

  /**
   * List templates with filters
   */
  async listTemplates(
    tenantId: string,
    filters?: {
      channel?: string;
      locale?: string;
      active?: boolean;
      limit?: number;
      offset?: number;
    },
  ): Promise<{
    data: Template[];
    meta: { limit: number; offset: number; total: number };
  }> {
    try {
      return await templateRepository.findMany(
        tenantId,
        {
          channel: filters?.channel,
          locale: filters?.locale,
          active: filters?.active,
        },
        filters?.limit || 20,
        filters?.offset || 0,
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage, tenantId }, 'Failed to list templates');
      throw error;
    }
  }

  /**
   * Update template
   */
  async updateTemplate(
    tenantId: string,
    templateId: string,
    request: UpdateTemplateRequest,
  ): Promise<Template> {
    try {
      const template = await this.getTemplate(tenantId, templateId);

      if (!template) {
        throw new Error(`Template not found: ${templateId}`);
      }

      // Extract required variables if content changed
      let requiredVariables;
      if (request.content !== undefined) {
        requiredVariables = extractRequiredVariables(request.content);
      }

      // Update template
      const updated = await templateRepository.update(tenantId, templateId, {
        subject: request.subject,
        content: request.content,
        requiredVariables: requiredVariables
          ? requiredVariables.length > 0
            ? requiredVariables
            : null
          : undefined,
      });

      logger.info({ tenantId, templateId }, 'Template updated');
      return updated;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage, tenantId, templateId }, 'Failed to update template');
      throw error;
    }
  }

  /**
   * Delete template (soft delete)
   */
  async deleteTemplate(tenantId: string, templateId: string): Promise<void> {
    try {
      const template = await this.getTemplate(tenantId, templateId);

      if (!template) {
        throw new Error(`Template not found: ${templateId}`);
      }

      await templateRepository.softDelete(tenantId, templateId);
      logger.info({ tenantId, templateId }, 'Template soft deleted');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage, tenantId, templateId }, 'Failed to delete template');
      throw error;
    }
  }

  /**
   * Create new version of a template
   * Never overwrites active versions
   */
  async createVersion(
    tenantId: string,
    templateId: string,
    request: CreateVersionRequest,
  ): Promise<any> {
    try {
      const template = await this.getTemplate(tenantId, templateId);

      if (!template) {
        throw new Error(`Template not found: ${templateId}`);
      }

      // Get next version number
      const nextVersion = await templateVersionRepository.getNextVersion(templateId);

      // Extract required variables
      const requiredVariables = extractRequiredVariables(request.content);

      // Create new version (inactive by default)
      const version = await templateVersionRepository.create(templateId, nextVersion, {
        subject: request.subject,
        content: request.content,
        requiredVariables: requiredVariables.length > 0 ? requiredVariables : null,
        createdBy: request.createdBy,
      });

      // Update template's version field
      await templateRepository.update(tenantId, templateId, {});

      logger.info(
        { tenantId, templateId, version: nextVersion },
        'Template version created',
      );

      return version;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(
        { error: errorMessage, tenantId, templateId },
        'Failed to create template version',
      );
      throw error;
    }
  }

  /**
   * Activate a specific version
   */
  async activateVersion(
    tenantId: string,
    templateId: string,
    versionId: string,
  ): Promise<any> {
    try {
      const template = await this.getTemplate(tenantId, templateId);

      if (!template) {
        throw new Error(`Template not found: ${templateId}`);
      }

      // Verify version belongs to this template
      const version = await templateVersionRepository.findById(versionId);

      if (!version || version.templateId !== templateId) {
        throw new Error(`Template version not found: ${versionId}`);
      }

      // Activate version
      const activated = await templateVersionRepository.activate(versionId, templateId);

      logger.info(
        { tenantId, templateId, versionId, version: activated.version },
        'Template version activated',
      );

      return activated;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(
        { error: errorMessage, tenantId, templateId, versionId: versionId },
        'Failed to activate template version',
      );
      throw error;
    }
  }

  /**
   * Get all templates for a tenant without pagination
   */
  async getAllTemplates(
    tenantId: string,
    filters?: {
      channel?: string;
      locale?: string;
      active?: boolean;
    },
  ): Promise<Template[]> {
    try {
      const result = await templateRepository.findMany(
        tenantId,
        {
          channel: filters?.channel,
          locale: filters?.locale,
          active: filters?.active,
        },
        10000, // High limit for all results
        0,
      );
      return result.data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage, tenantId }, 'Failed to get all templates');
      throw error;
    }
  }

  /**
   * Preview template rendering
   * Loads template and renders with provided variables
   */
  async previewTemplate(
    tenantId: string,
    templateCode: string,
    channel: string,
    locale: string,
    variables: Record<string, any>,
  ): Promise<RenderResult> {
    try {
      const template = await this.getTemplateByCode(tenantId, templateCode, channel, locale);

      if (!template) {
        throw new Error(`Template not found: ${templateCode} for channel ${channel}`);
      }

      if (!template.active) {
        throw new Error(`Template is inactive: ${templateCode}`);
      }

      // Render template
      return templateRenderer.render(template as any, variables);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(
        { error: errorMessage, tenantId, templateCode, channel },
        'Failed to preview template',
      );
      throw error;
    }
  }
}

export const templateService = new TemplateService();
