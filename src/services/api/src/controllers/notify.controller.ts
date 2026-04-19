import { FastifyRequest, FastifyReply } from 'fastify';
import { logger } from '../config/logger';
import { notifyService, SendNotificationRequest, BulkSendRequest } from '../services/notify.service';
import { UsageTrackingService } from '../services/usage-tracking.service';
import { ApiResponseHelper } from '../utils';

export class NotifyController {
  async sendNotification(request: FastifyRequest, reply: FastifyReply) {
    try {
      const body = request.body as SendNotificationRequest;
      const accountId = request.headers['x-account-id'] as string;

      if (!accountId) {
        return ApiResponseHelper.unauthorized(reply, 'No account access');
      }

      if (!body.app_id) {
        return ApiResponseHelper.badRequest(reply, 'app_id is required in request body');
      }

      const notification = await notifyService.sendNotification(accountId, body.app_id, body);

      logger.info({ notificationId: notification.id, correlationId: request.id }, 'Notification sent successfully');

      // Track usage
      const metric = `${body.channel.toLowerCase()}s_per_month`;
      await UsageTrackingService.recordUsage(accountId, body.app_id, metric, 1);

      ApiResponseHelper.accepted(reply, 'Notification queued for processing', {
        id: notification.id,
        status: notification.status,
        channel: body.channel,
        created_at: notification.createdAt,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage, correlationId: request.id }, 'Failed to send notification');

      if (errorMessage.includes('not found')) {
        return ApiResponseHelper.notFound(reply, errorMessage);
      }

      if (errorMessage.includes('Missing') || errorMessage.includes('inactive')) {
        return ApiResponseHelper.unauthorized(reply, errorMessage);
      }

      return ApiResponseHelper.badRequest(reply, errorMessage);
    }
  }

  async sendNotificationWithKey(request: FastifyRequest, reply: FastifyReply) {
    try {
      const body = request.body as Omit<SendNotificationRequest, 'app_id'>;
      const accountId = request.headers['x-account-id'] as string;

      if (!accountId) {
        return ApiResponseHelper.unauthorized(reply, 'Invalid API key');
      }

      // Extract app_id from request context (set by apiKeyRepository query)
      // Need to fetch from API key data
      const apiKeyId = request.headers['x-api-key-id'] as string;
      if (!apiKeyId) {
        return ApiResponseHelper.badRequest(reply, 'Could not determine app from API key');
      }

      // Get app_id from the API key by looking it up
      const { apiKeyRepository } = await import('../repositories/api-key.repository');
      const apiKey = await apiKeyRepository.findById(apiKeyId);

      if (!apiKey) {
        return ApiResponseHelper.unauthorized(reply, 'Invalid API key');
      }

      const app_id = apiKey.app_id;

      // Send notification with extracted app_id
      const notification = await notifyService.sendNotification(accountId, app_id, {
        ...body,
        app_id,
      });

      logger.info(
        { notificationId: notification.id, appId: app_id, correlationId: request.id },
        'Notification sent with API key'
      );

      // Track usage
      const metric = `${body.channel.toLowerCase()}s_per_month`;
      await UsageTrackingService.recordUsage(accountId, app_id, metric, 1);

      ApiResponseHelper.accepted(reply, 'Notification queued for processing', {
        id: notification.id,
        status: notification.status,
        channel: body.channel.toLowerCase(),
        created_at: notification.createdAt,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage, correlationId: request.id }, 'Failed to send notification with API key');

      if (errorMessage.includes('not found')) {
        return ApiResponseHelper.notFound(reply, errorMessage);
      }

      if (errorMessage.includes('Invalid') || errorMessage.includes('inactive')) {
        return ApiResponseHelper.unauthorized(reply, errorMessage);
      }

      return ApiResponseHelper.badRequest(reply, errorMessage);
    }
  }

