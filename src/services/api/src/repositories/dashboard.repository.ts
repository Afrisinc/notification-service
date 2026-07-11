/**
 * Dashboard Repository
 * Data access layer for dashboard metrics and statistics
 */

import { prismaRead } from '@shared/database';
import { logger } from '../config/logger';

export interface DashboardFilters {
  periodDays: number;
  dateFrom: Date;
  dateTo: Date;
}

export interface NotificationCountsByStatus {
  DELIVERED: number;
  FAILED: number;
  PENDING: number;
  QUEUED: number;
  SENT: number;
}

export interface NotificationCountsByChannel {
  EMAIL: number;
  SMS: number;
  PUSH: number;
  IN_APP: number;
  WHATSAPP: number;
}

export interface DailyVolumeItem {
  date: Date;
  channel: string;
  count: number;
}

export interface RecentNotificationGroup {
  accountId: string;
  channel: string;
  status: string;
  count: number;
  latestSentAt: Date;
}

export interface PeakHourData {
  dayOfWeek: number;
  hour: number;
  count: number;
}

export class DashboardRepository {
  /**
   * Get total notification count for a period
   */
  async getTotalNotificationCount(filters: DashboardFilters): Promise<number> {
    try {
      return await prismaRead.notification.count({
        where: {
          createdAt: {
            gte: filters.dateFrom,
            lte: filters.dateTo,
          },
        },
      });
    } catch (error) {
      logger.error({ error }, 'Failed to get total notification count');
      throw error;
    }
  }

  /**
   * Get notification counts grouped by status
   */
  async getNotificationCountsByStatus(filters: DashboardFilters): Promise<NotificationCountsByStatus> {
    try {
      const results = await prismaRead.notification.groupBy({
        by: ['status'],
        where: {
          createdAt: {
            gte: filters.dateFrom,
            lte: filters.dateTo,
          },
        },
        _count: true,
      });

      const counts: NotificationCountsByStatus = {
        DELIVERED: 0,
        FAILED: 0,
        PENDING: 0,
        QUEUED: 0,
        SENT: 0,
      };

      results.forEach((r) => {
        if (r.status in counts) {
          counts[r.status as keyof NotificationCountsByStatus] = r._count;
        }
      });

      return counts;
    } catch (error) {
      logger.error({ error }, 'Failed to get notification counts by status');
      throw error;
    }
  }

  /**
   * Get notification counts grouped by channel
   */
  async getNotificationCountsByChannel(filters: DashboardFilters): Promise<NotificationCountsByChannel> {
    try {
      const results = await prismaRead.notification.groupBy({
        by: ['channel'],
        where: {
          createdAt: {
            gte: filters.dateFrom,
            lte: filters.dateTo,
          },
        },
        _count: true,
      });

      const counts: NotificationCountsByChannel = {
        EMAIL: 0,
        SMS: 0,
        PUSH: 0,
        IN_APP: 0,
        WHATSAPP: 0,
      };

      results.forEach((r) => {
        if (r.channel in counts) {
          counts[r.channel as keyof NotificationCountsByChannel] = r._count;
        }
      });

      return counts;
    } catch (error) {
      logger.error({ error }, 'Failed to get notification counts by channel');
      throw error;
    }
  }

  /**
   * Get daily notification volume grouped by channel
   */
  async getDailyNotificationVolume(filters: DashboardFilters): Promise<DailyVolumeItem[]> {
    try {
      const notifications = await prismaRead.notification.findMany({
        where: {
          createdAt: {
            gte: filters.dateFrom,
            lte: filters.dateTo,
          },
        },
        select: {
          createdAt: true,
          channel: true,
        },
      });

      // Group by date and channel
      const volumeMap = new Map<string, DailyVolumeItem>();

      notifications.forEach((n) => {
        const dateStr = n.createdAt.toISOString().split('T')[0];
        const key = `${dateStr}-${n.channel}`;

        if (volumeMap.has(key)) {
          const item = volumeMap.get(key)!;
          item.count++;
        } else {
          volumeMap.set(key, {
            date: new Date(dateStr),
            channel: n.channel,
            count: 1,
          });
        }
      });

      return Array.from(volumeMap.values()).sort(
        (a, b) => a.date.getTime() - b.date.getTime() || a.channel.localeCompare(b.channel)
      );
    } catch (error) {
      logger.error({ error }, 'Failed to get daily notification volume');
      throw error;
    }
  }

  /**
   * Get previous period notification count for trend calculation
   */
  async getPreviousPeriodCount(currentFilters: DashboardFilters): Promise<number> {
    try {
      const periodMs = currentFilters.dateTo.getTime() - currentFilters.dateFrom.getTime();
      const previousFrom = new Date(currentFilters.dateFrom.getTime() - periodMs);
      const previousTo = new Date(currentFilters.dateFrom.getTime() - 1);

      return await prismaRead.notification.count({
        where: {
          createdAt: {
            gte: previousFrom,
            lte: previousTo,
          },
        },
      });
    } catch (error) {
      logger.error({ error }, 'Failed to get previous period count');
      throw error;
    }
  }

  /**
   * Get previous period delivery stats for trend calculation
   */
  async getPreviousPeriodDeliveryStats(
    currentFilters: DashboardFilters
  ): Promise<{ delivered: number; total: number }> {
    try {
      const periodMs = currentFilters.dateTo.getTime() - currentFilters.dateFrom.getTime();
      const previousFrom = new Date(currentFilters.dateFrom.getTime() - periodMs);
      const previousTo = new Date(currentFilters.dateFrom.getTime() - 1);

      const [delivered, total] = await Promise.all([
        prismaRead.notification.count({
          where: {
            createdAt: { gte: previousFrom, lte: previousTo },
            status: { in: ['DELIVERED', 'SENT'] },
          },
        }),
        prismaRead.notification.count({
          where: {
            createdAt: { gte: previousFrom, lte: previousTo },
          },
        }),
      ]);

      return { delivered, total };
    } catch (error) {
      logger.error({ error }, 'Failed to get previous period delivery stats');
      throw error;
    }
  }

