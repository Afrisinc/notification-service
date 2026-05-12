import { logger } from '../config/logger';
import { prismaWrite, prismaRead } from '@shared/database';
import { IQueuePublisher, QueuePublisherFactory, QueuePublisherConfig } from './queue';
import { Template } from '../types/template';
import {
  Notification,
  SendNotificationRequest,
  BulkSendResponse,
  Channel,
  NotificationStatus,
} from '../types/notification';

// Re-export types for backwards compatibility
export type {
  SendNotificationRequest,
  BulkSendRequest,
  BulkSendResponse,
  Channel,
  NotificationStatus,
} from '../types/notification';

// Mock notification repository
const notifications: Map<string, Notification> = new Map();

// Queue publisher instance (will be initialized on startup)
let queuePublisher: IQueuePublisher;

export class NotifyService {
  async sendNotification(accountId: string, appId: string, request: SendNotificationRequest): Promise<Notification> {
    let template: Template | null = null;
    let renderedContent = '';
    let renderedSubject = '';

    // TEMPLATE MODE: if templateId provided
    if (request.templateId) {
      template = await prismaRead.template.findUnique({
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
      renderedContent = template.content;
      renderedSubject = template.subject || '';

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
    } else {
      // DIRECT MESSAGE MODE: no template, use payload.message
      if (!request.payload.message) {
        const error = new Error('Either provide templateId or payload.message for direct message mode');
        logger.warn({ accountId, app_id: appId }, 'Direct message mode: missing message in payload');
        throw error;
      }

      renderedContent = request.payload.message;
      logger.debug(
        { accountId, app_id: appId, channel: request.channel },
        'Sending notification in direct message mode'
      );
    }

    // Create notification record in database
    const notification = await prismaWrite.notification.create({
      data: {
        account_id: accountId,
        app_id: appId, // Save app ID for tracking
        channel: request.channel,
        recipient: request.recipient,
        templateCode: template?.code || 'DIRECT_MESSAGE',
        templateId: request.templateId,
        status: 'PENDING',
        priority: request.priority || 'NORMAL',
        payload: request.payload,
        sentAt: new Date(), // Set sentAt timestamp for log filtering
      },
    });

    // Get app-specific email config if available
    let fromEmail: string | undefined;
    let fromName: string | undefined;
    try {
      const emailConfig = await prismaRead.appEmailProvider.findUnique({
        where: { app_id: appId },
      });
      if (emailConfig && emailConfig.from_email) {
        fromEmail = emailConfig.from_email;
        fromName = emailConfig.from_name || undefined;
      }
    } catch (configError) {
      logger.warn({ appId, error: configError }, 'Failed to load app email config');
      // Continue without custom config - will use platform default in worker
    }

    

    // Publish to queue with rendered content
    await queuePublisher.publish({
      notificationId: notification.id,
      tenantId: accountId, // Using tenantId field for backwards compatibility, contains account ID
      appId: appId, // Include app ID for reference
      channel: request.channel,
      recipient: request.recipient,
      templateId: request.templateId,
      subject: renderedSubject,
      body: renderedContent,
      payload: request.payload,
      priority: request.priority || 'NORMAL',
      timestamp: new Date(),
      fromEmail: fromEmail,
      fromName: fromName,
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
        mode: request.templateId ? 'template' : 'direct',
      },
      'Notification enqueued'
    );

    return {
      ...notification,
      templateCode: notification.templateCode || 'DIRECT_MESSAGE',
      templateId: request.templateId || 'direct-message',
      payload: (notification.payload || {}) as Record<string, any>,
    } as Notification;
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
