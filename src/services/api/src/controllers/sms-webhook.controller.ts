import { FastifyRequest, FastifyReply } from 'fastify';
import { prismaRead, prismaWrite } from '@shared/database';
import pino from 'pino';

const logger = pino();

type NotificationStatusType = 'PENDING' | 'QUEUED' | 'SENT' | 'DELIVERED' | 'FAILED';

const AT_STATUS_MAP: Record<string, { status: NotificationStatusType; deliveryStatus: string }> = {
  Success: { status: 'DELIVERED', deliveryStatus: 'delivered' },
  Sent: { status: 'SENT', deliveryStatus: 'sent' },
  Submitted: { status: 'SENT', deliveryStatus: 'submitted' },
  Buffered: { status: 'QUEUED', deliveryStatus: 'buffered' },
  Rejected: { status: 'FAILED', deliveryStatus: 'rejected' },
  Failed: { status: 'FAILED', deliveryStatus: 'failed' },
  AbsentSubscriber: { status: 'FAILED', deliveryStatus: 'absent_subscriber' },
  Expired: { status: 'FAILED', deliveryStatus: 'expired' },
};

interface AfricasTalkingDeliveryReport {
  id: string;
  status: 'Success' | 'Sent' | 'Buffered' | 'Rejected' | 'Failed';
  phoneNumber?: string;
  networkCode?: string;
  failureReason?: string;
}

export class SMSWebhookController {
  private respondWebhook(reply: FastifyReply, success: boolean, message: string) {
    return reply.status(200).send({ success, message });
  }

  async handleAfricasTalkingDelivery(req: FastifyRequest, reply: FastifyReply) {
    const body = req.body as AfricasTalkingDeliveryReport;

    logger.info({ messageId: body.id, status: body.status }, 'SMS delivery report received');

    try {
      const notification = await prismaRead.notification.findFirst({
        where: {
          channel: 'SMS',
          payload: { path: ['providerMessageId'], equals: body.id },
        },
      });

      if (!notification) {
        logger.warn({ messageId: body.id }, 'Notification not found');
        return this.respondWebhook(reply, true, 'Received');
      }

      const statusMapping = AT_STATUS_MAP[body.status] || {
        status: 'UNKNOWN',
        deliveryStatus: body.status.toLowerCase(),
      };
      const now = new Date();
      const existingPayload = (notification.payload as Record<string, any>) ?? {};

      await prismaWrite.notification.update({
        where: { id: notification.id },
        data: {
          status: statusMapping.status as any,
          payload: {
            ...existingPayload,
            deliveryStatus: statusMapping.deliveryStatus,
            ...(body.failureReason && { failureReason: body.failureReason }),
          },
          ...(statusMapping.status === 'DELIVERED' ? { deliveredAt: now } : {}),
        },
      });

      await prismaWrite.notificationLog.create({
        data: {
          notificationId: notification.id,
          provider: 'africas-talking',
          channel: 'SMS',
          status: statusMapping.status,
          response: { deliveryStatus: body.status, failureReason: body.failureReason },
        },
      });

      logger.info({ notificationId: notification.id, status: statusMapping.status }, 'Notification updated');

      return this.respondWebhook(reply, true, 'Processed');
    } catch (error) {
      logger.error({ error, messageId: body.id }, 'Failed to process delivery report');
      return this.respondWebhook(reply, false, 'Processing failed');
    }
  }
}

export const smsWebhookController = new SMSWebhookController();
