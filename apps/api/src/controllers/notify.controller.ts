import { FastifyRequest, FastifyReply } from 'fastify';
import { logger } from '../config/logger';
import { notifyService, SendNotificationRequest, BulkSendRequest } from '../services/notify.service';
import { tenantService } from '../services/tenant.service';
import { ApiResponseHelper } from '../utils';

export class NotifyController {
  async sendNotification(request: FastifyRequest, reply: FastifyReply) {
    try {
      const tenant = await tenantService.resolveTenant(request);
      const body = request.body as SendNotificationRequest;

      const notification = await notifyService.sendNotification(tenant.id, body);

      logger.info(
        { notificationId: notification.id, correlationId: request.id },
        'Notification sent successfully'
      );

      ApiResponseHelper.accepted(reply, 'Notification queued for processing', {
        notificationId: notification.id,
        status: notification.status,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage, correlationId: request.id }, 'Failed to send notification');

      if (errorMessage.includes('not found')) {
        ApiResponseHelper.notFound(reply, errorMessage);
      }

      if (errorMessage.includes('Missing') || errorMessage.includes('inactive')) {
        ApiResponseHelper.unauthorized(reply, errorMessage);
      }

      ApiResponseHelper.badRequest(reply, errorMessage);
    }
  }

  async bulkSend(request: FastifyRequest, reply: FastifyReply) {
    try {
      const tenant = await tenantService.resolveTenant(request);
      const body = request.body as BulkSendRequest;

      const { notifications, response } = await notifyService.bulkSend(
        tenant.id,
        body.notifications
      );

      logger.info(
        { accepted: response.accepted, rejected: response.rejected, correlationId: request.id },
        'Bulk notifications processed'
      );

      ApiResponseHelper.accepted(
        reply,
        'Bulk notifications queued for processing',
        response
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage, correlationId: request.id }, 'Failed to send bulk notifications');

      if (errorMessage.includes('Missing') || errorMessage.includes('inactive')) {
        ApiResponseHelper.unauthorized(reply, errorMessage);
      }

      ApiResponseHelper.badRequest(reply, errorMessage);
    }
  }

  async getNotificationStatus(request: FastifyRequest, reply: FastifyReply) {
    try {
      const tenant = await tenantService.resolveTenant(request);
      const { id } = request.params as { id: string };

      const notification = await notifyService.getNotificationStatus(tenant.id, id);

      logger.debug({ notificationId: id, correlationId: request.id }, 'Fetched notification status');

      ApiResponseHelper.success(reply, 'Notification status retrieved', {
        id: notification.id,
        channel: notification.channel,
        recipient: notification.recipient,
        status: notification.status,
        createdAt: notification.createdAt.toISOString(),
        updatedAt: notification.updatedAt.toISOString(),
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage, correlationId: request.id }, 'Failed to fetch notification status');

      if (errorMessage.includes('not found')) {
        ApiResponseHelper.notFound(reply, errorMessage);
      }

      if (errorMessage.includes('Access denied')) {
        ApiResponseHelper.forbidden(reply, errorMessage);
      }

      ApiResponseHelper.badRequest(reply, errorMessage);
    }
  }

  async listNotifications(request: FastifyRequest, reply: FastifyReply) {
    try {
      const tenant = await tenantService.resolveTenant(request);
      const { channel, status, limit, offset } = request.query as {
        channel?: string;
        status?: string;
        limit?: string;
        offset?: string;
      };

      const result = await notifyService.listNotifications(tenant.id, {
        channel: channel as any,
        status: status as any,
        limit: limit ? parseInt(limit, 10) : 20,
        offset: offset ? parseInt(offset, 10) : 0,
      });

      logger.debug(
        { count: result.data.length, total: result.meta.total, correlationId: request.id },
        'Listed notifications'
      );

      ApiResponseHelper.success(reply, 'Notifications listed', {
        data: result.data.map((n) => ({
          id: n.id,
          channel: n.channel,
          recipient: n.recipient,
          status: n.status,
          createdAt: n.createdAt.toISOString(),
          updatedAt: n.updatedAt.toISOString(),
        })),
        meta: result.meta,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage, correlationId: request.id }, 'Failed to list notifications');

      if (errorMessage.includes('Missing') || errorMessage.includes('inactive')) {
        ApiResponseHelper.unauthorized(reply, errorMessage);
      }

      ApiResponseHelper.badRequest(reply, errorMessage);
    }
  }
}

export const notifyController = new NotifyController();
