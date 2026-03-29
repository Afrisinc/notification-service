import { prismaRead } from '@shared/database';
import { PlanManagementService } from '../services/plan-management.service';
import { logger } from '../config/logger';

export interface UsageLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
}

export class PlanEnforcementMiddleware {
  /**
   * Check if account can access a feature based on their plan
   */
  static async checkFeatureAccess(accountId: string, feature: string): Promise<boolean> {
    try {
      if (!accountId) return false;

      const subscription = await prismaRead.subscription.findUnique({
        where: { account_id: accountId },
        include: {
          plan: {
            include: { limits: true },
          },
        },
      });

      if (!subscription || subscription.status !== 'active') {
        return false;
      }

      // Feature-to-limit mapping
      const featureMap: Record<string, string> = {
        custom_domain: 'custom_domain',
        advanced_analytics: 'advanced_analytics',
        webhooks: 'webhooks',
        team_management: 'team_members',
        api_keys: 'api_keys',
      };

      const metric = featureMap[feature];
      if (!metric) return true; // Unknown feature = allow

      const limit = subscription.plan.limits.find((l) => l.metric === metric);

      // Boolean features - limit_value > 0 means enabled
      if (feature === 'custom_domain' || feature === 'advanced_analytics') {
        return limit ? limit.limit_value > 0 : false;
      }

      return true;
    } catch (error) {
      logger.error({ error, accountId, feature }, 'Failed to check feature access');
      return false;
    }
  }

  /**
   * Check if usage exceeds plan limit (considers overrides)
   */
  static async checkUsageLimit(accountId: string, metric: string): Promise<UsageLimitResult> {
    try {
      // Get effective limit (considering overrides from PlanManagementService)
      const effectiveLimit = await PlanManagementService.getEffectiveLimit(accountId, metric);

      if (effectiveLimit === -1) {
        return { allowed: true, remaining: -1, limit: -1 }; // Unlimited
      }

      // Get subscription to find the period
      const subscription = await prismaRead.subscription.findUnique({
        where: { account_id: accountId },
        include: { plan: { include: { limits: true } } },
      });

      if (!subscription) {
        return { allowed: false, remaining: 0, limit: 0 };
      }

      const planLimit = subscription.plan.limits.find((l) => l.metric === metric);

      if (!planLimit) {
        return { allowed: false, remaining: 0, limit: 0 };
      }

      // Get usage for current period
      const period = planLimit.period;
      const startDate = this.getPeriodStart(period);

      const usage = await prismaRead.usageRecord.aggregate({
        where: {
          account_id: accountId,
          metric,
          timestamp: { gte: startDate },
        },
        _sum: { quantity: true },
      });

      const used = usage._sum.quantity || 0;
      const remaining = Math.max(0, effectiveLimit - used);

      return {
        allowed: remaining > 0,
        remaining,
        limit: effectiveLimit,
      };
    } catch (error) {
      logger.error({ error, accountId, metric }, 'Failed to check usage limit');
      // Fail open - allow if check fails
      return { allowed: true, remaining: -1, limit: -1 };
    }
  }

  /**
   * Check entity count limit
   */
  static async checkEntityLimit(
    accountId: string,
    entity: 'apps' | 'templates' | 'campaigns' | 'contacts' | 'team_members' | 'api_keys'
  ): Promise<UsageLimitResult> {
    const metricMap: Record<string, string> = {
      apps: 'apps',
      templates: 'templates',
      campaigns: 'campaigns',
      contacts: 'contacts',
      team_members: 'team_members',
      api_keys: 'api_keys',
    };

    return this.checkUsageLimit(accountId, metricMap[entity]);
  }

  /**
   * Get period start date based on period type
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

  /**
   * Get subscription with all limits
   */
  static async getSubscriptionWithLimits(accountId: string) {
    return prismaRead.subscription.findUnique({
      where: { account_id: accountId },
      include: {
        plan: {
          include: { limits: true },
        },
        account: true,
      },
    });
  }
}
