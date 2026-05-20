import { FastifyRequest, FastifyReply } from 'fastify';
import { logger } from '../config/logger';
import { notifyService, SendNotificationRequest, BulkSendRequest } from '../services/notify.service';
import { UsageTrackingService } from '../services/usage-tracking.service';
import { PaygService } from '../services/payg.service';
import { PlanEnforcementMiddleware } from '../middleware/plan-enforcement.middleware';
import { ApiResponseHelper } from '../utils';
import type { PaygChannel } from '../types/payg.types';

export class NotifyController {
  async sendNotification(request: FastifyRequest, reply: FastifyReply) {
    try {
      const body = request.body as Omit<SendNotificationRequest, 'app_id'> & { app_id?: string };
      const accountId = request.headers['x-account-id'] as string;
      const apiKeyId = request.headers['x-api-key-id'] as string | undefined;

      if (!accountId) {
        return ApiResponseHelper.unauthorized(reply, 'No account access');
      }

      let app_id: string;

      if (apiKeyId) {
        const { apiKeyRepository } = await import('../repositories/api-key.repository');
        const apiKey = await apiKeyRepository.findById(apiKeyId);
        if (!apiKey) {
          return ApiResponseHelper.unauthorized(reply, 'Invalid API key');
        }
        app_id = apiKey.app_id;
      } else {
        if (!body.app_id) {
          return ApiResponseHelper.badRequest(reply, 'app_id is required in request body');
        }
        app_id = body.app_id;
      }

      // ── PAYG: check balance before sending ────────────────────────────────
      const isPayg = await PlanEnforcementMiddleware.isPaygAccount(accountId);
      logger.debug({ accountId, isPayg, correlationId: request.id }, '[PAYG] Account plan check');

      if (isPayg) {
        const channel = body.channel as PaygChannel;
        const balanceCheck = await PaygService.checkSufficientBalance(accountId, channel, 1);
        logger.debug({ accountId, channel, balanceCheck, correlationId: request.id }, '[PAYG] Pre-send balance check');
        if (!balanceCheck.sufficient) {
          return ApiResponseHelper.error(
            reply,
            `Insufficient PAYG credit balance. Required: $${balanceCheck.required.toFixed(4)}, Available: $${balanceCheck.available.toFixed(4)}. Please top up at /api/payg/topup.`,
            4030,
            402
          );
        }
      }

      const notification = await notifyService.sendNotification(accountId, app_id, { ...body, app_id });

      logger.info(
        { notificationId: notification.id, appId: app_id, isPayg, correlationId: request.id },
        'Notification sent successfully'
      );

      if (isPayg) {
        // ── PAYG: deduct credits & fire low-balance alert ──────────────────
        const deductResult = await PaygService.deductCredits({
          accountId,
          channel: body.channel as PaygChannel,
          quantity: 1,
          notificationId: notification.id,
        });
        logger.info(
          {
            accountId,
            notificationId: notification.id,
            channel: body.channel,
            deducted: deductResult.amountDeducted,
            newBalance: deductResult.newBalance,
            success: deductResult.success,
            correlationId: request.id,
          },
          '[PAYG] Credit deduction result'
        );
        if (!deductResult.success) {
          logger.error(
            { accountId, notificationId: notification.id, deductResult },
            '[PAYG] Credit deduction failed after notification was queued'
          );
        }
        PaygService.checkAndAlertLowBalance(accountId).catch(() => {});
      } else {
        // ── Subscription: record usage against monthly quota ───────────────
        const metric = `${body.channel.toLowerCase()}s_per_month`;
        await UsageTrackingService.recordUsage(accountId, app_id, metric, 1);
      }

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
      const channel = (body.notifications[0]?.channel ?? 'EMAIL') as PaygChannel;

      // ── PAYG: pre-flight balance check for the full batch ─────────────────
      const isPayg = await PlanEnforcementMiddleware.isPaygAccount(accountId);
      logger.debug({ accountId, isPayg, correlationId: request.id }, '[PAYG] Bulk send plan check');

      if (isPayg) {
        const quantity = body.notifications.length;
        const balanceCheck = await PaygService.checkSufficientBalance(accountId, channel, quantity);
        logger.debug(
          { accountId, channel, quantity, balanceCheck, correlationId: request.id },
          '[PAYG] Bulk pre-send balance check'
        );
        if (!balanceCheck.sufficient) {
          return ApiResponseHelper.error(
            reply,
            `Insufficient PAYG credit balance for ${quantity} ${channel} messages. Required: $${balanceCheck.required.toFixed(4)}, Available: $${balanceCheck.available.toFixed(4)}. Please top up at /api/payg/topup.`,
            4030,
            402
          );
        }
      }

      const { notifications: sent, response } = await notifyService.bulkSend(accountId, appId, body.notifications);

      logger.info(
        { accepted: response.accepted, rejected: response.rejected, isPayg, correlationId: request.id },
        'Bulk notifications processed'
      );

      if (isPayg) {
        // ── PAYG: deduct credits for each accepted message ─────────────────
        if (response.accepted > 0) {
          const deductResult = await PaygService.deductCredits({
            accountId,
            channel,
            quantity: response.accepted,
          });
          logger.info(
            {
              accountId,
              channel,
              quantity: response.accepted,
              deducted: deductResult.amountDeducted,
              newBalance: deductResult.newBalance,
              success: deductResult.success,
              correlationId: request.id,
            },
            '[PAYG] Bulk credit deduction result'
          );
          if (!deductResult.success) {
            logger.error(
              { accountId, deductResult },
              '[PAYG] Bulk credit deduction failed after notifications were queued'
            );
          }
          PaygService.checkAndAlertLowBalance(accountId).catch(() => {});
        }
      } else {
        // ── Subscription: record usage against monthly quota ───────────────
        const metric = `${channel.toLowerCase()}s_per_month`;
        await UsageTrackingService.recordUsage(accountId, appId, metric, response.accepted);
      }

      void sent; // returned for completeness; response summary is what callers need
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
