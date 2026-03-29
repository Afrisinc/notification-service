import { SubscriptionRepository } from '../repositories/subscription.repository';
import { UsageTrackingService } from './usage-tracking.service';
import { logger } from '../config/logger';

export class SubscriptionService {
  /**
   * Get subscription details with usage
   */
  static async getSubscriptionDetails(accountId: string) {
    try {
      const subscription = await SubscriptionRepository.getSubscriptionWithLimits(accountId);

      if (!subscription) {
        throw new Error('Subscription not found');
      }

      const usage = await UsageTrackingService.getCurrentPeriodUsage(accountId);

      return {
        plan: subscription.plan.name,
        status: subscription.status,
        billingCycle: subscription.billing_cycle,
        provider: subscription.provider,
        currentPeriodStart: subscription.current_period_start,
        currentPeriodEnd: subscription.current_period_end,
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
      logger.error({ error, accountId }, 'Failed to get subscription details');
      throw error;
    }
  }

  /**
   * Get all available plans
   */
  static async getAvailablePlans() {
    try {
      const plans = await SubscriptionRepository.getPlans();

      return plans.map((plan) => ({
        id: plan.id,
        name: plan.name,
        priceMonthly: plan.price_monthly,
        priceYearly: plan.price_yearly,
        limits: plan.limits.map((limit) => ({
          metric: limit.metric,
          limit: limit.limit_value === -1 ? 'Unlimited' : limit.limit_value,
          period: limit.period,
        })),
      }));
    } catch (error) {
      logger.error({ error }, 'Failed to get available plans');
      throw error;
    }
  }

  /**
   * Upgrade or downgrade plan
   */
  static async changePlan(accountId: string, newPlanId: string) {
    try {
      // Validate plan exists
      const plan = await SubscriptionRepository.getPlanById(newPlanId);
      if (!plan) {
        throw new Error('Plan not found');
      }

      const subscription = await SubscriptionRepository.changePlan(accountId, newPlanId);

      logger.info({ accountId, planId: newPlanId }, 'Plan changed successfully');

      return {
        plan: plan.name,
        message: `Successfully upgraded to ${plan.name} plan`,
      };
    } catch (error) {
      logger.error({ error, accountId }, 'Failed to change plan');
      throw error;
    }
  }

  /**
   * Cancel subscription
   */
  static async cancelSubscription(accountId: string) {
    try {
      await SubscriptionRepository.updateSubscriptionStatus(accountId, 'cancelled');

      logger.info({ accountId }, 'Subscription cancelled');

      return {
        message: 'Subscription cancelled successfully',
      };
    } catch (error) {
      logger.error({ error, accountId }, 'Failed to cancel subscription');
      throw error;
    }
  }

  /**
   * Pause subscription
   */
  static async pauseSubscription(accountId: string) {
    try {
      await SubscriptionRepository.updateSubscriptionStatus(accountId, 'paused');

      logger.info({ accountId }, 'Subscription paused');

      return {
        message: 'Subscription paused successfully',
      };
    } catch (error) {
      logger.error({ error, accountId }, 'Failed to pause subscription');
      throw error;
    }
  }

  /**
   * Resume subscription
   */
  static async resumeSubscription(accountId: string) {
    try {
      await SubscriptionRepository.updateSubscriptionStatus(accountId, 'active');

      logger.info({ accountId }, 'Subscription resumed');

      return {
        message: 'Subscription resumed successfully',
      };
    } catch (error) {
      logger.error({ error, accountId }, 'Failed to resume subscription');
      throw error;
    }
  }
}
