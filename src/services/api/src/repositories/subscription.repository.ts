import { prismaRead, prismaWrite } from '@shared/database';
import { logger } from '../config/logger';

export class SubscriptionRepository {
  /**
   * Get subscription with plan and limits
   */
  static async getSubscriptionWithLimits(accountId: string) {
    try {
      return prismaRead.subscription.findUnique({
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
      return prismaWrite.subscription.update({
        where: { account_id: accountId },
        data: { status },
        include: {
          plan: { include: { limits: true } },
        },
      });
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
      return prismaWrite.subscription.update({
        where: { account_id: accountId },
        data: { plan_id: planId },
        include: {
          plan: { include: { limits: true } },
        },
      });
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

      return prismaWrite.subscription.upsert({
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
