import { prismaRead } from '@shared/database';
import { PlanManagementService } from '../services/plan-management.service';
import { logger } from '../config/logger';

export interface UsageLimitResult {
  allowed: boolean;
  remaining: number; // -1 = unlimited
  limit: number; // -1 = unlimited
}

export class PlanEnforcementMiddleware {
  /**
   * Check if account can access a feature based on their plan.
   * Features stored as limit_value: 0 = false, ≥1 = true (or count allowed).
   */
  static async checkFeatureAccess(accountId: string, feature: string): Promise<boolean> {
    try {
      if (!accountId) return false;

      const subscription = await prismaRead.subscription.findUnique({
        where: { account_id: accountId },
        include: { plan: { include: { limits: true } } },
      });

      if (!subscription || subscription.status !== 'active') return false;

      const limit = subscription.plan.limits.find((l) => l.metric === feature);
      if (!limit) return false;

      // 0 = disabled, anything else (1, -1, or a count) = enabled
      return limit.limit_value !== 0;
    } catch (error) {
      logger.error({ error, accountId, feature }, 'Failed to check feature access');
      return false;
    }
  }

  /**
   * Check if account has remaining quota for a time-based usage metric.
   * Queries UsageRecord for the current period.
   */
  static async checkUsageLimit(accountId: string, metric: string): Promise<UsageLimitResult> {
    try {
      const effectiveLimit = await PlanManagementService.getEffectiveLimit(accountId, metric);

      if (effectiveLimit === -1) return { allowed: true, remaining: -1, limit: -1 };
      if (effectiveLimit === 0) return { allowed: false, remaining: 0, limit: 0 };

      const subscription = await prismaRead.subscription.findUnique({
        where: { account_id: accountId },
        include: { plan: { include: { limits: true } } },
      });

      if (!subscription) return { allowed: false, remaining: 0, limit: 0 };

      const planLimit = subscription.plan.limits.find((l) => l.metric === metric);
      if (!planLimit) return { allowed: false, remaining: 0, limit: 0 };

      const startDate = PlanEnforcementMiddleware.getPeriodStart(planLimit.period);

      const agg = await prismaRead.usageRecord.aggregate({
        where: { account_id: accountId, metric, timestamp: { gte: startDate } },
        _sum: { quantity: true },
      });

      const used = agg._sum.quantity ?? 0;
      const remaining = Math.max(0, effectiveLimit - used);

      return { allowed: remaining > 0, remaining, limit: effectiveLimit };
    } catch (error) {
      logger.error({ error, accountId, metric }, 'Failed to check usage limit');
      return { allowed: true, remaining: -1, limit: -1 }; // fail open
    }
  }

  /**
   * Check if account can create another entity (apps, contacts, etc.).
   * Queries the actual entity count in the DB — not usage records.
   */
  static async checkEntityLimit(
    accountId: string,
    entity: 'apps' | 'templates' | 'campaigns' | 'contacts' | 'team_members' | 'api_keys'
  ): Promise<UsageLimitResult> {
    try {
      const effectiveLimit = await PlanManagementService.getEffectiveLimit(accountId, entity);

      if (effectiveLimit === -1) return { allowed: true, remaining: -1, limit: -1 };
      if (effectiveLimit === 0) return { allowed: false, remaining: 0, limit: 0 };

      let currentCount = 0;

      switch (entity) {
        case 'apps':
          currentCount = await prismaRead.app.count({ where: { account_id: accountId } });
          break;
        case 'contacts':
          currentCount = await prismaRead.contact.count({ where: { app: { account_id: accountId } } });
          break;
        case 'templates':
          currentCount = await prismaRead.template.count({ where: { account_id: accountId } });
          break;
        case 'campaigns':
          currentCount = await prismaRead.campaign.count({
            where: { app: { account_id: accountId } },
          });
          break;
        case 'api_keys':
          currentCount = await prismaRead.apiKey.count({ where: { account_id: accountId } });
          break;
        case 'team_members':
          currentCount = await prismaRead.organizationMember.count({
            where: { organization: { accounts: { some: { id: accountId } } } },
          });
          if (currentCount === 0) currentCount = 1; // individual = just the owner
          break;
      }

      const remaining = Math.max(0, effectiveLimit - currentCount);
      return { allowed: remaining > 0, remaining, limit: effectiveLimit };
    } catch (error) {
      logger.error({ error, accountId, entity }, 'Failed to check entity limit');
      return { allowed: true, remaining: -1, limit: -1 };
    }
  }

  /**
   * Check if a PAYG account has sufficient credit balance for a planned send.
   */
  static async checkPaygBalance(
    accountId: string,
    channel: 'EMAIL' | 'SMS' | 'PUSH' | 'IN_APP',
    quantity: number
  ): Promise<UsageLimitResult & { insufficientFunds: boolean }> {
    try {
      const { PaygService } = await import('../services/payg.service');
      const check = await PaygService.checkSufficientBalance(accountId, channel, quantity);
      return {
        allowed: check.sufficient,
        remaining: check.available,
        limit: -1,
        insufficientFunds: !check.sufficient,
      };
    } catch (error) {
      logger.error({ error, accountId, channel }, 'Failed to check PAYG balance');
      return { allowed: false, remaining: 0, limit: -1, insufficientFunds: true };
    }
  }

  /**
   * Returns true if this account is on the PAYG plan.
   */
  static async isPaygAccount(accountId: string): Promise<boolean> {
    try {
      const subscription = await prismaRead.subscription.findUnique({
        where: { account_id: accountId },
        include: { plan: true },
      });
      const isPayg = subscription?.plan.name === 'PAYG';
      logger.debug(
        {
          accountId,
          hasSubscription: !!subscription,
          planName: subscription?.plan?.name,
          isPayg,
        },
        '[PAYG] isPaygAccount check'
      );
      return isPayg;
    } catch (error) {
      logger.error({ error, accountId }, '[PAYG] isPaygAccount check failed');
      return false;
    }
  }

  static async getSubscriptionWithLimits(accountId: string) {
    return prismaRead.subscription.findUnique({
      where: { account_id: accountId },
      include: { plan: { include: { limits: true } }, account: true },
    });
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