  /**
   * Get active client (account) count
   */
  async getActiveClientCount(): Promise<number> {
    try {
      return await prismaRead.account.count();
    } catch (error) {
      logger.error({ error }, 'Failed to get active client count');
      throw error;
    }
  }

  /**
   * Get new clients count in period for trend
   */
  async getNewClientsInPeriod(filters: DashboardFilters): Promise<number> {
    try {
      return await prismaRead.account.count({
        where: {
          createdAt: {
            gte: filters.dateFrom,
            lte: filters.dateTo,
          },
        },
      });
    } catch (error) {
      logger.error({ error }, 'Failed to get new clients in period');
      throw error;
    }
  }

  /**
   * Get total template count
   */
  async getTemplateCount(): Promise<number> {
    try {
      return await prismaRead.template.count();
    } catch (error) {
      logger.error({ error }, 'Failed to get template count');
      throw error;
    }
  }

  /**
   * Get recent notification activity grouped by account
   */
  async getRecentActivity(limit: number, offset: number): Promise<{ items: RecentNotificationGroup[]; total: number }> {
    try {
      // Get recent notifications with account info
      const notifications = await prismaRead.notification.findMany({
        where: {
          sentAt: { not: null },
        },
        select: {
          id: true,
          account_id: true,
          channel: true,
          status: true,
          sentAt: true,
        },
        orderBy: { sentAt: 'desc' },
        take: 1000, // Get enough to aggregate
      });

      // Group by account, channel, status with time windows
      const groupMap = new Map<string, RecentNotificationGroup>();

      notifications.forEach((n) => {
        // Create time-window key (group notifications within same hour)
        const hourKey = n.sentAt
          ? `${n.account_id}-${n.channel}-${n.status}-${n.sentAt.toISOString().slice(0, 13)}`
          : `${n.account_id}-${n.channel}-${n.status}`;

        if (groupMap.has(hourKey)) {
          const group = groupMap.get(hourKey)!;
          group.count++;
          if (n.sentAt && n.sentAt > group.latestSentAt) {
            group.latestSentAt = n.sentAt;
          }
        } else {
          groupMap.set(hourKey, {
            accountId: n.account_id,
            channel: n.channel,
            status: n.status,
            count: 1,
            latestSentAt: n.sentAt || new Date(),
          });
        }
      });

      // Sort by latest sent time and paginate
      const allGroups = Array.from(groupMap.values()).sort(
        (a, b) => b.latestSentAt.getTime() - a.latestSentAt.getTime()
      );

      const total = allGroups.length;
      const items = allGroups.slice(offset, offset + limit);

      return { items, total };
    } catch (error) {
      logger.error({ error }, 'Failed to get recent activity');
      throw error;
    }
  }

  /**
   * Get account names by IDs
   */
  async getAccountNames(accountIds: string[]): Promise<Map<string, string>> {
    try {
      const accounts = await prismaRead.account.findMany({
        where: { id: { in: accountIds } },
        select: {
          id: true,
          owner: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
          organization: {
            select: {
              name: true,
            },
          },
        },
      });

      const nameMap = new Map<string, string>();

      accounts.forEach((acc) => {
        const name =
          acc.organization?.name || `${acc.owner?.firstName || ''} ${acc.owner?.lastName || ''}`.trim() || 'Unknown';
        nameMap.set(acc.id, name);
      });

      return nameMap;
    } catch (error) {
      logger.error({ error }, 'Failed to get account names');
      throw error;
    }
  }

  /**
   * Get peak send time data
   */
  async getPeakSendTime(filters: DashboardFilters): Promise<PeakHourData | null> {
    try {
      const notifications = await prismaRead.notification.findMany({
        where: {
          sentAt: {
            gte: filters.dateFrom,
            lte: filters.dateTo,
          },
        },
        select: {
          sentAt: true,
        },
      });

      if (notifications.length === 0) {
        return null;
      }

      // Group by day of week and hour
      const hourMap = new Map<string, PeakHourData>();

      notifications.forEach((n) => {
        if (n.sentAt) {
          const dayOfWeek = n.sentAt.getUTCDay();
          const hour = n.sentAt.getUTCHours();
          const key = `${dayOfWeek}-${hour}`;

          if (hourMap.has(key)) {
            hourMap.get(key)!.count++;
          } else {
            hourMap.set(key, { dayOfWeek, hour, count: 1 });
          }
        }
      });

      // Find peak
      let peak: PeakHourData | null = null;
      hourMap.forEach((data) => {
        if (!peak || data.count > peak.count) {
          peak = data;
        }
      });

      return peak;
    } catch (error) {
      logger.error({ error }, 'Failed to get peak send time');
      throw error;
    }
  }

  /**
   * Get system alerts for health status
   */
  async getSystemAlerts(): Promise<{ label: string; resolved: boolean }[]> {
    try {
      const alerts = await prismaRead.systemAlert.findMany({
        where: {
          created_at: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
          },
        },
        select: {
          title: true,
          resolved: true,
          type: true,
        },
        orderBy: { created_at: 'desc' },
        take: 10,
      });

      return alerts.map((a) => ({
        label: a.title,
        resolved: a.resolved,
      }));
    } catch (error) {
      logger.error({ error }, 'Failed to get system alerts');
      // Return empty array on error - don't fail dashboard
      return [];
    }
  }
}

export const dashboardRepository = new DashboardRepository();
