import { FastifyRequest, FastifyReply } from 'fastify';
import { logger } from '../config/logger';
import { templateService, CreateTemplateRequest, UpdateTemplateRequest } from '../services/template.service';
import { tenantService } from '../services/tenant.service';
import { ApiResponseHelper } from '../utils';
import { appTemplateRepository } from '../repositories/template-installation.repository';
import { prismaRead } from '@shared/database';

export class TemplateController {
  async createTemplate(request: FastifyRequest, reply: FastifyReply) {
    try {
      const tenant = await tenantService.resolveTenant(request);
      const body = request.body as CreateTemplateRequest;

      const template = await templateService.createTemplate(tenant.id, body);

      logger.info(
        {
          templateId: template.id,
          code: template.code,
          correlationId: request.id,
        },
        'Template created'
      );

      ApiResponseHelper.created(reply, 'Template created successfully', {
        id: template.id,
        code: template.code,
        channel: template.channel,
        active: template.active,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage, correlationId: request.id }, 'Failed to create template');

      if (errorMessage.includes('already exists')) {
        ApiResponseHelper.duplicate(reply, errorMessage);
      }

      if (errorMessage.includes('Missing') || errorMessage.includes('inactive')) {
        ApiResponseHelper.unauthorized(reply, errorMessage);
      }

      ApiResponseHelper.badRequest(reply, errorMessage);
    }
  }

  async getTemplate(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };

      // Public endpoint - get template by ID
      const template = await prismaRead.template.findUnique({
        where: { id },
      });

      if (!template || !template.active || template.deletedAt) {
        return ApiResponseHelper.notFound(reply, 'Template not found');
      }

      logger.debug({ templateId: id, correlationId: request.id }, 'Fetched template');

      // Reconstruct content based on channel type
      let content: any = null;
      if (template.content) {
        if (template.channel === 'EMAIL') {
          content = {
            email: {
              subject: template.subject,
              html: template.content,
            },
          };
        } else if (template.channel === 'SMS') {
          content = {
            sms: {
              body: template.content,
            },
          };
        }
      }

      return ApiResponseHelper.success(reply, 'Template retrieved', {
        id: template.id,
        slug: template.code,
        name: template.subject || template.code,
        description: template.description,
        channel: template.channel,
        category: template.category,
        author: 'Notify',
        isFree: true,
        variables: template.requiredVariables || [],
        subject: template.subject,
        content,
        language: template.language,
        version: template.version,
        active: template.active,
        createdAt: template.createdAt.toISOString(),
        updatedAt: template.updatedAt.toISOString(),
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage, correlationId: request.id }, 'Failed to fetch template');

