import type { Logger } from 'pino';
import { prismaRead, prismaWrite } from '@shared/database';
import type { QueueMessage } from '@shared/queue';

export class InAppProcessor {
  constructor(private readonly logger: Logger) {}

  async process(message: QueueMessage): Promise<void> {
    const notificationId = message.notificationId;
    this.logger.info({ notificationId, recipient: message.recipient }, 'Processing in-app notification');

    const notification = await prismaRead.notification.findUnique({ where: { id: notificationId } });
    if (!notification) {
      this.logger.warn({ notificationId }, 'No notification record found for in-app message');
      return;
    }

    const now = new Date();
    const existingPayload = (notification.payload as Record<string, any>) ?? {};

    await prismaWrite.notification.update({
      where: { id: notificationId },
      data: {
        status: 'DELIVERED',
        sentAt: notification.sentAt ?? now,
        deliveredAt: now,
        payload: { ...existingPayload, deliveryStatus: 'delivered' },
      },
    });

    await prismaWrite.notificationLog.create({
      data: {
        notificationId,
        channel: 'IN_APP',
        provider: 'in-app',
        status: 'DELIVERED',
        response: {
          deliveredAt: now.toISOString(),
          recipient: message.recipient,
          subject: message.subject ?? null,
          body: message.body ?? null,
        },
      },
    });

    this.logger.info({ notificationId }, 'In-app notification delivered');
  }
}
