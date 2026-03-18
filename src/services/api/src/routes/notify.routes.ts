import { FastifyInstance } from 'fastify';
import { notifyController } from '../controllers/notify.controller';
import { asyncWrapper } from '../middlewares/async_wrapper.middleware';
import { authMiddleware, validateBaseToken } from '../middlewares/auth.middleware';
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
      onRequest: [validateBaseToken],
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
