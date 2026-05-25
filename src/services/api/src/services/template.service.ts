import { logger } from '../config/logger';
import { templateRepository } from '../repositories/template.repository';
import { templateVersionRepository } from '../repositories/template-version.repository';
import { templateRenderer, RenderResult } from '../template/renderer';
import { extractRequiredVariables } from '../template/validators/template.validator';
import { getDefaultTemplate, hasDefaultTemplate, listDefaultTemplates as listDefaults } from '../templates';
import { parseTemplateRequest } from '../utils/template-parser';
import { accountRepository } from '../repositories/account.repository';

export interface Template {
  id: string;
  account_id: string;
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
  design_json?: any;
  editor_type?: 'visual' | 'code';
}

export interface UpdateTemplateRequest {
  subject?: string;
  content?: string;
  active?: boolean;
  description?: string;
  design_json?: any;
  editor_type?: 'visual' | 'code';
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
  async createTemplate(orgId: string, userId: string, request: CreateTemplateRequest): Promise<Template> {
    try {
      const account = await accountRepository.findAccountByOrganizationId(orgId);
      if (!account) {
        throw new Error('Organization account not found. Please contact support.');
      }
      const accountId = account.id;

      // Parse template request (extracts design_json from HTML comment and normalizes data)
      const parsedData = parseTemplateRequest({
        code: request.code,
        channel: request.channel,
        subject: request.subject,
        content: request.content,
        language: request.language,
        description: request.description,
        design_json: request.design_json,
        editor_type: request.editor_type,
      });

      // Create template in database with userId
      const template = await templateRepository.create(
        accountId,
        {
          code: parsedData.code,
          channel: parsedData.channel,
          subject: parsedData.subject,
          content: parsedData.content,
          language: parsedData.language,
          requiredVariables: parsedData.requiredVariables.length > 0 ? parsedData.requiredVariables : null,
          description: parsedData.description,
          design_json: parsedData.design_json,
          editor_type: parsedData.editor_type,
        },
        userId
      );

      // Create initial version (v1)
      await templateVersionRepository.create(template.id, 1, {
        subject: parsedData.subject,
        content: parsedData.content,
        requiredVariables: parsedData.requiredVariables.length > 0 ? parsedData.requiredVariables : null,
      });

      logger.info(
        { accountId: template.account_id, templateId: template.id, code: request.code, userId },
        'Template created with initial version'
      );

      return template;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage, orgId, code: request.code, userId }, 'Failed to create template');
      throw error;
    }
  }

  /**
   * Get template by ID
   */
  async getTemplate(tenantId: string, templateId: string): Promise<Template | null> {
    try {
      return await templateRepository.findById(tenantId, templateId);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage, tenantId, templateId }, 'Failed to get template');
      throw error;
    }
  }

  /**
   * Get template by code with locale fallback and default template fallback
   * Priority: 1) Database template 2) Default hardcoded template
   */
  async getTemplateByCode(
    tenantId: string,
    code: string,
    channel: string,
    locale: string = 'en'
  ): Promise<Template | null> {
    try {
      logger.debug({ tenantId, code, channel, locale }, 'Looking up template by code');

      // First, try to get template from database
      const template = await templateRepository.findByCodeWithFallback(tenantId, code, channel, locale);

      logger.debug({ found: !!template, active: template?.active, source: 'database' }, 'Template lookup result');

      if (template && template.active) {
        return template;
      }

      // Fallback to default template if database lookup fails
      if (hasDefaultTemplate(code)) {
        const defaultTemplate = getDefaultTemplate(code);
        if (defaultTemplate) {
          logger.info({ code, channel, source: 'default' }, 'Using default fallback template');

          // Convert default template to Template interface
          const fallbackTemplate: Template = {
            id: `default-${code}`,
            account_id: tenantId,
            code: defaultTemplate.code,
            channel: defaultTemplate.channel,
            content: defaultTemplate.html,
            language: locale,
            requiredVariables: defaultTemplate.requiredVariables,
            description: defaultTemplate.description,
            version: 0,
            active: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          return fallbackTemplate;
        }
      }

      return null;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage, tenantId, code, channel }, 'Failed to get template by code');
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
    }
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
        filters?.offset || 0
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
  async updateTemplate(tenantId: string, templateId: string, request: UpdateTemplateRequest): Promise<Template> {
    try {
      const template = await this.getTemplate(tenantId, templateId);

      if (!template) {
        throw new Error(`Template not found: ${templateId}`);
      }

      // If content is being updated, parse it to extract design_json and clean HTML
      const updateData: any = {
        subject: request.subject,
        description: request.description,
        design_json: request.design_json,
        editor_type: request.editor_type,
      };

      let requiredVariables: string[] | undefined;

      if (request.content !== undefined) {
        // Parse the content to extract design_json from embedded comment and clean HTML
        const parsedContent = parseTemplateRequest({
          code: template.code,
          channel: template.channel as any,
          subject: request.subject || template.subject,
          content: request.content,
          language: template.language,
          description: request.description || template.description,
          design_json: request.design_json,
          editor_type: request.editor_type,
        });

        updateData.content = parsedContent.content;
        updateData.design_json = parsedContent.design_json;
        updateData.editor_type = parsedContent.editor_type;
        requiredVariables = parsedContent.requiredVariables;
      }

      // Update template with all supported fields
      const updated = await templateRepository.update(tenantId, templateId, {
        ...updateData,
        requiredVariables: requiredVariables ? (requiredVariables.length > 0 ? requiredVariables : null) : undefined,
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
  async createVersion(tenantId: string, templateId: string, request: CreateVersionRequest): Promise<any> {
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

      logger.info({ tenantId, templateId, version: nextVersion }, 'Template version created');

      return version;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage, tenantId, templateId }, 'Failed to create template version');
      throw error;
    }
  }

  /**
   * Activate a specific version
   */
  async activateVersion(tenantId: string, templateId: string, versionId: string): Promise<any> {
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

      logger.info({ tenantId, templateId, versionId, version: activated.version }, 'Template version activated');

      return activated;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(
        { error: errorMessage, tenantId, templateId, versionId: versionId },
        'Failed to activate template version'
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
    }
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
        0
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
    variables: Record<string, any>
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
      logger.error({ error: errorMessage, tenantId, templateCode, channel }, 'Failed to preview template');
      throw error;
    }
  }

  /**
   * List all available default templates
   * Returns metadata for fallback templates
   */
  async listDefaultTemplates(): Promise<
    Array<{
      code: string;
      name: string;
      description: string;
      channel: string;
      requiredVariables: string[];
    }>
  > {
    try {
      const defaults = listDefaults();
      return defaults.map((template) => ({
        code: template.code,
        name: template.name,
        description: template.description,
        channel: template.channel,
        requiredVariables: template.requiredVariables,
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage }, 'Failed to list default templates');
      throw error;
    }
  }

  /**
   * Get a specific default template
   * Useful for preview or copying to database
   */
  async getDefaultTemplateByCode(code: string): Promise<Template | null> {
    try {
      const defaultTemplate = getDefaultTemplate(code);

      if (!defaultTemplate) {
        return null;
      }

      return {
        id: `default-${code}`,
        account_id: 'system',
        code: defaultTemplate.code,
        channel: defaultTemplate.channel,
        content: defaultTemplate.html,
        language: 'en',
        requiredVariables: defaultTemplate.requiredVariables,
        description: defaultTemplate.description,
        version: 0,
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage, code }, 'Failed to get default template');
      throw error;
    }
  }

  /**
   * Get all templates created by accounts in an organization
   */
  async getTemplatesByOrganization(organizationId: string): Promise<any[]> {
    try {
      return await templateRepository.findByOrganizationId(organizationId);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage, organizationId }, 'Failed to get templates for organization');
      throw error;
    }
  }

  /**
   * Duplicate a template with a new code
   * Only allows duplicating templates owned by the user
   */
  async duplicateTemplate(orgId: string, templateId: string, userId: string, newCode?: string): Promise<Template> {
    try {
      const account = await accountRepository.findAccountByOrganizationId(orgId);
      if (!account) {
        throw new Error('Organization account not found. Please contact support.');
      }
      const accountId = account.id;

      // Get the original template with ownership verification
      const original = await templateRepository.findById(accountId, templateId);
      if (!original || original.account_id !== accountId) {
        throw new Error('Template not found');
      }

      // Verify user owns the template
      if (original.created_by_user_id !== userId) {
        throw new Error('Template not found or not owned by user');
      }

      // Check if template is deleted
      if (original.deletedAt) {
        throw new Error('Cannot duplicate a deleted template');
      }

      // Generate new code if not provided
      let duplicateCode = newCode || `${original.code}_COPY`;

      // If no custom code provided, ensure uniqueness by adding timestamp
      if (!newCode) {
        const timestamp = Date.now().toString(36).toUpperCase();
        duplicateCode = `${original.code}_COPY_${timestamp}`;
      }

      // Create the duplicate template
      const duplicate = await templateRepository.create(
        accountId,
        {
          code: duplicateCode,
          channel: original.channel,
          subject: original.subject,
          content: original.content,
          language: original.language,
          requiredVariables: original.requiredVariables,
          description: original.description ? `Copy of ${original.description}` : `Copy of ${original.code}`,
          design_json: (original as any).design_json,
          editor_type: (original as any).editor_type,
        },
        userId
      );

      // Create initial version for duplicate
      await templateVersionRepository.create(duplicate.id, 1, {
        subject: original.subject,
        content: original.content,
        requiredVariables: original.requiredVariables,
      });

      logger.info(
        { originalId: templateId, duplicateId: duplicate.id, code: duplicateCode, userId },
        'Template duplicated'
      );

      return duplicate;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage, orgId, templateId, userId }, 'Failed to duplicate template');
      throw error;
    }
  }
}

export const templateService = new TemplateService();
