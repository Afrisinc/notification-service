import { FastifyInstance } from 'fastify';
import { notifyController } from '../controllers/notify.controller';
import { asyncWrapper } from '../middlewares/async_wrapper.middleware';
import { authMiddleware, validateBaseToken } from '../middlewares/auth.middleware';
import { apiKeyMiddleware } from '../middlewares/api-key.middleware';
import {
  sendNotificationSchema,
  bulkNotificationSchema,
  notificationStatusSchema,
  notificationListSchema,
  sendNotificationWithKeySchema,
} from '../schemas/notify';
import { gatewayHeaders } from '../schemas/common';

export async function registerNotifyRoutes(fastify: FastifyInstance) {
  fastify.post(
    '/notify/send',
    {
      onRequest: [validateBaseToken],
      schema: {
        ...sendNotificationSchema,
        headers: gatewayHeaders,
      },
    },
    asyncWrapper(notifyController.sendNotification.bind(notifyController))
  );

  // Send notification with API key instead of JWT token
  fastify.post(
    '/notify/send-with-key',
    {
      onRequest: [apiKeyMiddleware],
      schema: {
        ...sendNotificationWithKeySchema,
        headers: gatewayHeaders,
      },
    },
    asyncWrapper(notifyController.sendNotificationWithKey.bind(notifyController))
  );

  fastify.post(
    '/notify/bulk',
    {
      onRequest: [validateBaseToken],
      schema: {
        ...bulkNotificationSchema,
        headers: gatewayHeaders,
      },
    },
    asyncWrapper(notifyController.bulkSend.bind(notifyController))
  );

  // Define /notify/logs before /notify/:id to avoid route collision
  fastify.get(
    '/notify/logs',
    {
      onRequest: [validateBaseToken],
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
      onRequest: [validateBaseToken],
      schema: {
        ...notificationStatusSchema,
        headers: gatewayHeaders,
      },
    },
    asyncWrapper(notifyController.getNotificationStatus.bind(notifyController))
  );
}
