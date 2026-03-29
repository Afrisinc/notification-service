import { prismaWrite, prismaRead } from '@shared/database';
import { logger } from '../config/logger';

export class UsageTrackingService {
  /**
   * Record single usage metric
   */
  static async recordUsage(accountId: string, appId: string, metric: string, quantity: number = 1): Promise<void> {
    try {
      await prismaWrite.usageRecord.create({
        data: {
          account_id: accountId,
          app_id: appId,
          metric,
          quantity,
          timestamp: new Date(),
        },
      });

      logger.debug({ accountId, appId, metric, quantity }, 'Usage recorded');
    } catch (error) {
      logger.error({ error, accountId, appId, metric }, 'Failed to record usage');
      // Don't fail the request - log but continue
    }
  }

  /**
   * Record multiple usage metrics at once
   */
  static async recordBulkUsage(accountId: string, appId: string, metrics: Record<string, number>): Promise<void> {
    const records = Object.entries(metrics).map(([metric, quantity]) => ({
      account_id: accountId,
      app_id: appId,
      metric,
      quantity,
      timestamp: new Date(),
    }));

    try {
      await prismaWrite.usageRecord.createMany({ data: records });

      logger.debug({ accountId, appId, metricsCount: records.length }, 'Bulk usage recorded');
    } catch (error) {
      logger.error({ error, accountId, appId }, 'Failed to record bulk usage');
      // Don't fail the request
    }
  }

  /**
   * Get usage summary for a period
   */
  static async getUsageSummary(accountId: string, startDate: Date, endDate: Date): Promise<Record<string, number>> {
    try {
      const usage = await prismaRead.usageRecord.groupBy({
        by: ['metric'],
        where: {
          account_id: accountId,
          timestamp: { gte: startDate, lte: endDate },
        },
        _sum: { quantity: true },
      });

      const summary: Record<string, number> = {};
      for (const item of usage) {
        summary[item.metric] = item._sum.quantity || 0;
      }

      return summary;
    } catch (error) {
      logger.error({ error, accountId }, 'Failed to get usage summary');
      return {};
    }
  }

  /**
   * Get usage for current billing period
   */
  static async getCurrentPeriodUsage(accountId: string): Promise<Record<string, number>> {
    try {
      const subscription = await prismaRead.subscription.findUnique({
        where: { account_id: accountId },
        include: { plan: { include: { limits: true } } },
      });

      if (!subscription || subscription.plan.limits.length === 0) {
        return {};
      }

      // Use the period from first limit (should be consistent)
      const period = subscription.plan.limits[0].period;
      const startDate = this.getPeriodStart(period);
      const endDate = new Date();

      return this.getUsageSummary(accountId, startDate, endDate);
    } catch (error) {
      logger.error({ error, accountId }, 'Failed to get current period usage');
      return {};
    }
  }

  /**
   * Get detailed usage with limits
   */
  static async getUsageWithLimits(accountId: string) {
    try {
      const subscription = await prismaRead.subscription.findUnique({
        where: { account_id: accountId },
        include: {
          plan: {
            include: { limits: true },
          },
        },
      });

      if (!subscription) {
        return null;
      }

      const usage = await this.getCurrentPeriodUsage(accountId);

      return {
        plan: subscription.plan.name,
        billingCycle: subscription.billing_cycle,
        status: subscription.status,
        limits: subscription.plan.limits.map((limit) => ({
          metric: limit.metric,
          limit: limit.limit_value === -1 ? -1 : limit.limit_value,
          used: usage[limit.metric] || 0,
          remaining: limit.limit_value === -1 ? -1 : Math.max(0, limit.limit_value - (usage[limit.metric] || 0)),
          percentage: limit.limit_value === -1 ? 0 : ((usage[limit.metric] || 0) / limit.limit_value) * 100,
          period: limit.period,
        })),
      };
    } catch (error) {
      logger.error({ error, accountId }, 'Failed to get usage with limits');
      return null;
    }
  }

  /**
   * Get period start date
   */
  private static getPeriodStart(period: string): Date {
    const now = new Date();

    switch (period) {
      case 'monthly':
        return new Date(now.getFullYear(), now.getMonth(), 1);
      case 'yearly':
        return new Date(now.getFullYear(), 0, 1);
      case 'daily':
        return new Date(now.getFullYear(), now.getMonth(), now.getDate());
      default:
        return now;
    }
  }
}
