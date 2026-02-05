import { logger } from '../config/logger';
import { Channel } from './notify.service';

export interface Template {
  id: string;
  tenantId: string;
  code: string;
  channel: Channel;
  subject?: string;
  content: string;
  language: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTemplateRequest {
  code: string;
  channel: Channel;
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

// Mock template repository
const templates: Map<string, Template> = new Map();

export class TemplateService {
  async createTemplate(tenantId: string, request: CreateTemplateRequest): Promise<Template> {
    // Validate unique code + tenant + channel
    const existing = Array.from(templates.values()).find(
      (t) => t.tenantId === tenantId && t.code === request.code && t.channel === request.channel
    );

    if (existing) {
      const error = new Error(
        `Template already exists: ${request.code} for channel ${request.channel}`
      );
      logger.warn({ tenantId, code: request.code, channel: request.channel }, error.message);
      throw error;
    }

    const template: Template = {
      id: generateId(),
      tenantId,
      code: request.code,
      channel: request.channel,
      subject: request.subject,
      content: request.content,
      language: request.language,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    templates.set(template.id, template);

    logger.info(
      { tenantId, templateId: template.id, code: request.code },
      'Template created'
    );

    return template;
  }

  async getTemplate(tenantId: string, templateId: string): Promise<Template | null> {
    const template = templates.get(templateId);

    if (!template) {
      return null;
    }

    if (template.tenantId !== tenantId) {
      return null;
    }

    return template;
  }

  async getTemplateByCode(
    tenantId: string,
    code: string,
    channel: Channel
  ): Promise<Template | null> {
    const template = Array.from(templates.values()).find(
      (t) => t.tenantId === tenantId && t.code === code && t.channel === channel && t.active
    );

    return template || null;
  }

  async updateTemplate(
    tenantId: string,
    templateId: string,
    request: UpdateTemplateRequest
  ): Promise<Template> {
    const template = await this.getTemplate(tenantId, templateId);

    if (!template) {
      const error = new Error(`Template not found: ${templateId}`);
      logger.warn({ tenantId, templateId }, 'Template not found');
      throw error;
    }

    if (request.subject !== undefined) {
      template.subject = request.subject;
    }

    if (request.content !== undefined) {
      template.content = request.content;
    }

    if (request.active !== undefined) {
      template.active = request.active;
    }

    template.updatedAt = new Date();
    templates.set(templateId, template);

    logger.info({ tenantId, templateId }, 'Template updated');

    return template;
  }

  async listTemplates(
    tenantId: string,
    filters?: {
      channel?: Channel;
      limit?: number;
      offset?: number;
    }
  ): Promise<{
    data: Template[];
    meta: { limit: number; offset: number; total: number };
  }> {
    const limit = Math.min(filters?.limit || 20, 100);
    const offset = filters?.offset || 0;

    let results = Array.from(templates.values()).filter((t) => t.tenantId === tenantId);

    if (filters?.channel) {
      results = results.filter((t) => t.channel === filters.channel);
    }

    const total = results.length;
    const data = results
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(offset, offset + limit);

    return {
      data,
      meta: { limit, offset, total },
    };
  }

  async deleteTemplate(tenantId: string, templateId: string): Promise<void> {
    const template = await this.getTemplate(tenantId, templateId);

    if (!template) {
      const error = new Error(`Template not found: ${templateId}`);
      logger.warn({ tenantId, templateId }, 'Template not found');
      throw error;
    }

    templates.delete(templateId);

    logger.info({ tenantId, templateId }, 'Template deleted');
  }
}

function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export const templateService = new TemplateService();