  async bulkSend(request: FastifyRequest, reply: FastifyReply) {
    try {
      const body = request.body as BulkSendRequest;
      const accountIds = (request as any).user?.account_ids || [];
      const accountId = accountIds[0];

      if (!accountId) {
        return ApiResponseHelper.unauthorized(reply, 'No account access');
      }

      // Validate all notifications have app_id
      if (body.notifications.some((n: SendNotificationRequest) => !n.app_id)) {
        return ApiResponseHelper.badRequest(reply, 'All notifications must have app_id in request body');
      }

      // Use app_id from first notification (all should have the same app_id for bulk operations)
      const appId = body.notifications[0].app_id;

      const { response } = await notifyService.bulkSend(accountId, appId, body.notifications);

      logger.info(
        {
          accepted: response.accepted,
          rejected: response.rejected,
          correlationId: request.id,
        },
        'Bulk notifications processed'
      );

      // Track usage for accepted notifications
      const channel = body.notifications[0]?.channel?.toLowerCase() || 'email';
      const metric = `${channel}s_per_month`;
      await UsageTrackingService.recordUsage(accountId, appId, metric, response.accepted);

      ApiResponseHelper.accepted(reply, 'Bulk notifications queued for processing', response);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage, correlationId: request.id }, 'Failed to send bulk notifications');

      if (errorMessage.includes('Missing') || errorMessage.includes('inactive')) {
        return ApiResponseHelper.unauthorized(reply, errorMessage);
      }

      return ApiResponseHelper.badRequest(reply, errorMessage);
    }
  }

  async getNotificationStatus(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const accountIds = (request as any).user?.account_ids || [];
      const accountId = accountIds[0];

      if (!accountId) {
        return ApiResponseHelper.unauthorized(reply, 'No account access');
      }

      const notification = await notifyService.getNotificationStatus(accountId, id);

      logger.debug({ notificationId: id, correlationId: request.id }, 'Fetched notification status');

      ApiResponseHelper.success(reply, 'Notification status retrieved', {
        id: notification.id,
        channel: notification.channel,
        recipient: notification.recipient,
        status: notification.status,
        createdAt: notification.createdAt.toISOString(),
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage, correlationId: request.id }, 'Failed to fetch notification status');

      if (errorMessage.includes('not found')) {
        return ApiResponseHelper.notFound(reply, errorMessage);
      }

      if (errorMessage.includes('Access denied')) {
        return ApiResponseHelper.forbidden(reply, errorMessage);
      }

      return ApiResponseHelper.badRequest(reply, errorMessage);
    }
  }

  async listNotifications(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { channel, status, limit, offset } = request.query as {
        channel?: string;
        status?: string;
        limit?: string;
        offset?: string;
      };
      const accountIds = (request as any).user?.account_ids || [];
      const accountId = accountIds[0];

      if (!accountId) {
        return ApiResponseHelper.unauthorized(reply, 'No account access');
      }

      const result = await notifyService.listNotifications(accountId, {
        channel: channel as any,
        status: status as any,
        limit: limit ? parseInt(limit, 10) : 20,
        offset: offset ? parseInt(offset, 10) : 0,
      });

      logger.debug(
        {
          count: result.data.length,
          total: result.meta.total,
          correlationId: request.id,
        },
        'Listed notifications'
      );

      ApiResponseHelper.success(reply, 'Notifications listed', {
        data: result.data.map((n) => ({
          id: n.id,
          channel: n.channel,
          recipient: n.recipient,
          status: n.status,
          createdAt: n.createdAt.toISOString(),
        })),
        meta: result.meta,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage, correlationId: request.id }, 'Failed to list notifications');

      if (errorMessage.includes('Missing') || errorMessage.includes('inactive')) {
        return ApiResponseHelper.unauthorized(reply, errorMessage);
      }

      return ApiResponseHelper.badRequest(reply, errorMessage);
    }
  }
}

export const notifyController = new NotifyController();
