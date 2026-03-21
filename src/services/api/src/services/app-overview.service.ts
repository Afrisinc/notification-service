import pino from 'pino';
import { prismaRead } from '@shared/database';

const logger = pino();

export class AppOverviewService {
  /**
   * Get complete app overview with stats and analytics
   */
  async getAppOverview(
    appId: string,
    accountId: string,
    filters?: {
      startDate?: Date;
      endDate?: Date;
      channels?: string[];
    }
  ) {
    try {
      // Fetch app details
      const app = await prismaRead.app.findFirst({
        where: {
          id: appId,
          account_id: accountId,
        },
      });

      if (!app) {
        throw new Error('App not found');
      }

      // Fetch stats in parallel
      const [notificationCount, templateCount, apiKeyData, chartData, activityData] = await Promise.all([
        this.getTotalNotificationsSent(appId, filters),
        this.getTotalTemplates(appId),
        this.getApiKeyStats(appId),
        this.getChartData(appId, filters),
        this.getRecentActivity(appId, filters),
      ]);

      return {
        appId: app.id,
        name: app.name,
        environment: app.environment,
        stats: {
          totalNotificationsSent: notificationCount,
          totalTemplates: templateCount,
          totalApiKeys: apiKeyData.total,
          activeApiKeys: apiKeyData.active,
        },
        chartData,
        recentActivity: activityData,
      };
    } catch (error) {
      logger.error({ error, appId, accountId }, 'Failed to get app overview');
      throw error;
    }
  }

  /**
   * Get total notifications sent for app
   */
  private async getTotalNotificationsSent(
    appId: string,
    filters?: {
      startDate?: Date;
      endDate?: Date;
      channels?: string[];
    }
  ): Promise<number> {
    try {
      const where: any = {
        app_id: appId,
        status: { in: ['SENT', 'QUEUED'] },
      };

      if (filters?.startDate || filters?.endDate) {
        where.createdAt = {};
        if (filters.startDate) where.createdAt.gte = filters.startDate;
        if (filters.endDate) where.createdAt.lte = filters.endDate;
      }

      if (filters?.channels && filters.channels.length > 0) {
        where.channel = { in: filters.channels };
      }

      const count = await prismaRead.notification.count({ where });
      return count;
    } catch (error) {
      logger.warn({ error, appId }, 'Failed to count notifications');
      return 0;
    }
  }

  /**
   * Get total templates for app
   */
  private async getTotalTemplates(appId: string): Promise<number> {
    try {
      const count = await prismaRead.appTemplate.count({
        where: { app_id: appId },
      });
      return count;
    } catch (error) {
      logger.warn({ error, appId }, 'Failed to count templates');
      return 0;
    }
  }

  /**
   * Get API key stats
   */
  private async getApiKeyStats(appId: string): Promise<{ total: number; active: number }> {
    try {
      const keys = await prismaRead.apiKey.findMany({
        where: { app_id: appId },
        select: { id: true, revoked: true },
      });

      const total = keys.length;
      const active = keys.filter((k) => !k.revoked).length;

      return { total, active };
    } catch (error) {
      logger.warn({ error, appId }, 'Failed to get API key stats');
      return { total: 0, active: 0 };
    }
  }

  /**
   * Get chart data - notifications by channel for last 7 days
   */
  private async getChartData(
    appId: string,
    filters?: {
      startDate?: Date;
      endDate?: Date;
      channels?: string[];
    }
  ) {
    try {
      const where: any = {
        app_id: appId,
      };

      if (filters?.startDate || filters?.endDate) {
        where.createdAt = {};
        if (filters.startDate) where.createdAt.gte = filters.startDate;
        if (filters.endDate) where.createdAt.lte = filters.endDate;
      } else {
        // Default to last 7 days if no date range specified
        where.createdAt = {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        };
      }

      if (filters?.channels && filters.channels.length > 0) {
        where.channel = { in: filters.channels };
      }

      const notifications = await prismaRead.notification.findMany({
        where,
        select: {
          createdAt: true,
          channel: true,
        },
      });

      // Group by date and channel
      const dataMap = new Map<string, Record<string, number>>();

      notifications.forEach((n) => {
        const date = new Date(n.createdAt).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        });

        if (!dataMap.has(date)) {
          dataMap.set(date, { EMAIL: 0, SMS: 0, PUSH: 0, IN_APP: 0, WHATSAPP: 0 });
        }

        const channelKey = n.channel === 'IN_APP' ? 'IN_APP' : n.channel === 'PUSH' ? 'PUSH' : n.channel;
        const dayData = dataMap.get(date)!;
        dayData[channelKey] = (dayData[channelKey] || 0) + 1;
      });

      // Convert to array format
      const chartData = Array.from(dataMap.entries()).map(([date, channels]) => ({
        date,
        email: channels.EMAIL || 0,
        sms: channels.SMS || 0,
        push: channels.PUSH || 0,
        inApp: channels.IN_APP || 0,
      }));

      return chartData;
    } catch (error) {
      logger.warn({ error, appId }, 'Failed to get chart data');
      return [];
    }
  }

  /**
   * Get recent activity counts
   */
  private async getRecentActivity(
    appId: string,
    filters?: {
      startDate?: Date;
      endDate?: Date;
      channels?: string[];
    }
  ) {
    try {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);
      const monthAgo = new Date(now);
      monthAgo.setMonth(monthAgo.getMonth() - 1);

      const baseWhere: any = { app_id: appId };

      if (filters?.channels && filters.channels.length > 0) {
        baseWhere.channel = { in: filters.channels };
      }

      const [totalToday, totalThisWeek, totalThisMonth] = await Promise.all([
        prismaRead.notification.count({
          where: {
            ...baseWhere,
            createdAt: { gte: today, lte: filters?.endDate },
          },
        }),
        prismaRead.notification.count({
          where: {
            ...baseWhere,
            createdAt: { gte: filters?.startDate || weekAgo, lte: filters?.endDate },
          },
        }),
        prismaRead.notification.count({
          where: {
            ...baseWhere,
            createdAt: { gte: filters?.startDate || monthAgo, lte: filters?.endDate },
          },
        }),
      ]);

      return {
        totalToday,
        totalThisWeek,
        totalThisMonth,
      };
    } catch (error) {
      logger.warn({ error, appId }, 'Failed to get recent activity');
      return { totalToday: 0, totalThisWeek: 0, totalThisMonth: 0 };
    }
  }
}
