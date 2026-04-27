import pino from 'pino';
import { notificationLogsRepository, NotificationLogFilters } from '../repositories/notification-logs.repository';

const logger = pino();

export class NotificationLogsService {
  /**
   * List app notification logs with filtering
   */
  async listAppLogs(appId: string, organizationId: string, filters: NotificationLogFilters) {
    try {
      // Verify app belongs to organization (will be done by repository/caller)
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

      const counts = await notificationLogsRepository.getStatusCounts(appId, {
        ...filters,
        page,
        limit,
        dateFrom,
        dateTo,
      });
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
      logger.error({ error, appId, organizationId }, 'Failed to list app logs');
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
  async getNotificationLog(appId: string, organizationId: string, notificationId: string) {
    try {
      const notification = await notificationLogsRepository.findById(notificationId, appId);

      if (!notification) {
        throw new Error('Notification log not found');
      }

      return this.formatDetailedNotificationResponse(notification);
    } catch (error) {
      logger.error({ error, appId, organizationId, notificationId }, 'Failed to get notification log');
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

      // Normalize status: QUEUED -> PENDING
      const normalizedStatus = notification.status === 'QUEUED' ? 'PENDING' : notification.status;

      return {
        id: notification.id,
        status: normalizedStatus,
        recipient: notification.recipient,
        channel: notification.channel,
        sentAt: notification.sentAt ? notification.sentAt.toISOString() : null,
        createdAt: notification.createdAt ? notification.createdAt.toISOString() : null,
      };
    } catch (error) {
      logger.error({ error, notificationId }, 'Failed to get notification status');
      throw error;
    }
  }

  /**
   * Get logs for export
   */
  async getLogsForExport(
    appId: string,
    organizationId: string,
    filters: Omit<NotificationLogFilters, 'page' | 'limit'>
  ) {
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
      logger.error({ error, appId, organizationId }, 'Failed to get logs for export');
      throw error;
    }
  }

  /**
   * Format notification response
   */
  private formatNotificationResponse(notification: any) {
    const payload = notification.payload || {};
    const normalizedStatus = notification.status === 'QUEUED' ? 'PENDING' : notification.status;
    const deliveryState = this.getDeliveryState(normalizedStatus, notification.sentAt);

    const response: any = {
      id: notification.id,
      appId: notification.app_id,
      accountId: notification.account_id,
      recipient: notification.recipient,
      channel: notification.channel,
      status: normalizedStatus,
      deliveryState,
      source: payload.source || 'api',
      provider: payload.provider || 'internal',
      createdAt: notification.createdAt ? notification.createdAt.toISOString() : null,
      sentAt: notification.sentAt ? notification.sentAt.toISOString() : null,
      retryCount: notification.retryCount || 0,
    };

    this.addOptionalFields(response, notification, payload);
    this.addLogs(response, notification);

    return response;
  }

  /**
   * Determine delivery state based on status and sentAt timestamp
   */
  private getDeliveryState(status: string, sentAt: any): string {
    if (!sentAt) return 'PENDING_QUEUE';

    const stateMap: Record<string, string> = {
      DELIVERED: 'DELIVERED',
      FAILED: 'FAILED',
      BOUNCED: 'BOUNCED',
    };

    return stateMap[status] || 'SENT';
  }

  /**
   * Add optional fields to response
   */
  private addOptionalFields(response: any, notification: any, payload: any): void {
    const optionalFields: Record<string, [any, any]> = {
      templateId: [notification.templateId, notification.templateId],
      templateCode: [notification.templateCode, notification.templateCode],
      subject: [payload.subject, payload.subject],
      providerMessageId: [payload.providerMessageId, payload.providerMessageId],
      deliveredAt: [payload.deliveredAt, payload.deliveredAt],
      openedAt: [payload.openedAt, payload.openedAt],
      clickedAt: [payload.clickedAt, payload.clickedAt],
      bounceType: [payload.bounceType, payload.bounceType],
      errorMessage: [payload.errorMessage, payload.errorMessage],
      errorCode: [payload.errorCode, payload.errorCode],
    };

    Object.entries(optionalFields).forEach(([key, [, value]]) => {
      if (value) {
        response[key] = value;
      }
    });
  }

  /**
   * Add associated logs to response
   */
  private addLogs(response: any, notification: any): void {
    if (notification.logs?.length) {
      response.logs = notification.logs.map((log: any) => ({
        id: log.id,
        status: log.status,
        channel: log.channel,
        provider: log.provider,
        response: log.response,
        createdAt: log.createdAt ? log.createdAt.toISOString() : null,
      }));
    }
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

    // Normalize status for event checking
    const status = notification.status === 'QUEUED' ? 'PENDING' : notification.status;

    if (notification.createdAt) {
      events.push({
        type: 'created',
        timestamp: notification.createdAt.toISOString(),
        details: 'Notification created',
      });
    }

    if (notification.sentAt) {
      events.push({
        type: 'queued',
        timestamp: notification.sentAt.toISOString(),
        details: 'Notification queued for delivery',
      });
    }

    if (status === 'DELIVERED') {
      events.push({
        type: 'delivered',
        timestamp: notification.sentAt ? notification.sentAt.toISOString() : new Date().toISOString(),
        details: 'Notification delivered to recipient',
      });
    }

    if (status === 'FAILED') {
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
