import { FastifyInstance } from 'fastify';
import { notifyController } from '../controllers/notify.controller';
import { asyncWrapper } from '../middlewares/async_wrapper.middleware';
import { flexAuthMiddleware, validateBaseToken } from '../middlewares/auth.middleware';
import { rateLimiters } from '../middlewares/rate-limit.middleware';
import { preSendLimitGuard, preBulkLimitGuard } from '../guards';
import {
  sendNotificationSchema,
  bulkNotificationSchema,
  notificationStatusSchema,
  notificationListSchema,
} from '../schemas/notify';
import { gatewayHeaders } from '../schemas/common';

export async function registerNotifyRoutes(fastify: FastifyInstance) {
  fastify.post(
    '/notify/send',
    {
      onRequest: [flexAuthMiddleware, rateLimiters.notify, preSendLimitGuard],
      schema: {
        ...sendNotificationSchema,
        headers: gatewayHeaders,
      },
    },
    asyncWrapper(notifyController.sendNotification.bind(notifyController))
  );

  fastify.post(
    '/notify/bulk',
    {
      onRequest: [validateBaseToken, rateLimiters.bulk, preBulkLimitGuard],
      schema: {
        ...bulkNotificationSchema,
        headers: gatewayHeaders,
      },
    },
    asyncWrapper(notifyController.bulkSend.bind(notifyController))
  );

  fastify.get(
    '/notify/logs',
    {
      onRequest: [validateBaseToken, rateLimiters.api],
      schema: {
        ...notificationListSchema,
        headers: gatewayHeaders,
      },
    },
    asyncWrapper(notifyController.listNotifications.bind(notifyController))
  );

  fastify.get(
    '/notify/:id',
    {
      onRequest: [validateBaseToken, rateLimiters.api],
      schema: {
        ...notificationStatusSchema,
        headers: gatewayHeaders,
      },
    },
    asyncWrapper(notifyController.getNotificationStatus.bind(notifyController))
  );
}
