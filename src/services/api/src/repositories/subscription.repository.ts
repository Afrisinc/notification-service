import { prismaRead, prismaWrite } from '@shared/database';
import { getOrSetCache, invalidateCache, cacheKeys, CACHE_TTL } from '@shared/cache';
import { logger } from '../config/logger';

export class SubscriptionRepository {
  /**
   * Get subscription with plan and limits.
   * Cached: this exact query is re-run several times per notify-send request
   * (plan enforcement, usage limit checks, PAYG checks all need it). A short
   * TTL also acts as a safety net for plan-definition changes (see
   * PlanManagementService.updateLimit/createLimit/deleteLimit), which mutate
   * PlanLimit rows shared across every account on that plan and so aren't
   * cheap to invalidate precisely by account.
   */
  static async getSubscriptionWithLimits(accountId: string) {
    return getOrSetCache(cacheKeys.subscription(accountId), CACHE_TTL.SUBSCRIPTION, async () => {
      try {
        return await prismaRead.subscription.findUnique({
          where: { account_id: accountId },
          include: {
            plan: {
              include: { limits: true },
            },
            account: true,
          },
        });
      } catch (error) {
        logger.error({ error, accountId }, 'Failed to get subscription with limits');
        throw error;
      }
    });
  }

  /**
   * Invalidate the cached subscription+plan+limits snapshot for an account.
   * Call this after any write that changes an account's subscription row
   * (status, plan, billing cycle) - including writes made outside this
   * repository (webhooks, trial processing, account creation).
   */
  static async invalidateCache(accountId: string): Promise<void> {
    await invalidateCache(cacheKeys.subscription(accountId));
  }

  /**
   * Get all subscriptions with filters
   */
  static async getSubscriptions(where?: any) {
    try {
      return prismaRead.subscription.findMany({
        where,
        include: {
          plan: {
            include: { limits: true },
          },
          account: true,
        },
      });
    } catch (error) {
      logger.error({ error }, 'Failed to get subscriptions');
      throw error;
    }
  }

  /**
   * Update subscription status
   */
  static async updateSubscriptionStatus(accountId: string, status: 'active' | 'inactive' | 'paused' | 'cancelled') {
    try {
      const result = await prismaWrite.subscription.update({
        where: { account_id: accountId },
        data: { status },
        include: {
          plan: { include: { limits: true } },
        },
      });
      await this.invalidateCache(accountId);
      return result;
    } catch (error) {
      logger.error({ error, accountId, status }, 'Failed to update subscription status');
      throw error;
    }
  }

  /**
   * Change plan (requires existing subscription row)
   */
  static async changePlan(accountId: string, planId: string) {
    try {
      const result = await prismaWrite.subscription.update({
        where: { account_id: accountId },
        data: { plan_id: planId },
        include: {
          plan: { include: { limits: true } },
        },
      });
      await this.invalidateCache(accountId);
      return result;
    } catch (error) {
      logger.error({ error, accountId, planId }, 'Failed to change plan');
      throw error;
    }
  }

  /**
   * Activate or upgrade a subscription from a confirmed payment.
   * Creates the subscription row if it doesn't exist yet (new accounts),
   * or updates the plan + billing cycle if one already exists.
   */
  static async activateFromPayment(accountId: string, planId: string, billingCycle: 'monthly' | 'yearly') {
    try {
      const now = new Date();
      const periodEnd = new Date(now);
      if (billingCycle === 'yearly') {
        periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      } else {
        periodEnd.setMonth(periodEnd.getMonth() + 1);
      }

      const result = await prismaWrite.subscription.upsert({
        where: { account_id: accountId },
        update: {
          plan_id: planId,
          billing_cycle: billingCycle,
          status: 'active',
          current_period_start: now,
          current_period_end: periodEnd,
        },
        create: {
          account_id: accountId,
          plan_id: planId,
          billing_cycle: billingCycle,
          status: 'active',
          provider: 'stripe',
          current_period_start: now,
          current_period_end: periodEnd,
        },
        include: {
          plan: { include: { limits: true } },
        },
      });
      await this.invalidateCache(accountId);
      return result;
    } catch (error) {
      logger.error({ error, accountId, planId, billingCycle }, 'Failed to activate subscription from payment');
      throw error;
    }
  }

  /**
   * Get all plans
   */
  static async getPlans() {
    try {
      return prismaRead.plan.findMany({
        include: { limits: true },
        orderBy: { price_monthly: 'asc' },
      });
    } catch (error) {
      logger.error({ error }, 'Failed to get plans');
      throw error;
    }
  }

  /**
   * Get plan by ID
   */
  static async getPlanById(planId: string) {
    try {
      return prismaRead.plan.findUnique({
        where: { id: planId },
        include: { limits: true },
      });
    } catch (error) {
      logger.error({ error, planId }, 'Failed to get plan');
      throw error;
    }
  }

  /**
   * Get plan by name
   */
  static async getPlanByName(name: string) {
    try {
      return prismaRead.plan.findUnique({
        where: { name },
        include: { limits: true },
      });
    } catch (error) {
      logger.error({ error, name }, 'Failed to get plan by name');
      throw error;
    }
  }

  /**
   * Get usage records for account
   */
  static async getUsageRecords(accountId: string, startDate: Date, endDate: Date, metric?: string) {
    try {
      return prismaRead.usageRecord.findMany({
        where: {
          account_id: accountId,
          timestamp: { gte: startDate, lte: endDate },
          ...(metric && { metric }),
        },
        orderBy: { timestamp: 'desc' },
      });
    } catch (error) {
      logger.error({ error, accountId }, 'Failed to get usage records');
      throw error;
    }
  }
}
