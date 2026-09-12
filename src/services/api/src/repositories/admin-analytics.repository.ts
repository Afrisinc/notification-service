import type { Channel, NotificationStatus } from '@prisma/client';
import { prismaRead } from '@shared/database';

export interface NotificationVolumeRow {
  createdAt: Date;
  status: NotificationStatus;
}

export interface CampaignEngagementRow {
  sent_at: Date | null;
  createdAt: Date;
  channel: Channel;
  sent_count: number;
  open_count: number;
  click_count: number;
  bounce_count: number;
  unsubscribe_count: number;
}

export interface CampaignAggregate {
  sent: number;
  open: number;
  click: number;
  bounce: number;
  unsubscribe: number;
}

export interface TopAccountVolume {
  accountId: string;
  count: number;
}

export class AdminAnalyticsRepository {
  /**
   * Raw createdAt/status rows for the window - bucketed into weeks in the
   * service layer so this stays a single query instead of one per week.
   */
  static async getNotificationRows(dateFrom: Date, dateTo: Date): Promise<NotificationVolumeRow[]> {
    return prismaRead.notification.findMany({
      where: { createdAt: { gte: dateFrom, lte: dateTo } },
      select: { createdAt: true, status: true },
    });
  }

  /**
   * Raw campaign engagement rows for the window, keyed by send date. Falls
   * back to createdAt for campaigns that haven't finished sending yet
   * (sent_at is null). Bucketed into weeks/days in the service layer.
   */
  static async getCampaignRows(dateFrom: Date, dateTo: Date): Promise<CampaignEngagementRow[]> {
    return prismaRead.campaign.findMany({
      where: {
        OR: [{ sent_at: { gte: dateFrom, lte: dateTo } }, { sent_at: null, createdAt: { gte: dateFrom, lte: dateTo } }],
      },
      select: {
        sent_at: true,
        createdAt: true,
        channel: true,
        sent_count: true,
        open_count: true,
        click_count: true,
        bounce_count: true,
        unsubscribe_count: true,
      },
    });
  }

  static async getCampaignAggregate(dateFrom: Date, dateTo: Date, channel?: Channel): Promise<CampaignAggregate> {
    const result = await prismaRead.campaign.aggregate({
      where: {
        channel,
        OR: [{ sent_at: { gte: dateFrom, lte: dateTo } }, { sent_at: null, createdAt: { gte: dateFrom, lte: dateTo } }],
      },
      _sum: {
        sent_count: true,
        open_count: true,
        click_count: true,
        bounce_count: true,
        unsubscribe_count: true,
      },
    });

    return {
      sent: result._sum.sent_count || 0,
      open: result._sum.open_count || 0,
      click: result._sum.click_count || 0,
      bounce: result._sum.bounce_count || 0,
      unsubscribe: result._sum.unsubscribe_count || 0,
    };
  }

  static async getTopAccountsByVolume(dateFrom: Date, dateTo: Date, limit: number): Promise<TopAccountVolume[]> {
    const rows = await prismaRead.notification.groupBy({
      by: ['account_id'],
      where: { createdAt: { gte: dateFrom, lte: dateTo } },
      _count: { account_id: true },
      orderBy: { _count: { account_id: 'desc' } },
      take: limit,
    });

    return rows.map((row) => ({ accountId: row.account_id, count: row._count.account_id }));
  }

  static async getAccountPlans(accountIds: string[]): Promise<Map<string, string>> {
    const plans = new Map<string, string>();
    if (accountIds.length === 0) return plans;

    const accounts = await prismaRead.account.findMany({
      where: { id: { in: accountIds } },
      select: { id: true, subscription: { select: { plan: { select: { name: true } } } } },
    });

    accounts.forEach((account) => {
      plans.set(account.id, account.subscription?.plan?.name || 'FREE');
    });

    return plans;
  }
}

export const adminAnalyticsRepository = new AdminAnalyticsRepository();
