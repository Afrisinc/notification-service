import { prismaWrite, prismaRead } from '@shared/database';
import { logger } from '../config/logger';
import { accountLimitsNotification, type LimitCheckResult } from './account-limits-notification.service';

/** Threshold at which we consider usage "approaching" the limit (80%) */
const APPROACHING_THRESHOLD_PCT = 80;

export class UsageTrackingService {
  /**
   * Record single usage metric and trigger a limit alert check (fire-and-forget).
   */
  static async recordUsage(accountId: string, appId: string, metric: string, quantity: number = 1): Promise<void> {
    try {
      await prismaWrite.usageRecord.create({
        data: { account_id: accountId, app_id: appId, metric, quantity, timestamp: new Date() },
      });
      logger.debug({ accountId, appId, metric, quantity }, 'Usage recorded');
    } catch (error) {
      logger.error({ error, accountId, appId, metric }, 'Failed to record usage');
      return; // don't fail the caller's request
    }

    // Fire-and-forget limit check — errors are logged, never rethrown
    UsageTrackingService.checkAndAlert(accountId, metric).catch((err) => {
      logger.error({ err, accountId, metric }, 'Usage limit alert check failed');
    });
  }

  /**
   * Record multiple usage metrics at once.
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
      return;
    }

    for (const metric of Object.keys(metrics)) {
      UsageTrackingService.checkAndAlert(accountId, metric).catch((err) => {
        logger.error({ err, accountId, metric }, 'Bulk usage limit alert check failed');
      });
    }
  }

  /**
   * Check current-period usage against the plan limit for a single metric.
   * Fires an alert email via accountLimitsNotification when approaching or exceeded.
   * Internal — called after every recordUsage / recordBulkUsage.
   */
  private static async checkAndAlert(accountId: string, metric: string): Promise<void> {
    try {
      const subscription = await prismaRead.subscription.findUnique({
        where: { account_id: accountId },
        include: {
          plan: { include: { limits: true } },
          account: { include: { owner: true } },
        },
      });

      if (!subscription || subscription.status !== 'active') return;

      const planLimit = subscription.plan.limits.find((l) => l.metric === metric);
      // -1 = unlimited, 0 = feature not available on this plan — either way skip
      if (!planLimit || planLimit.limit_value <= 0) return;

      const startDate = UsageTrackingService.getPeriodStart(planLimit.period);
      const agg = await prismaRead.usageRecord.aggregate({
        where: { account_id: accountId, metric, timestamp: { gte: startDate } },
        _sum: { quantity: true },
      });

      const used = agg._sum.quantity ?? 0;
      const pct = (used / planLimit.limit_value) * 100;
      const status: LimitCheckResult['status'] =
        used >= planLimit.limit_value ? 'exceeded' : pct >= APPROACHING_THRESHOLD_PCT ? 'approaching' : 'ok';

      if (status === 'ok') return;

      const owner = subscription.account.owner;
      await accountLimitsNotification.checkAndNotify(
        {
          accountId,
          limitType: metric,
          currentUsage: used,
          limit: planLimit.limit_value,
          usagePercent: pct,
          status,
        },
        owner.email,
        `${owner.firstName} ${owner.lastName}`.trim()
      );
    } catch (error) {
      logger.error({ error, accountId, metric }, 'checkAndAlert failed');
    }
  }

  /**
   * Get usage summary for a date range.
   */
  static async getUsageSummary(accountId: string, startDate: Date, endDate: Date): Promise<Record<string, number>> {
    try {
      const usage = await prismaRead.usageRecord.groupBy({
        by: ['metric'],
        where: { account_id: accountId, timestamp: { gte: startDate, lte: endDate } },
        _sum: { quantity: true },
      });

      return Object.fromEntries(usage.map((u) => [u.metric, u._sum.quantity ?? 0]));
    } catch (error) {
      logger.error({ error, accountId }, 'Failed to get usage summary');
      return {};
    }
  }

  /**
   * Get usage for the current billing period (monthly metrics only).
   */
  static async getCurrentPeriodUsage(accountId: string): Promise<Record<string, number>> {
    try {
      const subscription = await prismaRead.subscription.findUnique({
        where: { account_id: accountId },
        include: { plan: { include: { limits: true } } },
      });

      if (!subscription || subscription.plan.limits.length === 0) return {};

      const startDate = UsageTrackingService.getPeriodStart('monthly');
      return UsageTrackingService.getUsageSummary(accountId, startDate, new Date());
    } catch (error) {
      logger.error({ error, accountId }, 'Failed to get current period usage');
      return {};
    }
  }

  /**
   * Full usage + limits breakdown for an account dashboard.
   */
  static async getUsageWithLimits(accountId: string) {
    try {
      const subscription = await prismaRead.subscription.findUnique({
        where: { account_id: accountId },
        include: { plan: { include: { limits: true } } },
      });

      if (!subscription) return null;

      const usage = await UsageTrackingService.getCurrentPeriodUsage(accountId);

      return {
        plan: subscription.plan.name,
        billingCycle: subscription.billing_cycle,
        status: subscription.status,
        limits: subscription.plan.limits.map((limit) => ({
          metric: limit.metric,
          limit: limit.limit_value,
          used: usage[limit.metric] ?? 0,
          remaining: limit.limit_value === -1 ? -1 : Math.max(0, limit.limit_value - (usage[limit.metric] ?? 0)),
          percentage: limit.limit_value <= 0 ? 0 : ((usage[limit.metric] ?? 0) / limit.limit_value) * 100,
          period: limit.period,
        })),
      };
    } catch (error) {
      logger.error({ error, accountId }, 'Failed to get usage with limits');
      return null;
    }
  }

  static getPeriodStart(period: string): Date {
    const now = new Date();
    switch (period) {
      case 'monthly':
        return new Date(now.getFullYear(), now.getMonth(), 1);
      case 'yearly':
        return new Date(now.getFullYear(), 0, 1);
      case 'daily':
        return new Date(now.getFullYear(), now.getMonth(), now.getDate());
      default:
        return new Date(now.getFullYear(), now.getMonth(), 1);
    }
  }
}
