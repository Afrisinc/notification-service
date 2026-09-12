import { FastifyRequest, FastifyReply } from 'fastify';
import { logger } from '../config/logger';
import { adminAnalyticsService } from '../services/admin-analytics.service';
import { ApiResponseHelper } from '../utils/api-response';
import { InvalidDateRangeError } from '../utils/date-range';
import type { AnalyticsPeriod } from '../types/admin-analytics.types';

export class AdminAnalyticsController {
  async getOverview(request: FastifyRequest, reply: FastifyReply) {
    try {
      const query = request.query as Record<string, string | undefined>;

      const overview = await adminAnalyticsService.getOverview({
        period: query.period as AnalyticsPeriod | undefined,
        dateFrom: query.dateFrom,
        dateTo: query.dateTo,
      });

      return ApiResponseHelper.success(reply, 'Analytics overview retrieved successfully', overview);
    } catch (error) {
      if (error instanceof InvalidDateRangeError) {
        return ApiResponseHelper.badRequest(reply, error.message);
      }
      logger.error({ error }, 'Failed to get analytics overview');
      return ApiResponseHelper.internalError(reply, 'Failed to retrieve analytics overview');
    }
  }
}

export const adminAnalyticsController = new AdminAnalyticsController();
