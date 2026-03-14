/**
 * Account Service
 * Handles account management operations
 */

import { prismaWrite, prismaRead } from '@shared/database';

export class AccountService {
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
   * Create subscription for account with specified plan
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

      // Create subscription with manual provider
      const now = new Date();
      const periodEnd = new Date(now);
      periodEnd.setMonth(periodEnd.getMonth() + (billingCycle === 'yearly' ? 12 : 1));

      const subscription = await prismaWrite.subscription.create({
        data: {
          account_id: accountId,
          plan_id: plan.id,
          status: 'active',
          billing_cycle: billingCycle,
          current_period_start: now,
          current_period_end: periodEnd,
          provider: 'manual',
        },
      });

      return subscription;
    } catch (error) {
      throw new Error(`Failed to create subscription: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
