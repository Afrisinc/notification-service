import { logger } from '../config/logger';
import { SendNotificationRequest } from '../services/notify.service';
import { prismaWrite } from '@shared/database';
import { Channel } from '@prisma/client';

/**
 * Notification Consumer
 * Processes notification messages from RabbitMQ queue
 * Validates payload and saves to database
 */
export class NotificationConsumer {
  /**
   * Process notification message from queue
   */
  async processNotification(message: any, accountId: string, appId?: string) {
    try {
      const payload = message as any;

      // Validate required fields
      this.validatePayload(payload);

      logger.debug(
        {
          accountId,
          appId: appId || payload.app_id,
          channel: payload.channel,
          templateId: payload.templateId,
          recipient: payload.recipient,
        },
        'Processing notification from queue'
      );

      // Save notification to database
      const templateCode = (payload as any).templateCode || 'queued-notification';
      const notification = await prismaWrite.notification.create({
        data: {
          account_id: accountId,
          app_id: appId || (payload as any).app_id, // Use provided appId or fallback to payload
          channel: payload.channel as Channel,
          recipient: payload.recipient,
          templateCode,
          payload: payload.payload || {},
          status: 'QUEUED',
          priority: payload.priority || 'NORMAL',
          sentAt: new Date(), // Set timestamp for log filtering
        },
      });

      logger.info({ notificationId: notification.id, accountId }, 'Notification saved from queue');

      return notification;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage, accountId }, 'Failed to process notification from queue');
      throw error;
    }
  }

  /**
   * Validate notification payload structure
   */
  private validatePayload(payload: any): void {
    const requiredFields = ['channel', 'recipient', 'templateCode'];

    for (const field of requiredFields) {
      if (!payload[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    const validChannels = ['EMAIL', 'SMS', 'IN_APP', 'PUSH', 'WHATSAPP'];
    if (!validChannels.includes(payload.channel)) {
      throw new Error(`Invalid channel: ${payload.channel}`);
    }

    const validPriorities = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];
    if (payload.priority && !validPriorities.includes(payload.priority)) {
      throw new Error(`Invalid priority: ${payload.priority}`);
    }

    if (typeof payload.payload !== 'object' || payload.payload === null) {
      throw new Error('Payload must be a valid object');
    }
  }

  /**
   * Batch process multiple notifications
   */
  async processBatch(messages: any[], tenantId: string, appId?: string) {
    const results = {
      processed: 0,
      failed: 0,
      errors: [] as Array<{ index: number; error: string }>,
    };

    for (let i = 0; i < messages.length; i++) {
      try {
        await this.processNotification(messages[i], tenantId, appId);
        results.processed++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.failed++;
        results.errors.push({ index: i, error: errorMessage });
        logger.warn({ index: i, error: errorMessage, tenantId, appId }, 'Failed to process notification in batch');
      }
    }

    logger.info(
      { processed: results.processed, failed: results.failed, tenantId, appId },
      'Batch notification processing completed'
    );

    return results;
  }
}

export const notificationConsumer = new NotificationConsumer();
