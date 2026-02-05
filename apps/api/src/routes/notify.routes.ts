import { FastifyInstance } from 'fastify';
import { notifyController } from '../controllers/notify.controller';
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
      // onRequest: [authMiddleware],
      schema: {
        ...sendNotificationSchema,
        headers: gatewayHeaders,
      },
    },
    (request, reply) => notifyController.sendNotification(request, reply)
  );

  fastify.post(
    '/notify/bulk',
    {
      // Auth handled by API Gateway
      schema: {
        ...bulkNotificationSchema,
        headers: gatewayHeaders,
      },
    },
    (request, reply) => notifyController.bulkSend(request, reply)
  );

  // Define /notify/logs before /notify/:id to avoid route collision
  fastify.get(
    '/notify/logs',
    {
      // Auth handled by API Gateway
      schema: {
        ...notificationListSchema,
        headers: gatewayHeaders,
      },
    },
    (request, reply) => notifyController.listNotifications(request, reply)
  );

  fastify.get(
    '/notify/:id',
    {
      // Auth handled by API Gateway
      schema: {
        ...notificationStatusSchema,
        headers: gatewayHeaders,
      },
    },
    (request, reply) => notifyController.getNotificationStatus(request, reply)
  );
}