      ApiResponseHelper.badRequest(reply, errorMessage);
    }
  }

  async listTemplates(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { channel, category, search, limit, offset } = request.query as {
        channel?: string;
        category?: string;
        search?: string;
        limit?: string;
        offset?: string;
      };

      // Public endpoint - list all active templates with filtering
      const where: any = {
        active: true,
        deletedAt: null,
      };

      if (channel && channel !== 'all') {
        where.channel = channel.toUpperCase();
      }

      if (category && category !== 'all') {
        where.category = category.toUpperCase();
      }

      if (search) {
        where.OR = [
          { code: { contains: search, mode: 'insensitive' } },
          { subject: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ];
      }

      const [templates, total] = await Promise.all([
        prismaRead.template.findMany({
          where,
          skip: offset ? parseInt(offset, 10) : 0,
          take: limit ? parseInt(limit, 10) : 20,
          orderBy: { createdAt: 'desc' },
        }),
        prismaRead.template.count({ where }),
      ]);

      logger.debug(
        {
          count: templates.length,
          total,
          channel: channel || 'all',
          category: category || 'all',
          correlationId: request.id,
        },
        'Listed templates'
      );

      const pageLimit = limit ? parseInt(limit, 10) : 20;
      const pageOffset = offset ? parseInt(offset, 10) : 0;

      ApiResponseHelper.successList(
        reply,
        'Templates listed',
        templates.map((t) => ({
          id: t.id,
          slug: t.code,
          name: t.subject || t.code,
          description: t.description,
          channel: t.channel,
          category: t.category,
          author: 'Notify',
          isFree: true,
          variables: t.requiredVariables || [],
          subject: t.subject,
          content: t.content,
          language: t.language || 'en',
          version: t.version,
          active: t.active,
          createdAt: t.createdAt,
          updatedAt: t.updatedAt,
        })),
        {
          limit: pageLimit,
          offset: pageOffset,
          total,
        }
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage, correlationId: request.id }, 'Failed to list templates');

      ApiResponseHelper.badRequest(reply, errorMessage);
    }
  }

  async updateTemplate(request: FastifyRequest, reply: FastifyReply) {
    try {
      const tenant = await tenantService.resolveTenant(request);
      const { id } = request.params as { id: string };
      const body = request.body as UpdateTemplateRequest;

      const template = await templateService.updateTemplate(tenant.id, id, body);

      logger.info({ templateId: id, correlationId: request.id }, 'Template updated');

      ApiResponseHelper.updated(reply, 'Template updated successfully', {
        id: template.id,
        code: template.code,
        channel: template.channel,
        subject: template.subject,
        content: template.content,
        language: template.language,
        active: template.active,
        createdAt: template.createdAt.toISOString(),
        updatedAt: template.updatedAt.toISOString(),
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage, correlationId: request.id }, 'Failed to update template');

      if (errorMessage.includes('not found')) {
        ApiResponseHelper.notFound(reply, errorMessage);
      }

      if (errorMessage.includes('Missing') || errorMessage.includes('inactive')) {
        ApiResponseHelper.unauthorized(reply, errorMessage);
      }

      ApiResponseHelper.badRequest(reply, errorMessage);
    }
  }

  async deleteTemplate(request: FastifyRequest, reply: FastifyReply) {
    try {
      const tenant = await tenantService.resolveTenant(request);
      const { id } = request.params as { id: string };

      await templateService.deleteTemplate(tenant.id, id);

      logger.info({ templateId: id, correlationId: request.id }, 'Template deleted');

      ApiResponseHelper.deleted(reply, 'Template deleted successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage, correlationId: request.id }, 'Failed to delete template');

      if (errorMessage.includes('not found')) {
        ApiResponseHelper.notFound(reply, errorMessage);
      }

      if (errorMessage.includes('Missing') || errorMessage.includes('inactive')) {
        ApiResponseHelper.unauthorized(reply, errorMessage);
      }

      ApiResponseHelper.badRequest(reply, errorMessage);
    }
  }

  async createVersion(request: FastifyRequest, reply: FastifyReply) {
    try {
      const tenant = await tenantService.resolveTenant(request);
      const { id: templateId } = request.params as { id: string };
      const body = request.body as any;

      const version = await templateService.createVersion(tenant.id, templateId, {
        subject: body.subject,
        content: body.content,
        createdBy: body.createdBy,
      });

      logger.info(
        {
          templateId,
          version: version.version,
          correlationId: request.id,
        },
        'Template version created'
      );

      ApiResponseHelper.created(reply, 'Template version created successfully', {
        id: version.id,
        version: version.version,
        isActive: version.isActive,
        createdAt: version.createdAt.toISOString(),
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage, correlationId: request.id }, 'Failed to create template version');

      if (errorMessage.includes('not found')) {
        ApiResponseHelper.notFound(reply, errorMessage);
      } else if (errorMessage.includes('Missing')) {
        ApiResponseHelper.badRequest(reply, errorMessage);
      } else {
        ApiResponseHelper.badRequest(reply, errorMessage);
      }
    }
  }

  async activateVersion(request: FastifyRequest, reply: FastifyReply) {
    try {
      const tenant = await tenantService.resolveTenant(request);
      const { id: templateId, versionId } = request.params as {
        id: string;
        versionId: string;
      };

      const activated = await templateService.activateVersion(tenant.id, templateId, versionId);

      logger.info(
        {
          templateId,
          versionId,
          version: activated.version,
          correlationId: request.id,
        },
        'Template version activated'
      );

      ApiResponseHelper.success(reply, 'Template version activated successfully', {
        id: activated.id,
        version: activated.version,
        isActive: activated.isActive,
        createdAt: activated.createdAt.toISOString(),
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage, correlationId: request.id }, 'Failed to activate template version');

      if (errorMessage.includes('not found')) {
        ApiResponseHelper.notFound(reply, errorMessage);
      } else {
        ApiResponseHelper.badRequest(reply, errorMessage);
      }
    }
  }

  async previewTemplate(request: FastifyRequest, reply: FastifyReply) {
    try {
      const tenant = await tenantService.resolveTenant(request);
      const body = request.body as any;

      const result = await templateService.previewTemplate(
        tenant.id,
        body.templateCode,
        body.channel,
        body.locale || 'en',
        body.variables || {}
      );

      logger.debug(
        {
          templateCode: body.templateCode,
          channel: body.channel,
          locale: body.locale,
          correlationId: request.id,
        },
        'Template preview rendered'
      );

      ApiResponseHelper.success(reply, 'Template rendered successfully', {
        subject: result.subject,
        content: result.content,
        locale: result.locale,
        version: result.version,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage, correlationId: request.id }, 'Failed to preview template');

      if (errorMessage.includes('not found')) {
        ApiResponseHelper.notFound(reply, errorMessage);
      } else if (errorMessage.includes('Missing') || errorMessage.includes('invalid')) {
        ApiResponseHelper.badRequest(reply, errorMessage);
      } else if (errorMessage.includes('inactive')) {
        ApiResponseHelper.unauthorized(reply, errorMessage);
      } else {
        ApiResponseHelper.badRequest(reply, errorMessage);
      }
    }
  }

  async getAllTemplates(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { channel } = request.query as {
        channel?: string;
      };

      // Public endpoint - get all active templates across all tenants
      const where: any = {
        active: true,
        deletedAt: null,
      };

      if (channel && channel !== 'all') {
        where.channel = channel.toUpperCase();
      }

      const templates = await prismaRead.template.findMany({
        where,
        orderBy: { createdAt: 'desc' },
      });

      logger.debug(
        {
          count: templates.length,
          channel: channel || 'all',
          correlationId: request.id,
        },
        'Retrieved all templates'
      );

      ApiResponseHelper.successList(
        reply,
        'All templates retrieved',
        templates.map((t) => ({
          id: t.id,
          slug: t.code,
          name: t.subject || t.code,
          description: t.description,
          channel: t.channel,
          category: t.category,
          author: 'Notify',
          isFree: true,
          variables: t.requiredVariables || [],
          subject: t.subject,
          content: t.content,
          language: t.language || 'en',
          version: t.version,
          active: t.active,
          createdAt: t.createdAt,
          updatedAt: t.updatedAt,
        })),
        { total: templates.length }
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage, correlationId: request.id }, 'Failed to get all templates');

      ApiResponseHelper.badRequest(reply, errorMessage);
    }
  }

  async searchTemplates(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { q, limit, offset } = request.query as {
        q?: string;
        limit?: string;
        offset?: string;
      };

      if (!q) {
        return ApiResponseHelper.badRequest(reply, 'Search query (q) is required');
      }

      // Search across all tenants' public templates
      const templates = await prismaRead.template.findMany({
        where: {
          active: true,
          deletedAt: null,
          OR: [
            { code: { contains: q, mode: 'insensitive' } },
            { subject: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
          ],
        },
        skip: offset ? parseInt(offset, 10) : 0,
        take: limit ? parseInt(limit, 10) : 20,
        orderBy: { createdAt: 'desc' },
      });

      const total = await prismaRead.template.count({
        where: {
          active: true,
          deletedAt: null,
          OR: [
            { code: { contains: q, mode: 'insensitive' } },
            { subject: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
          ],
        },
      });

      logger.debug(
        {
          query: q,
          count: templates.length,
          total,
          correlationId: request.id,
        },
        'Searched templates'
      );

      ApiResponseHelper.successList(
        reply,
        'Templates search results',
        templates.map((t) => ({
          id: t.id,
          slug: t.code,
          name: t.subject || t.code,
          description: t.description,
          channel: t.channel,
          category: t.category,
          author: 'Notify',
          isFree: true,
          variables: t.requiredVariables || [],
        })),
        { total }
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage, correlationId: request.id }, 'Failed to search templates');

      ApiResponseHelper.badRequest(reply, errorMessage);
    }
  }

  async installTemplate(request: FastifyRequest, reply: FastifyReply) {
    try {
      const accountId = request.headers['x-account-id'] as string;
      const { id: templateId } = request.params as { id: string };
      const body = request.body as {
        app_id: string;
        customizations?: any;
      };

      if (!body.app_id) {
        return ApiResponseHelper.badRequest(reply, 'app_id is required');
      }

      // Verify app exists and belongs to account
      const app = await prismaRead.app.findUnique({
        where: { id: body.app_id },
      });
      if (!app || app.account_id !== accountId) {
        return ApiResponseHelper.notFound(reply, 'App not found');
      }

      // Verify template exists and belongs to account
      const template = await prismaRead.template.findUnique({
        where: { id: templateId },
      });
      if (!template || template.account_id !== accountId) {
        return ApiResponseHelper.notFound(reply, 'Template not found');
      }

      // Check if already installed
      const existing = await appTemplateRepository.findByAppAndTemplate(body.app_id, templateId);
      if (existing) {
        return ApiResponseHelper.duplicate(reply, 'Template already installed in this app');
      }

      // Create installation
      const installation = await appTemplateRepository.create({
        app_id: body.app_id,
        template_id: templateId,
        customizations: body.customizations,
      });

      logger.info(
        {
          installationId: installation.id,
          templateId,
          app_id: body.app_id,
          correlationId: request.id,
        },
        'Template installed'
      );

      ApiResponseHelper.created(reply, 'Template installed successfully', {
        installationId: installation.id,
        templateId,
        app_id: body.app_id,
        installedAt: installation.installationDate.toISOString(),
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage, correlationId: request.id }, 'Failed to install template');

      ApiResponseHelper.badRequest(reply, errorMessage);
    }
  }

  async getInstallationStatus(request: FastifyRequest, reply: FastifyReply) {
    try {
      const accountId = request.headers['x-account-id'] as string;
      const { id: templateId } = request.params as { id: string };

      // Verify template exists and belongs to account
      const template = await prismaRead.template.findUnique({
        where: { id: templateId },
      });
      if (!template || template.account_id !== accountId) {
        return ApiResponseHelper.notFound(reply, 'Template not found');
      }

      // Get all app installations for this template in the account
      const installations = await appTemplateRepository.findByTemplateId(templateId);

      // Filter only apps belonging to this account
      const accountAppIds = (
        await prismaRead.app.findMany({
          where: { account_id: accountId },
          select: { id: true },
        })
      ).map((a) => a.id);

      const filteredInstallations = installations.filter((i) => accountAppIds.includes(i.app_id));

      logger.debug(
        {
          templateId,
          installationCount: filteredInstallations.length,
          correlationId: request.id,
        },
        'Retrieved installation status'
      );

      ApiResponseHelper.success(reply, 'Installation status retrieved', {
        templateId,
        installed: filteredInstallations.length > 0,
        installations: filteredInstallations.map((i) => ({
          installationId: i.id,
          app_id: i.app_id,
          installedAt: i.installationDate.toISOString(),
        })),
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage, correlationId: request.id }, 'Failed to get installation status');

      ApiResponseHelper.badRequest(reply, errorMessage);
    }
  }

  async getTemplateAnalytics(request: FastifyRequest, reply: FastifyReply) {
    try {
      const accountId = request.headers['x-account-id'] as string;
      const { id: templateId } = request.params as { id: string };

      // Verify template exists and belongs to account
      const template = await prismaRead.template.findUnique({
        where: { id: templateId },
      });
      if (!template || template.account_id !== accountId) {
        return ApiResponseHelper.notFound(reply, 'Template not found');
      }

      // Count total installations
      const totalInstallations = await appTemplateRepository.countByTemplate(templateId);

      // Count unique apps
      const uniqueApps = await prismaRead.appTemplate.findMany({
        where: { template_id: templateId },
        select: { app_id: true },
        distinct: ['app_id'],
      });

      logger.debug(
        {
          templateId,
          totalInstallations,
          uniqueApps: uniqueApps.length,
          correlationId: request.id,
        },
        'Retrieved template analytics'
      );

      ApiResponseHelper.success(reply, 'Template analytics retrieved', {
        templateId,
        totalInstallations,
        activeApps: uniqueApps.length,
        averageRating: 5.0,
        monthlyGrowth: 0,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage, correlationId: request.id }, 'Failed to get template analytics');

      ApiResponseHelper.badRequest(reply, errorMessage);
    }
  }
}

export const templateController = new TemplateController();
