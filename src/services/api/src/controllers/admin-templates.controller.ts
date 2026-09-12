import { FastifyRequest, FastifyReply } from 'fastify';
import { logger } from '../config/logger';
import { adminTemplatesService } from '../services/admin-templates.service';
import { ApiResponseHelper } from '../utils/api-response';
import type { AdminTemplateChannel, AdminTemplateStatus } from '../types/admin-templates.types';

export class AdminTemplatesController {
  async getTemplates(request: FastifyRequest, reply: FastifyReply) {
    try {
      const query = request.query as Record<string, string | undefined>;

      const result = await adminTemplatesService.listTemplates({
        limit: query.limit ? Number.parseInt(query.limit, 10) : undefined,
        offset: query.offset ? Number.parseInt(query.offset, 10) : undefined,
        search: query.search,
        channel: query.channel as AdminTemplateChannel | undefined,
        status: query.status as AdminTemplateStatus | undefined,
      });

      return ApiResponseHelper.successList(reply, 'Templates retrieved successfully', result.data, result.meta);
    } catch (error) {
      logger.error({ error }, 'Failed to get admin templates');
      return ApiResponseHelper.internalError(reply, 'Failed to retrieve templates');
    }
  }

  async getStats(request: FastifyRequest, reply: FastifyReply) {
    try {
      const stats = await adminTemplatesService.getStats();
      return ApiResponseHelper.success(reply, 'Template stats retrieved successfully', stats);
    } catch (error) {
      logger.error({ error }, 'Failed to get admin template stats');
      return ApiResponseHelper.internalError(reply, 'Failed to retrieve template stats');
    }
  }
}

export const adminTemplatesController = new AdminTemplatesController();
