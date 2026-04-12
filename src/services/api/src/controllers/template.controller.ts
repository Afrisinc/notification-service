import { FastifyRequest, FastifyReply } from 'fastify';
import { logger } from '../config/logger';
import { templateService, CreateTemplateRequest, UpdateTemplateRequest } from '../services/template.service';
import { UsageTrackingService } from '../services/usage-tracking.service';
import { templateAssetsService } from '../services/template-assets.service';
import { ApiResponseHelper } from '../utils';
import { appTemplateRepository } from '../repositories/template-installation.repository';
import { prismaRead, prismaWrite } from '@shared/database';

export class TemplateController {
  async createTemplate(request: FastifyRequest, reply: FastifyReply) {
    try {
      const accountId = request.headers['x-account-id'] as string;
      const userId = (request as any).user?.id;
      const body = request.body as CreateTemplateRequest;

      if (!accountId) {
        return ApiResponseHelper.unauthorized(reply, 'No account access');
      }

      if (!userId) {
        return ApiResponseHelper.unauthorized(reply, 'User information not found');
      }

      const template = await templateService.createTemplate(accountId, userId, body);

      logger.info(
        {
          templateId: template.id,
          code: template.code,
          correlationId: request.id,
        },
        'Template created'
      );

      // Track usage - templates don't have a specific appId at creation, so we track per account
      // This is tracked for the account's template count limit
      await UsageTrackingService.recordUsage(accountId, accountId, 'templates', 1);

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

  async getTemplateForEdit(request: FastifyRequest, reply: FastifyReply) {
    try {
      const accountId = request.headers['x-account-id'] as string;
      const userId = (request as any).user?.id;
      const { id } = request.params as { id: string };

      if (!accountId) {
        return ApiResponseHelper.unauthorized(reply, 'No account access');
      }

      if (!userId) {
        return ApiResponseHelper.unauthorized(reply, 'User information not found');
      }

      // Protected endpoint - get template for editing (includes inactive/drafts)
      const template = await prismaRead.template.findUnique({
        where: { id },
      });

      if (!template || template.account_id !== accountId || template.created_by_user_id !== userId) {
        return ApiResponseHelper.notFound(reply, 'Template not found or not owned by user');
      }

      if (template.deletedAt) {
        return ApiResponseHelper.notFound(reply, 'Template has been deleted');
      }

      logger.debug({ templateId: id, correlationId: request.id }, 'Fetched template for editing');

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

      return ApiResponseHelper.success(reply, 'Template retrieved for editing', {
        id: template.id,
        slug: template.code,
        name: template.subject || template.code,
        description: template.description,
        channel: template.channel,
        category: (template as any).category || 'MARKETING',
        author: 'You',
        isFree: true,
        variables: template.requiredVariables || [],
        subject: template.subject,
        content,
        language: template.language,
        version: template.version,
        active: template.active,
        designJson: (template as any).design_json,
        editorType: (template as any).editor_type || 'visual',
        // Marketplace fields
        visibility: (template as any).visibility || 'private',
        isPublic: (template as any).is_public,
        thumbnail: (template as any).thumbnail,
        previewImage: (template as any).previewUrl,
        tags: (template as any).tags || [],
        pricing: (template as any).pricing,
        price: (template as any).price,
        publishedAt: (template as any).publishedAt ? new Date((template as any).publishedAt).toISOString() : null,
        createdAt: template.createdAt.toISOString(),
        updatedAt: template.updatedAt.toISOString(),
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage, correlationId: request.id }, 'Failed to fetch template for editing');

      ApiResponseHelper.badRequest(reply, errorMessage);
    }
  }

  async getTemplate(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };

      // Public endpoint - get template by ID (active only)
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
        category: (template as any).category,
        author: 'Notify',
        isFree: true,
        variables: template.requiredVariables || [],
        subject: template.subject,
        content,
        language: template.language,
        version: template.version,
        active: template.active,
        designJson: (template as any).design_json,
        editorType: (template as any).editor_type || 'visual',
        // Marketplace fields
        visibility: (template as any).visibility || 'private',
        isPublic: (template as any).is_public,
        thumbnail: (template as any).thumbnail,
        previewImage: (template as any).previewUrl,
        tags: (template as any).tags || [],
        pricing: (template as any).pricing,
        price: (template as any).price,
        publishedAt: (template as any).publishedAt ? new Date((template as any).publishedAt).toISOString() : null,
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
          // Marketplace fields
          visibility: (t as any).visibility || 'private',
          isPublic: (t as any).is_public,
          thumbnail: (t as any).thumbnail,
          previewImage: (t as any).previewUrl,
          tags: (t as any).tags || [],
          pricing: (t as any).pricing,
          price: (t as any).price,
          publishedAt: (t as any).publishedAt ? new Date((t as any).publishedAt).toISOString() : null,
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
      const accountId = request.headers['x-account-id'] as string;
      const { id } = request.params as { id: string };
      const body = request.body as UpdateTemplateRequest;

      if (!accountId) {
        return ApiResponseHelper.unauthorized(reply, 'No account access');
      }

      const template = await templateService.updateTemplate(accountId, id, body);

      logger.info({ templateId: id, correlationId: request.id }, 'Template updated');

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

      ApiResponseHelper.updated(reply, 'Template updated successfully', {
        id: template.id,
        slug: template.code,
        name: template.subject || template.code,
        description: template.description,
        channel: template.channel,
        category: (template as any).category || 'MARKETING',
        author: 'Notify',
        isFree: true,
        variables: template.requiredVariables || [],
        subject: template.subject,
        content,
        language: template.language,
        version: template.version,
        active: template.active,
        designJson: (template as any).design_json,
        editorType: (template as any).editor_type || 'visual',
        // Marketplace fields
        visibility: (template as any).visibility || 'private',
        isPublic: (template as any).is_public,
        thumbnail: (template as any).thumbnail,
        previewImage: (template as any).previewUrl,
        tags: (template as any).tags || [],
        pricing: (template as any).pricing,
        price: (template as any).price,
        publishedAt: (template as any).publishedAt ? new Date((template as any).publishedAt).toISOString() : null,
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
      const accountId = request.headers['x-account-id'] as string;
      const { id } = request.params as { id: string };

      if (!accountId) {
        return ApiResponseHelper.unauthorized(reply, 'No account access');
      }

      await templateService.deleteTemplate(accountId, id);

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
      const accountId = request.headers['x-account-id'] as string;
      const { id: templateId } = request.params as { id: string };
      const body = request.body as any;

      if (!accountId) {
        return ApiResponseHelper.unauthorized(reply, 'No account access');
      }

      const version = await templateService.createVersion(accountId, templateId, {
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
      const accountId = request.headers['x-account-id'] as string;
      const { id: templateId, versionId } = request.params as {
        id: string;
        versionId: string;
      };

      if (!accountId) {
        return ApiResponseHelper.unauthorized(reply, 'No account access');
      }

      const activated = await templateService.activateVersion(accountId, templateId, versionId);

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
      const accountId = request.headers['x-account-id'] as string;
      const body = request.body as any;

      if (!accountId) {
        return ApiResponseHelper.unauthorized(reply, 'No account access');
      }

      const result = await templateService.previewTemplate(
        accountId,
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
          // Marketplace fields
          visibility: (t as any).visibility || 'private',
          isPublic: (t as any).is_public,
          thumbnail: (t as any).thumbnail,
          previewImage: (t as any).previewUrl,
          tags: (t as any).tags || [],
          pricing: (t as any).pricing,
          price: (t as any).price,
          publishedAt: (t as any).publishedAt ? new Date((t as any).publishedAt).toISOString() : null,
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
          // Marketplace fields
          visibility: (t as any).visibility || 'private',
          isPublic: (t as any).is_public,
          thumbnail: (t as any).thumbnail,
          previewImage: (t as any).previewUrl,
          tags: (t as any).tags || [],
          pricing: (t as any).pricing,
          price: (t as any).price,
          publishedAt: (t as any).publishedAt ? new Date((t as any).publishedAt).toISOString() : null,
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

  async getTemplatesByOrganization(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { orgId } = request.params as { orgId: string };

      if (!orgId) {
        return ApiResponseHelper.badRequest(reply, 'Organization ID is required');
      }

      const templates = await templateService.getTemplatesByOrganization(orgId);

      logger.debug(
        {
          organizationId: orgId,
          templateCount: templates.length,
          correlationId: request.id,
        },
        'Retrieved templates for organization'
      );

      ApiResponseHelper.successList(
        reply,
        'Organization templates retrieved',
        templates.map((t) => ({
          id: t.id,
          accountId: t.account_id,
          code: t.code,
          channel: t.channel,
          category: t.category,
          subject: t.subject,
          content: t.content,
          language: t.language,
          version: t.version,
          active: t.active,
          requiredVariables: t.requiredVariables || [],
          description: t.description,
          createdAt: t.createdAt,
          updatedAt: t.updatedAt,
        })),
        { total: templates.length }
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage, correlationId: request.id }, 'Failed to get organization templates');

      ApiResponseHelper.badRequest(reply, errorMessage);
    }
  }

  async listMyTemplates(request: FastifyRequest, reply: FastifyReply) {
    try {
      const accountId = request.headers['x-account-id'] as string;
      const userId = (request as any).user?.id;
      const { limit, offset } = request.query as { limit?: string; offset?: string };

      if (!accountId) {
        return ApiResponseHelper.unauthorized(reply, 'No account access');
      }

      if (!userId) {
        return ApiResponseHelper.unauthorized(reply, 'User information not found');
      }

      // Get user's templates
      const where: any = {
        account_id: accountId,
        created_by_user_id: userId,
        deletedAt: null,
      };

      const pageLimit = limit ? Math.min(parseInt(limit, 10), 100) : 20;
      const pageOffset = offset ? parseInt(offset, 10) : 0;

      const [templates, total] = await Promise.all([
        prismaRead.template.findMany({
          where,
          skip: pageOffset,
          take: pageLimit,
          orderBy: { createdAt: 'desc' },
        }),
        prismaRead.template.count({ where }),
      ]);

      logger.debug(
        {
          userId,
          accountId,
          count: templates.length,
          total,
          correlationId: request.id,
        },
        'Listed user templates'
      );

      ApiResponseHelper.successList(
        reply,
        'User templates retrieved',
        templates.map((t) => ({
          id: t.id,
          code: t.code,
          channel: t.channel,
          category: t.category,
          subject: t.subject,
          description: t.description,
          language: t.language,
          version: t.version,
          active: t.active,
          visibility: t.visibility || 'private',
          isPublic: t.is_public || false,
          thumbnail: (t as any).thumbnail,
          previewImage: (t as any).previewUrl,
          tags: (t as any).tags || [],
          pricing: (t as any).pricing,
          price: (t as any).price,
          publishedAt: (t as any).publishedAt ? new Date((t as any).publishedAt).toISOString() : null,
          rating: t.rating || 0,
          ratingCount: t.ratingCount || 0,
          installs: t.installs || 0,
          createdAt: t.createdAt.toISOString(),
          updatedAt: t.updatedAt.toISOString(),
        })),
        { limit: pageLimit, offset: pageOffset, total }
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage, correlationId: request.id }, 'Failed to list user templates');

      ApiResponseHelper.badRequest(reply, errorMessage);
    }
  }

  async publishTemplate(request: FastifyRequest, reply: FastifyReply) {
    try {
      const accountId = request.headers['x-account-id'] as string;
      const userId = (request as any).user?.id;
      const { id: templateId } = request.params as { id: string };

      if (!accountId) {
        return ApiResponseHelper.unauthorized(reply, 'No account access');
      }

      if (!userId) {
        return ApiResponseHelper.unauthorized(reply, 'User information not found');
      }

      // Verify template exists and belongs to user
      const template = await prismaRead.template.findUnique({
        where: { id: templateId },
      });

      if (!template || template.account_id !== accountId || template.created_by_user_id !== userId) {
        return ApiResponseHelper.notFound(reply, 'Template not found or not owned by user');
      }

      if (template.deletedAt) {
        return ApiResponseHelper.badRequest(reply, 'Cannot publish a deleted template');
      }

      // Parse request body - handle both multipart (file uploads) and JSON
      const isMultipart = request.isMultipart && request.isMultipart();
      let body: any = {};
      let thumbnailUrl: string | undefined;
      let previewImageUrl: string | undefined;
      let thumbnailBuffer: Buffer | undefined;
      let previewImageBuffer: Buffer | undefined;

      if (isMultipart) {
        // Parse multipart form data
        logger.debug({ templateId, templateCode: template.code }, 'Processing multipart form data');

        try {
          const parts = request.parts();

          for await (const part of parts) {
            if (part.type === 'file') {
              // Handle file fields
              if (part.fieldname === 'previewImage') {
                logger.debug({ templateId }, 'Received previewImage file');
                previewImageBuffer = await this.streamToBuffer(part.file);
              } else if (part.fieldname === 'thumbnail') {
                logger.debug({ templateId }, 'Received thumbnail file');
                thumbnailBuffer = await this.streamToBuffer(part.file);
              }
            } else {
              // Handle text fields
              const value = part.value as string;
              if (part.fieldname === 'tags') {
                // Tags come as JSON string from FormData
                try {
                  body.tags = JSON.parse(value);
                } catch {
                  body.tags = [];
                }
              } else {
                body[part.fieldname] = value;
              }
            }
          }

          // Upload assets if we have file buffers
          if (thumbnailBuffer || previewImageBuffer) {
            try {
              const assetUrls = await templateAssetsService.uploadTemplateAssets({
                thumbnail: thumbnailBuffer,
                previewImage: previewImageBuffer,
                accountId,
                templateId,
                templateCode: template.code,
              });

              // Debug: Check what service returned
              logger.debug(
                {
                  templateId,
                  returned: JSON.stringify(assetUrls),
                  thumbnail: assetUrls.thumbnail ? 'HAS_URL' : 'MISSING',
                  previewImage: assetUrls.previewImage ? 'HAS_URL' : 'MISSING',
                },
                'Asset URLs returned from service'
              );

              // Use uploaded URLs
              if (assetUrls.thumbnail) {
                thumbnailUrl = assetUrls.thumbnail;
              }
              if (assetUrls.previewImage) {
                previewImageUrl = assetUrls.previewImage;
              }

              logger.info(
                { templateId, hasThumbnail: !!thumbnailUrl, hasPreviewImage: !!previewImageUrl },
                'Assets uploaded successfully'
              );
            } catch (uploadError) {
              logger.warn(
                { templateId, error: uploadError instanceof Error ? uploadError.message : uploadError },
                'Asset upload failed, continuing without assets'
              );
            }
          }
        } catch (parseError) {
          logger.error(
            { templateId, error: parseError instanceof Error ? parseError.message : parseError },
            'Failed to parse multipart form data'
          );
          return ApiResponseHelper.badRequest(reply, 'Failed to parse form data');
        }
      } else {
        // Parse JSON body
        body = request.body as any;
        thumbnailUrl = body.thumbnail;
        previewImageUrl = body.previewImage;
      }

      // Validate pricing: if "paid" is selected, price is required
      if (body.pricing === 'paid' && (!body.price || body.price <= 0)) {
        return ApiResponseHelper.badRequest(reply, 'Price is required for paid templates and must be greater than 0');
      }

      // Convert price from USD to cents (if provided)
      const priceInCents = body.price ? Math.round(body.price * 100) : null;

      // Build update data
      const updateData: any = {
        visibility: 'marketplace',
        is_public: true,
        description: body.description !== undefined ? body.description : template.description,
        tags: body.tags && body.tags.length > 0 ? body.tags : template.tags,
      };

      // Include thumbnail URL (from assets or provided URL)
      // Always save if we have a URL - prefer newly uploaded, fall back to provided
      if (thumbnailUrl) {
        updateData.thumbnail = thumbnailUrl;
      }

      // Include previewUrl (from assets or provided URL)
      // Always save if we have a URL - prefer newly uploaded, fall back to provided
      if (previewImageUrl) {
        updateData.previewUrl = previewImageUrl;
      }

      // Update category if provided (normalize to uppercase)
      if (body.category) {
        const categoryUpper = body.category.toUpperCase();
        const validCategories = ['AUTH', 'TRANSACTIONAL', 'MARKETING', 'NOTIFICATION'];
        if (!validCategories.includes(categoryUpper)) {
          return ApiResponseHelper.badRequest(reply, `Invalid category. Must be one of: ${validCategories.join(', ')}`);
        }
        updateData.category = categoryUpper;
      }

      // Update pricing information
      if (body.pricing) {
        updateData.price = body.pricing === 'paid' ? priceInCents : null;
      }

      // Log what we're saving
      logger.debug(
        {
          templateId,
          thumbnail: updateData.thumbnail ? '✓ set' : '✗ empty',
          previewUrl: updateData.previewUrl ? '✓ set' : '✗ empty',
          description: updateData.description ? '✓ set' : '✗ empty',
          tags: updateData.tags.length > 0 ? `✓ ${updateData.tags.length} tags` : '✗ empty',
          category: updateData.category || '✗ not updated',
          pricing: body.pricing || 'free',
        },
        'Saving template data to database'
      );

      // Publish template to marketplace
      const published = await prismaWrite.template.update({
        where: { id: templateId },
        data: updateData,
      });

      logger.info(
        {
          templateId,
          userId,
          accountId,
          visibility: published.visibility,
          pricing: body.pricing || 'free',
          thumbnail: published.thumbnail ? '✓ saved' : '✗ null',
          previewUrl: published.previewUrl ? '✓ saved' : '✗ null',
          correlationId: request.id,
        },
        'Template published to marketplace'
      );

      ApiResponseHelper.success(reply, 'Template published to marketplace successfully', {
        id: published.id,
        code: published.code,
        title: body.title || published.code,
        channel: published.channel,
        category: published.category,
        description: published.description,
        visibility: published.visibility,
        isPublic: published.is_public,
        pricing: body.pricing || 'free',
        price: body.price || 0,
        tags: published.tags,
        thumbnail: published.thumbnail,
        previewImage: published.previewUrl,
        publishedAt: new Date().toISOString(),
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage, correlationId: request.id }, 'Failed to publish template');

      if (errorMessage.includes('not found') || errorMessage.includes('No record to update')) {
        ApiResponseHelper.notFound(reply, errorMessage);
      } else {
        ApiResponseHelper.badRequest(reply, errorMessage);
      }
    }
  }

  /**
   * Convert readable stream to buffer
   * @private
   */
  private async streamToBuffer(stream: any): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
  }

  async unpublishTemplate(request: FastifyRequest, reply: FastifyReply) {
    try {
      const accountId = request.headers['x-account-id'] as string;
      const userId = (request as any).user?.id;
      const { id: templateId } = request.params as { id: string };

      if (!accountId) {
        return ApiResponseHelper.unauthorized(reply, 'No account access');
      }

      if (!userId) {
        return ApiResponseHelper.unauthorized(reply, 'User information not found');
      }

      // Verify template exists and belongs to user
      const template = await prismaRead.template.findUnique({
        where: { id: templateId },
      });

      if (!template || template.account_id !== accountId || template.created_by_user_id !== userId) {
        return ApiResponseHelper.notFound(reply, 'Template not found or not owned by user');
      }

      if (template.deletedAt) {
        return ApiResponseHelper.badRequest(reply, 'Cannot unpublish a deleted template');
      }

      // Unpublish template from marketplace
      const unpublished = await prismaWrite.template.update({
        where: { id: templateId },
        data: {
          visibility: 'private',
          is_public: false,
        },
      });

      logger.info(
        {
          templateId,
          userId,
          accountId,
          correlationId: request.id,
        },
        'Template unpublished from marketplace'
      );

      ApiResponseHelper.success(reply, 'Template unpublished from marketplace', {
        id: unpublished.id,
        code: unpublished.code,
        channel: unpublished.channel,
        visibility: unpublished.visibility,
        isPublic: unpublished.is_public,
        thumbnail: (unpublished as any).thumbnail,
        previewImage: (unpublished as any).previewUrl,
        tags: (unpublished as any).tags,
        pricing: (unpublished as any).pricing,
        price: (unpublished as any).price,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage, correlationId: request.id }, 'Failed to unpublish template');

      if (errorMessage.includes('not found')) {
        ApiResponseHelper.notFound(reply, errorMessage);
      } else {
        ApiResponseHelper.badRequest(reply, errorMessage);
      }
    }
  }
}

export const templateController = new TemplateController();
