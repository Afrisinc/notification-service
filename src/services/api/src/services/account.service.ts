/**
 * Account Service
 * Handles account management operations
 */

import { prismaWrite, prismaRead } from '@shared/database';
import { accountRepository } from '../repositories/account.repository';
import { appRepository } from '../repositories/app.repository';

export class AccountService {
  /**
   * Get accountId from organizationId (1 org = 1 account)
   * @param orgId Organization ID
   * @returns Account ID
   */
  async getAccountIdByOrgId(orgId: string): Promise<string> {
    const account = await accountRepository.findAccountByOrganizationId(orgId, { id: true });
    if (!account) {
      throw new Error('Organization account not found. Please contact support.');
    }
    return account.id;
  }

  async getAccountIdByAppId(appId: string): Promise<string> {
    const accountId = await appRepository.getAccountIdByAppId(appId);
    if (!accountId) {
      throw new Error('App not found');
    }
    return accountId;
  }

  /**
   * Get account details with enrollment information
   * @param accountId Account ID
   */
  async getAccountDetails(accountId: string): Promise<any> {
    try {
      const account = await prismaRead.account.findUnique({
        where: { id: accountId },
        include: {
          subscription: {
            include: {
              plan: true,
            },
          },
        },
      });

      return account;
    } catch (error) {
      throw new Error(`Failed to get account details: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Create subscription for account with specified plan name
   * @param accountId Account ID
   * @param planName Plan name (FREE, PRO, ENTERPRISE)
   * @param billingCycle Billing cycle (monthly | yearly)
   */
  async createSubscription(accountId: string, planName: string, billingCycle: string = 'monthly'): Promise<any> {
    try {
      // Find plan by name
      const plan = await prismaRead.plan.findFirst({
        where: { name: planName },
      });

      if (!plan) {
        throw new Error(`Plan not found: ${planName}`);
      }

      // All paid plans (non-FREE) get a 14-day trial period
      const isTrialEligible = plan.name.toUpperCase() !== 'FREE';

      return this.createSubscriptionWithPlan(accountId, plan.id, billingCycle, isTrialEligible);
    } catch (error) {
      throw new Error(`Failed to create subscription: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Create subscription for account with specified plan ID
   * @param accountId Account ID
   * @param planId Plan ID (e.g., "plan_starter_123")
   * @param billingCycle Billing cycle (monthly | annual)
   * @param paymentMethodId Stripe payment method ID (required for paid plans)
   */
  async createSubscriptionByPlanId(
    accountId: string,
    planId: string,
    billingCycle?: 'monthly' | 'annual',
    paymentMethodId?: string
  ): Promise<any> {
    try {
      // Verify plan exists and get plan details
      const plan = await prismaRead.plan.findUnique({
        where: { id: planId },
      });

      if (!plan) {
        throw new Error(`Plan not found: ${planId}`);
      }

      // All paid plans (non-FREE) get a 14-day trial period
      const isTrialEligible = plan.name.toUpperCase() !== 'FREE';

      return this.createSubscriptionWithPlan(
        accountId,
        planId,
        billingCycle || 'monthly',
        isTrialEligible,
        paymentMethodId
      );
    } catch (error) {
      throw new Error(`Failed to create subscription: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Internal helper to create subscription with plan ID
   * @param accountId Account ID
   * @param planId Plan ID
   * @param billingCycle Billing cycle
   * @param withTrial Whether to start with a 14-day trial period
   * @param paymentMethodId Stripe payment method ID
   */
  private async createSubscriptionWithPlan(
    accountId: string,
    planId: string,
    billingCycle: string,
    withTrial: boolean = false,
    paymentMethodId?: string
  ): Promise<any> {
    const now = new Date();
    const TRIAL_DAYS = 14;

    // Calculate trial end date (14 days from now)
    const trialEndsAt = withTrial ? new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000) : null;

    // Period start is now, period end depends on trial
    // During trial: period end = trial end date
    // After trial or no trial: period end = billing cycle end
    const periodEnd = new Date(now);
    if (withTrial) {
      // During trial, period end is trial end date
      periodEnd.setDate(periodEnd.getDate() + TRIAL_DAYS);
    } else {
      periodEnd.setMonth(periodEnd.getMonth() + (billingCycle === 'annual' || billingCycle === 'yearly' ? 12 : 1));
    }

    // Determine provider based on payment method
    const provider = paymentMethodId ? 'stripe' : 'manual';

    const subscription = await prismaWrite.subscription.create({
      data: {
        account_id: accountId,
        plan_id: planId,
        status: withTrial ? 'trialing' : 'active',
        billing_cycle: billingCycle,
        current_period_start: now,
        current_period_end: periodEnd,
        provider,
        payment_method_id: paymentMethodId,
        trial_ends_at: trialEndsAt,
        trial_reminder_sent: false,
      },
    });

    return subscription;
  }
}
