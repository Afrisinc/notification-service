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
