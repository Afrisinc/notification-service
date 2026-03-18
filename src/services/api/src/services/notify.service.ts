import { logger } from '../config/logger';
import { prismaWrite } from '@shared/database';
import { IQueuePublisher, QueueMessage, QueuePublisherFactory, QueuePublisherConfig } from './queue';

export type Channel = 'EMAIL' | 'SMS' | 'IN_APP' | 'PUSH' | 'WHATSAPP';
export type NotificationStatus = 'PENDING' | 'QUEUED' | 'SENT' | 'FAILED';
export type Priority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export interface SendNotificationRequest {
  channel: Channel;
  recipient: string;
  templateId: string; // UUID of the template instance
  app_id: string; // App/product ID - required for tracking notifications per app
  payload: Record<string, any>;
  priority?: Priority;
}

export interface Notification {
  id: string;
  account_id: string;
  channel: Channel;
  recipient: string;
  templateId: string; // UUID for tracking which template version was used
  templateCode: string; // Code for reference
  status: NotificationStatus;
  priority: Priority;
  payload: Record<string, any>;
  retryCount?: number;
  scheduledAt?: Date | null;
  sentAt?: Date | null;
  createdAt: Date;
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

// Queue publisher instance (will be initialized on startup)
let queuePublisher: IQueuePublisher;

export class NotifyService {
  async sendNotification(accountId: string, appId: string, request: SendNotificationRequest): Promise<Notification> {
    // Validate template exists by ID
    const template = await prismaWrite.template.findUnique({
      where: { id: request.templateId },
    });

    if (!template) {
      const error = new Error(`Template not found: ${request.templateId}`);
      logger.warn({ accountId, templateId: request.templateId }, 'Template not found');
      throw error;
    }

    // Verify template belongs to account
    if (template.account_id !== accountId) {
      const error = new Error('Unauthorized: Template does not belong to your account');
      logger.warn(
        { accountId, templateId: request.templateId, templateAccountId: template.account_id },
        'Unauthorized template access'
      );
      throw error;
    }

    // Render template with payload variables
    let renderedContent = template.content;
    let renderedSubject = template.subject || template.code;

    if (request.payload && Object.keys(request.payload).length > 0) {
      try {
        // Simple Handlebars-like variable replacement
        renderedContent = this.renderTemplate(template.content, request.payload);
        if (template.subject) {
          renderedSubject = this.renderTemplate(template.subject, request.payload);
        }
      } catch (renderError) {
        logger.warn(
          { templateId: request.templateId, templateCode: template.code, error: renderError },
          'Template rendering failed, using raw template'
        );
        // Continue with unrendered template
      }
    }

    // Create notification record in database
    const notification = await prismaWrite.notification.create({
      data: {
        account_id: accountId,
        app_id: appId, // Save app ID for tracking
        channel: request.channel as any,
        recipient: request.recipient,
        templateCode: template.code, // Store code for reference
        status: 'PENDING',
        priority: request.priority || 'NORMAL',
        payload: request.payload,
      },
    });

    // Publish to queue with rendered content
    await queuePublisher.publish({
      notificationId: notification.id,
      tenantId: accountId, // Using tenantId field for backwards compatibility, contains account ID
      channel: request.channel,
      recipient: request.recipient,
      templateCode: template.code,
      templateId: request.templateId, // Include template ID for tracking
      subject: renderedSubject,
      body: renderedContent,
      payload: request.payload,
      priority: request.priority || 'NORMAL',
      timestamp: new Date(),
    });

    // Update status to QUEUED
    await prismaWrite.notification.update({
      where: { id: notification.id },
      data: { status: 'QUEUED' },
    });

    logger.info(
      {
        notificationId: notification.id,
        templateId: request.templateId,
        accountId,
        channel: request.channel,
      },
      'Notification enqueued'
    );

    return {
      ...notification,
      templateId: request.templateId,
      payload: (notification.payload || {}) as Record<string, any>,
    };
  }

  /**
   * Simple Handlebars-like template rendering
   * Replaces {{variable}} with values from payload
   */
  private renderTemplate(template: string, payload: Record<string, any>): string {
    let rendered = template;

    // Replace {{variable}} with payload values
    Object.entries(payload).forEach(([key, value]) => {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
      rendered = rendered.replace(regex, stringValue);
    });

    return rendered;
  }

  async bulkSend(
    accountId: string,
    appId: string,
    requests: SendNotificationRequest[]
  ): Promise<{ notifications: Notification[]; response: BulkSendResponse }> {
    const results: Notification[] = [];
    const errors: Array<{ index: number; error: string }> = [];
    let accepted = 0;
    let rejected = 0;

    for (let i = 0; i < requests.length; i++) {
      try {
        const notification = await this.sendNotification(accountId, appId, requests[i]);
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

  async getNotificationStatus(accountId: string, notificationId: string): Promise<Notification> {
    const notification = notifications.get(notificationId);

    if (!notification) {
      const error = new Error(`Notification not found: ${notificationId}`);
      logger.warn({ notificationId }, 'Notification not found');
      throw error;
    }

    // Verify account access
    if (notification.account_id !== accountId) {
      const error = new Error('Access denied');
      logger.warn({ notificationId, accountId }, 'Account access denied');
      throw error;
    }

    return notification;
  }

  async listNotifications(
    accountId: string,
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

    let results = Array.from(notifications.values()).filter((n) => n.account_id === accountId);

    if (filters.channel) {
      results = results.filter((n) => n.channel === filters.channel);
    }

    if (filters.status) {
      results = results.filter((n) => n.status === filters.status);
    }

    const total = results.length;
    const data = results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(offset, offset + limit);

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

/**
 * Initialize the NotifyService with a queue publisher
 * Must be called during application startup
 */
export async function initializeNotifyService(config?: QueuePublisherConfig): Promise<void> {
  const queueConfig = config || QueuePublisherFactory.getDefaultConfig();

  // Validate configuration
  const errors = QueuePublisherFactory.validateConfig(queueConfig);
  if (errors.length > 0) {
    throw new Error(`Invalid queue configuration: ${errors.join(', ')}`);
  }

  // Create and initialize queue publisher
  queuePublisher = await QueuePublisherFactory.createPublisher(queueConfig);

  logger.info({ provider: queueConfig.provider }, '✅ NotifyService initialized with queue publisher');
}

/**
 * Get the current queue publisher (for testing/debugging)
 */
export function getQueuePublisher(): IQueuePublisher {
  if (!queuePublisher) {
    throw new Error('Queue publisher not initialized. Call initializeNotifyService first.');
  }
  return queuePublisher;
}
