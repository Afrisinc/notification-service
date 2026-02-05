import { logger } from '../config/logger';
import { tenantService, Tenant } from './tenant.service';
import { templateService } from './template.service';

export type Channel = 'EMAIL' | 'SMS' | 'IN_APP';
export type NotificationStatus = 'PENDING' | 'QUEUED' | 'SENT' | 'FAILED';
export type Priority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export interface SendNotificationRequest {
  channel: Channel;
  recipient: string;
  templateCode: string;
  payload: Record<string, any>;
  priority?: Priority;
}

export interface Notification {
  id: string;
  tenantId: string;
  channel: Channel;
  recipient: string;
  templateId: string;
  status: NotificationStatus;
  priority: Priority;
  payload: Record<string, any>;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface BulkSendRequest {
  notifications: SendNotificationRequest[];
}

export interface BulkSendResponse {
  accepted: number;
  rejected: number;
  errors?: Array<{ index: number; error: string }>;
}

// Mock notification repository
const notifications: Map<string, Notification> = new Map();

// Mock queue publisher
interface QueueMessage {
  notificationId: string;
  tenantId: string;
  channel: Channel;
  recipient: string;
  templateCode: string;
  payload: Record<string, any>;
  priority: Priority;
  timestamp: Date;
}

const queuePublisher = {
  async publish(message: QueueMessage): Promise<void> {
    logger.info(
      {
        notificationId: message.notificationId,
        channel: message.channel,
        recipient: message.recipient,
      },
      'Published message to queue'
    );
  },
};

export class NotifyService {
  async sendNotification(
    tenantId: string,
    request: SendNotificationRequest
  ): Promise<Notification> {
    const tenant = await tenantService.getTenantById(tenantId);
    if (!tenant) {
      const error = new Error(`Tenant not found: ${tenantId}`);
      logger.error({ tenantId }, 'Tenant not found for notification');
      throw error;
    }

    // Validate template exists
    const template = await templateService.getTemplateByCode(
      tenantId,
      request.templateCode,
      request.channel
    );

    if (!template) {
      const error = new Error(`Template not found: ${request.templateCode}`);
      logger.warn({ tenantId, templateCode: request.templateCode }, 'Template not found');
      throw error;
    }

    // Create notification record
    const notification: Notification = {
      id: generateId(),
      tenantId,
      channel: request.channel,
      recipient: request.recipient,
      templateId: template.id,
      status: 'PENDING',
      priority: request.priority || 'NORMAL',
      payload: request.payload,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    notifications.set(notification.id, notification);

    // Publish to queue
    await queuePublisher.publish({
      notificationId: notification.id,
      tenantId,
      channel: request.channel,
      recipient: request.recipient,
      templateCode: request.templateCode,
      payload: request.payload,
      priority: request.priority || 'NORMAL',
      timestamp: new Date(),
    });

    // Update status to QUEUED
    notification.status = 'QUEUED';
    notification.updatedAt = new Date();
    notifications.set(notification.id, notification);

    logger.info(
      {
        notificationId: notification.id,
        tenantId,
        channel: request.channel,
      },
      'Notification enqueued'
    );

    return notification;
  }

  async bulkSend(
    tenantId: string,
    requests: SendNotificationRequest[]
  ): Promise<{ notifications: Notification[]; response: BulkSendResponse }> {
    const tenant = await tenantService.getTenantById(tenantId);
    if (!tenant) {
      const error = new Error(`Tenant not found: ${tenantId}`);
      logger.error({ tenantId }, 'Tenant not found for bulk send');
      throw error;
    }

    const results: Notification[] = [];
    const errors: Array<{ index: number; error: string }> = [];
    let accepted = 0;
    let rejected = 0;

    for (let i = 0; i < requests.length; i++) {
      try {
        const notification = await this.sendNotification(tenantId, requests[i]);
        results.push(notification);
        accepted++;
      } catch (error) {
        rejected++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        errors.push({ index: i, error: errorMessage });
        logger.warn({ index: i, error: errorMessage }, 'Failed to process notification in bulk');
      }
    }

    return {
      notifications: results,
      response: {
        accepted,
        rejected,
        ...(errors.length > 0 && { errors }),
      },
    };
  }

  async getNotificationStatus(tenantId: string, notificationId: string): Promise<Notification> {
    const notification = notifications.get(notificationId);

    if (!notification) {
      const error = new Error(`Notification not found: ${notificationId}`);
      logger.warn({ notificationId }, 'Notification not found');
      throw error;
    }

    // Verify tenant access
    if (notification.tenantId !== tenantId) {
      const error = new Error('Access denied');
      logger.warn({ notificationId, tenantId }, 'Tenant access denied');
      throw error;
    }

    return notification;
  }

  async listNotifications(
    tenantId: string,
    filters: {
      channel?: Channel;
      status?: NotificationStatus;
      limit?: number;
      offset?: number;
    }
  ): Promise<{
    data: Notification[];
    meta: { limit: number; offset: number; total: number };
  }> {
    const limit = Math.min(filters.limit || 20, 100);
    const offset = filters.offset || 0;

    let results = Array.from(notifications.values()).filter(
      (n) => n.tenantId === tenantId
    );

    if (filters.channel) {
      results = results.filter((n) => n.channel === filters.channel);
    }

    if (filters.status) {
      results = results.filter((n) => n.status === filters.status);
    }

    const total = results.length;
    const data = results
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(offset, offset + limit);

    return {
      data,
      meta: { limit, offset, total },
    };
  }
}

function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export const notifyService = new NotifyService();
