import pino from 'pino';
import { notificationLogsRepository, NotificationLogFilters } from '../repositories/notification-logs.repository';

const logger = pino();

export class NotificationLogsService {
  /**
   * List app notification logs with filtering
   */
  async listAppLogs(appId: string, filters: NotificationLogFilters) {
    try {
      const page = Math.max(1, filters.page || 1);
      const limit = Math.min(100, Math.max(1, filters.limit || 50));

      const dateFrom = filters.dateFrom || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const dateTo = filters.dateTo || new Date();

      const { notifications, total } = await notificationLogsRepository.listAppLogs(appId, {
        ...filters,
        page,
        limit,
        dateFrom,
        dateTo,
      });

      const counts = await notificationLogsRepository.getStatusCounts(appId, dateFrom, dateTo);
      const totalCount = total;
      const deliveredCount = counts.DELIVERED || 0;
      const failedCount = counts.FAILED || 0;
      const pendingCount = counts.PENDING || 0;
      const bouncedCount = counts.BOUNCED || 0;

      const deliveryRate = totalCount > 0 ? Math.round((deliveredCount / totalCount) * 100) : 0;
      const failureRate = totalCount > 0 ? Math.round((failedCount / totalCount) * 100) : 0;

      const formatted = notifications.map((n: any) => this.formatNotificationResponse(n));

      return {
        appId,
        notifications: formatted,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        summary: {
          totalCount,
          deliveredCount,
          failedCount,
          pendingCount,
          bouncedCount,
          deliveryRate,
          failureRate,
        },
      };
    } catch (error) {
      logger.error({ error, appId }, 'Failed to list app logs');
      throw error;
    }
  }

  /**
   * List all logs across apps
   */
  async listAllLogs(filters: {
    page: number;
    limit: number;
    appId?: string;
    status?: string;
    channel?: string;
    dateFrom?: Date;
    dateTo?: Date;
  }) {
    try {
      const page = Math.max(1, filters.page || 1);
      const limit = Math.min(100, Math.max(1, filters.limit || 50));

      const dateFrom = filters.dateFrom || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const dateTo = filters.dateTo || new Date();

      const { notifications, total } = await notificationLogsRepository.listAllLogs({
        ...filters,
        page,
        limit,
        dateFrom,
        dateTo,
      });

      const formatted = notifications.map((n: any) => this.formatNotificationResponse(n));

      return {
        notifications: formatted,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      logger.error({ error }, 'Failed to list all logs');
      throw error;
    }
  }

  /**
   * Get single notification log
   */
  async getNotificationLog(appId: string, notificationId: string) {
    try {
      const notification = await notificationLogsRepository.findById(notificationId, appId);

      if (!notification) {
        throw new Error('Notification log not found');
      }

      return this.formatDetailedNotificationResponse(notification);
    } catch (error) {
      logger.error({ error, appId, notificationId }, 'Failed to get notification log');
      throw error;
    }
  }

  /**
   * Get notification status
   */
  async getNotificationStatus(notificationId: string) {
    try {
      const notification = await notificationLogsRepository.getStatus(notificationId);

      if (!notification) {
        throw new Error('Notification not found');
      }

      return {
        id: notification.id,
        status: notification.status,
        recipient: notification.recipient,
        channel: notification.channel,
        sentAt: notification.sentAt ? notification.sentAt.toISOString() : null,
        deliveredAt: null,
        openedAt: null,
        clickedAt: null,
        errorMessage: null,
        provider: 'internal',
      };
    } catch (error) {
      logger.error({ error, notificationId }, 'Failed to get notification status');
      throw error;
    }
  }

  /**
   * Get logs for export
   */
  async getLogsForExport(appId: string, filters: Omit<NotificationLogFilters, 'page' | 'limit'>) {
    try {
      const dateFrom = filters.dateFrom || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const dateTo = filters.dateTo || new Date();

      const notifications = await notificationLogsRepository.getLogsForExport(appId, {
        ...filters,
        dateFrom,
        dateTo,
      });

      return notifications.map((n: any) => this.formatNotificationResponse(n));
    } catch (error) {
      logger.error({ error, appId }, 'Failed to get logs for export');
      throw error;
    }
  }

  /**
   * Format notification response
   */
  private formatNotificationResponse(notification: any) {
    return {
      id: notification.id,
      appId: notification.app_id,
      recipient: notification.recipient,
      templateId: undefined,
      templateName: undefined,
      channel: notification.channel,
      status: notification.status,
      provider: 'internal',
      providerMessageId: undefined,
      sentAt: notification.sentAt ? notification.sentAt.toISOString() : null,
      deliveredAt: null,
      openedAt: null,
      clickedAt: null,
      bounceType: null,
      errorMessage: null,
      errorCode: null,
      campaignId: null,
      metadata: notification.payload || {},
    };
  }

  /**
   * Format detailed notification response
   */
  private formatDetailedNotificationResponse(notification: any) {
    const formatted = this.formatNotificationResponse(notification);

    return {
      ...formatted,
      recipientType: this.getRecipientType(notification.channel),
      templateCode: notification.templateCode,
      attemptCount: notification.retryCount || 1,
      lastRetryAt: null,
      events: this.generateEvents(notification),
    };
  }

  /**
   * Get recipient type based on channel
   */
  private getRecipientType(channel: string): string {
    switch (channel) {
      case 'SMS':
        return 'phone';
      case 'PUSH':
        return 'user';
      default:
        return 'email';
    }
  }

  /**
   * Generate event log from notification
   */
  private generateEvents(notification: any): any[] {
    const events = [];

    if (notification.sentAt) {
      events.push({
        type: 'sent',
        timestamp: notification.sentAt.toISOString(),
        details: 'Notification queued for delivery',
      });
    }

    if (notification.status === 'DELIVERED') {
      events.push({
        type: 'delivered',
        timestamp: notification.sentAt ? notification.sentAt.toISOString() : new Date().toISOString(),
        details: 'Notification delivered to recipient',
      });
    }

    if (notification.status === 'FAILED') {
      events.push({
        type: 'failed',
        timestamp: notification.sentAt
          ? new Date(notification.sentAt.getTime() + 1000).toISOString()
          : new Date().toISOString(),
        details: 'Delivery failed',
      });
    }

    return events;
  }
}

export const notificationLogsService = new NotificationLogsService();
