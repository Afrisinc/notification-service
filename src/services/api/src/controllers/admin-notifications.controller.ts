import { FastifyRequest, FastifyReply } from 'fastify';
import { logger } from '../config/logger';
import { adminNotificationsService } from '../services/admin-notifications.service';
import { ApiResponseHelper } from '../utils/api-response';
import { InvalidDateRangeError } from '../utils/date-range';
import type {
  AdminNotificationChannel,
  AdminNotificationPeriod,
  AdminNotificationStatus,
} from '../types/admin-notifications.types';

export class AdminNotificationsController {
  async getNotifications(request: FastifyRequest, reply: FastifyReply) {
    try {
      const query = request.query as Record<string, string | undefined>;

      const result = await adminNotificationsService.listNotifications({
        limit: query.limit ? Number.parseInt(query.limit, 10) : undefined,
        offset: query.offset ? Number.parseInt(query.offset, 10) : undefined,
        search: query.search,
        channel: query.channel as AdminNotificationChannel | undefined,
        status: query.status as AdminNotificationStatus | undefined,
        period: query.period as AdminNotificationPeriod | undefined,
        dateFrom: query.dateFrom,
        dateTo: query.dateTo,
      });

      return ApiResponseHelper.successList(reply, 'Notifications retrieved successfully', result.data, result.meta);
    } catch (error) {
      if (error instanceof InvalidDateRangeError) {
        return ApiResponseHelper.badRequest(reply, error.message);
      }
      logger.error({ error }, 'Failed to get admin notifications');
      return ApiResponseHelper.internalError(reply, 'Failed to retrieve notifications');
    }
  }

  async getStats(request: FastifyRequest, reply: FastifyReply) {
    try {
      const query = request.query as Record<string, string | undefined>;

      const stats = await adminNotificationsService.getStats({
        period: query.period as AdminNotificationPeriod | undefined,
        dateFrom: query.dateFrom,
        dateTo: query.dateTo,
      });

      return ApiResponseHelper.success(reply, 'Notification stats retrieved successfully', stats);
    } catch (error) {
      if (error instanceof InvalidDateRangeError) {
        return ApiResponseHelper.badRequest(reply, error.message);
      }
      logger.error({ error }, 'Failed to get admin notification stats');
      return ApiResponseHelper.internalError(reply, 'Failed to retrieve notification stats');
    }
  }
}

export const adminNotificationsController = new AdminNotificationsController();
