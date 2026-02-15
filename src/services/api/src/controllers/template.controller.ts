import { FastifyRequest, FastifyReply } from "fastify";
import { logger } from "../config/logger";
import {
  templateService,
  CreateTemplateRequest,
  UpdateTemplateRequest,
} from "../services/template.service";
import { tenantService } from "../services/tenant.service";
import { ApiResponseHelper } from "../utils";

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
        "Template created",
      );

      ApiResponseHelper.created(reply, "Template created successfully", {
        id: template.id,
        code: template.code,
        channel: template.channel,
        active: template.active,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      logger.error(
        { error: errorMessage, correlationId: request.id },
        "Failed to create template",
      );

      if (errorMessage.includes("already exists")) {
        ApiResponseHelper.duplicate(reply, errorMessage);
      }

      if (
        errorMessage.includes("Missing") ||
        errorMessage.includes("inactive")
      ) {
        ApiResponseHelper.unauthorized(reply, errorMessage);
      }

      ApiResponseHelper.badRequest(reply, errorMessage);
    }
  }

  async getTemplate(request: FastifyRequest, reply: FastifyReply) {
    try {
      const tenant = await tenantService.resolveTenant(request);
      const { id } = request.params as { id: string };

      const template = await templateService.getTemplate(tenant.id, id);

      if (!template) {
        return ApiResponseHelper.notFound(reply, "Template not found");
      }

      logger.debug(
        { templateId: id, correlationId: request.id },
        "Fetched template",
      );

      return ApiResponseHelper.success(reply, "Template retrieved", {
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
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      logger.error(
        { error: errorMessage, correlationId: request.id },
        "Failed to fetch template",
      );

      if (
        errorMessage.includes("Missing") ||
        errorMessage.includes("inactive")
      ) {
        ApiResponseHelper.unauthorized(reply, errorMessage);
      }

      ApiResponseHelper.badRequest(reply, errorMessage);
    }
  }

  async listTemplates(request: FastifyRequest, reply: FastifyReply) {
    try {
      const tenant = await tenantService.resolveTenant(request);
      const { channel, limit, offset } = request.query as {
        channel?: string;
        limit?: string;
        offset?: string;
      };

      const result = await templateService.listTemplates(tenant.id, {
        channel: channel as any,
        limit: limit ? parseInt(limit, 10) : 20,
        offset: offset ? parseInt(offset, 10) : 0,
      });

      logger.debug(
        {
          count: result.data.length,
          total: result.meta.total,
          correlationId: request.id,
        },
        "Listed templates",
      );

      ApiResponseHelper.success(reply, "Templates listed", {
        data: result.data.map((t) => ({
          id: t.id,
          code: t.code,
          channel: t.channel,
          subject: t.subject,
          language: t.language,
          active: t.active,
          createdAt: t.createdAt.toISOString(),
          updatedAt: t.updatedAt.toISOString(),
        })),
        meta: result.meta,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      logger.error(
        { error: errorMessage, correlationId: request.id },
        "Failed to list templates",
      );

      if (
        errorMessage.includes("Missing") ||
        errorMessage.includes("inactive")
      ) {
        ApiResponseHelper.unauthorized(reply, errorMessage);
      }

      ApiResponseHelper.badRequest(reply, errorMessage);
    }
  }

  async updateTemplate(request: FastifyRequest, reply: FastifyReply) {
    try {
      const tenant = await tenantService.resolveTenant(request);
      const { id } = request.params as { id: string };
      const body = request.body as UpdateTemplateRequest;

      const template = await templateService.updateTemplate(
        tenant.id,
        id,
        body,
      );

      logger.info(
        { templateId: id, correlationId: request.id },
        "Template updated",
      );

      ApiResponseHelper.updated(reply, "Template updated successfully", {
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
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      logger.error(
        { error: errorMessage, correlationId: request.id },
        "Failed to update template",
      );

      if (errorMessage.includes("not found")) {
        ApiResponseHelper.notFound(reply, errorMessage);
      }

      if (
        errorMessage.includes("Missing") ||
        errorMessage.includes("inactive")
      ) {
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

      logger.info(
        { templateId: id, correlationId: request.id },
        "Template deleted",
      );

      ApiResponseHelper.deleted(reply, "Template deleted successfully");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      logger.error(
        { error: errorMessage, correlationId: request.id },
        "Failed to delete template",
      );

      if (errorMessage.includes("not found")) {
        ApiResponseHelper.notFound(reply, errorMessage);
      }

      if (
        errorMessage.includes("Missing") ||
        errorMessage.includes("inactive")
      ) {
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
        "Template version created",
      );

      ApiResponseHelper.created(reply, "Template version created successfully", {
        id: version.id,
        version: version.version,
        isActive: version.isActive,
        createdAt: version.createdAt.toISOString(),
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      logger.error(
        { error: errorMessage, correlationId: request.id },
        "Failed to create template version",
      );

      if (errorMessage.includes("not found")) {
        ApiResponseHelper.notFound(reply, errorMessage);
      } else if (errorMessage.includes("Missing")) {
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

      const activated = await templateService.activateVersion(
        tenant.id,
        templateId,
        versionId,
      );

      logger.info(
        {
          templateId,
          versionId,
          version: activated.version,
          correlationId: request.id,
        },
        "Template version activated",
      );

      ApiResponseHelper.success(reply, "Template version activated successfully", {
        id: activated.id,
        version: activated.version,
        isActive: activated.isActive,
        createdAt: activated.createdAt.toISOString(),
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      logger.error(
        { error: errorMessage, correlationId: request.id },
        "Failed to activate template version",
      );

      if (errorMessage.includes("not found")) {
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
        body.locale || "en",
        body.variables || {},
      );

      logger.debug(
        {
          templateCode: body.templateCode,
          channel: body.channel,
          locale: body.locale,
          correlationId: request.id,
        },
        "Template preview rendered",
      );

      ApiResponseHelper.success(reply, "Template rendered successfully", {
        subject: result.subject,
        content: result.content,
        locale: result.locale,
        version: result.version,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      logger.error(
        { error: errorMessage, correlationId: request.id },
        "Failed to preview template",
      );

      if (errorMessage.includes("not found")) {
        ApiResponseHelper.notFound(reply, errorMessage);
      } else if (
        errorMessage.includes("Missing") ||
        errorMessage.includes("invalid")
      ) {
        ApiResponseHelper.badRequest(reply, errorMessage);
      } else if (errorMessage.includes("inactive")) {
        ApiResponseHelper.unauthorized(reply, errorMessage);
      } else {
        ApiResponseHelper.badRequest(reply, errorMessage);
      }
    }
  }

  async getAllTemplates(request: FastifyRequest, reply: FastifyReply) {
    try {
      const tenant = await tenantService.resolveTenant(request);
      const { channel } = request.query as {
        channel?: string;
      };

      const templates = await templateService.getAllTemplates(tenant.id, {
        channel: channel as any,
      });

      logger.debug(
        {
          count: templates.length,
          correlationId: request.id,
        },
        "Retrieved all templates",
      );

      ApiResponseHelper.success(reply, "All templates retrieved", {
        data: templates.map((t) => ({
          id: t.id,
          code: t.code,
          channel: t.channel,
          subject: t.subject,
          language: t.language,
          active: t.active,
          createdAt: t.createdAt.toISOString(),
          updatedAt: t.updatedAt.toISOString(),
        })),
        total: templates.length,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      logger.error(
        { error: errorMessage, correlationId: request.id },
        "Failed to get all templates",
      );

      if (
        errorMessage.includes("Missing") ||
        errorMessage.includes("inactive")
      ) {
        ApiResponseHelper.unauthorized(reply, errorMessage);
      }

      ApiResponseHelper.badRequest(reply, errorMessage);
    }
  }
}

export const templateController = new TemplateController();
