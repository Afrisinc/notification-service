import { prismaRead } from '@shared/database';
import { logger } from '../config/logger';
import { env } from '../config/env';
import { NotifyService } from './notify.service';
import { NOTIFICATION_CHANNELS } from '../config/constants';

/**
 * Account owner details for email notifications
 */
interface AccountOwnerDetails {
  email: string;
  firstName: string | null;
  lastName: string | null;
}

/**
 * Subscription details for email templates
 */
interface SubscriptionDetails {
  planName: string;
  planPrice: number | null;
  billingCycle: string;
  status: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  trialEndsAt: Date | null;
}

/**
 * Service for sending subscription-related email notifications
 *
 * Handles billing confirmations, payment failures, trial reminders,
 * subscription cancellations, and plan changes.
 *
 * All methods are fire-and-forget safe (errors are logged but not thrown).
 */
export class SubscriptionNotificationService {
  private static notifyService = new NotifyService();

  /**
   * Get account owner details by account ID
   */
  private static async getAccountOwnerDetails(accountId: string): Promise<AccountOwnerDetails | null> {
    try {
      const account = await prismaRead.account.findUnique({
        where: { id: accountId },
        include: {
          owner: {
            select: {
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      if (!account?.owner?.email) return null;

      return {
        email: account.owner.email,
        firstName: account.owner.firstName,
        lastName: account.owner.lastName,
      };
    } catch (error) {
      logger.error({ error, accountId }, 'Failed to fetch account owner details');
      return null;
    }
  }

  /**
   * Get subscription details by account ID
   */
  private static async getSubscriptionDetails(accountId: string): Promise<SubscriptionDetails | null> {
    try {
      const subscription = await prismaRead.subscription.findUnique({
        where: { account_id: accountId },
        select: {
          status: true,
          billing_cycle: true,
          current_period_start: true,
          current_period_end: true,
          trial_ends_at: true,
          plan: {
            select: {
              name: true,
              price_monthly: true,
              price_yearly: true,
            },
          },
        },
      });

      if (!subscription) return null;

      const price =
        subscription.billing_cycle === 'yearly' ? subscription.plan.price_yearly : subscription.plan.price_monthly;

      return {
        planName: subscription.plan.name,
        planPrice: price ? Number(price) : null,
        billingCycle: subscription.billing_cycle,
        status: subscription.status,
        currentPeriodStart: subscription.current_period_start,
        currentPeriodEnd: subscription.current_period_end,
        trialEndsAt: subscription.trial_ends_at,
      };
    } catch (error) {
      logger.error({ error, accountId }, 'Failed to fetch subscription details');
      return null;
    }
  }

  /**
   * Format date for email templates
   */
  private static formatDate(date: Date | null): string {
    if (!date) return '';
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  /**
   * Format currency amount
   */
  private static formatAmount(cents: number | null, currency = 'USD'): string {
    if (cents === null) return '';
    const amount = cents / 100;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(amount);
  }

  /**
   * Build common template payload with user and subscription data
   */
  private static async buildEnrichedPayload(
    accountId: string,
    additionalData: Record<string, unknown> = {}
  ): Promise<{ owner: AccountOwnerDetails | null; payload: Record<string, unknown> }> {
    const owner = await this.getAccountOwnerDetails(accountId);
    const subscription = await this.getSubscriptionDetails(accountId);

    const payload: Record<string, unknown> = {
      // User info
      userName: owner?.firstName || owner?.email?.split('@')[0] || 'there',
      userEmail: owner?.email || '',
      firstName: owner?.firstName || '',
      lastName: owner?.lastName || '',

      // Subscription info
      planName: subscription?.planName || '',
      billingCycle: subscription?.billingCycle || '',
      status: subscription?.status || '',

      // Formatted amounts
      amount: this.formatAmount(subscription?.planPrice ?? null),
      amountCents: subscription?.planPrice ?? 0,

      // Formatted dates
      currentPeriodStart: this.formatDate(subscription?.currentPeriodStart ?? null),
      currentPeriodEnd: this.formatDate(subscription?.currentPeriodEnd ?? null),
      nextBillingDate: this.formatDate(subscription?.currentPeriodEnd ?? null),
      trialEndDate: this.formatDate(subscription?.trialEndsAt ?? null),

      // URLs
      billingUrl: `${env.WEBAPP_URL}/settings/billing`,
      updatePaymentUrl: `${env.WEBAPP_URL}/settings/billing/payment-method`,
      supportEmail: env.SUPPORT_EMAIL,
      companyName: env.COMPANY_NAME,

      // Merge additional data (overrides defaults)
      ...additionalData,
    };

    return { owner, payload };
  }

  /**
   * Send billing confirmation email after successful payment
   */
  static async sendBillingConfirmation(accountId: string, additionalData: Record<string, unknown> = {}): Promise<void> {
    if (!env.BILLING_CONFIRMATION_TEMPLATE_ID || !env.SYSTEM_APP_ID) {
      logger.debug({ accountId }, 'Billing confirmation template not configured, skipping');
      return;
    }

    try {
      const { owner, payload } = await this.buildEnrichedPayload(accountId, additionalData);

      if (!owner?.email) {
        logger.warn({ accountId }, 'No owner email found for billing confirmation');
        return;
      }

      await this.notifyService.sendNotification(env.SYSTEM_ACCOUNT_ID, env.SYSTEM_APP_ID, {
        channel: NOTIFICATION_CHANNELS.EMAIL as 'EMAIL',
        recipient: owner.email,
        templateId: env.BILLING_CONFIRMATION_TEMPLATE_ID,
        app_id: env.SYSTEM_APP_ID,
        payload,
      });

      logger.info({ accountId, email: owner.email }, 'Billing confirmation email sent');
    } catch (error) {
      logger.error({ error, accountId }, 'Failed to send billing confirmation email');
    }
  }

  /**
   * Send payment failed notification
   */
  static async sendPaymentFailed(accountId: string, additionalData: Record<string, unknown> = {}): Promise<void> {
    if (!env.PAYMENT_FAILED_TEMPLATE_ID || !env.SYSTEM_APP_ID) {
      logger.debug({ accountId }, 'Payment failed template not configured, skipping');
      return;
    }

    try {
      const { owner, payload } = await this.buildEnrichedPayload(accountId, additionalData);

      if (!owner?.email) {
        logger.warn({ accountId }, 'No owner email found for payment failed notification');
        return;
      }

      await this.notifyService.sendNotification(env.SYSTEM_ACCOUNT_ID, env.SYSTEM_APP_ID, {
        channel: NOTIFICATION_CHANNELS.EMAIL as 'EMAIL',
        recipient: owner.email,
        templateId: env.PAYMENT_FAILED_TEMPLATE_ID,
        app_id: env.SYSTEM_APP_ID,
        payload,
      });

      logger.info({ accountId, email: owner.email }, 'Payment failed email sent');
    } catch (error) {
      logger.error({ error, accountId }, 'Failed to send payment failed email');
    }
  }

  /**
   * Send trial ending reminder email
   */
  static async sendTrialReminder(accountId: string, additionalData: Record<string, unknown> = {}): Promise<void> {
    if (!env.TRIAL_REMINDER_TEMPLATE_ID || !env.SYSTEM_APP_ID) {
      logger.debug({ accountId }, 'Trial reminder template not configured, skipping');
      return;
    }

    try {
      const { owner, payload } = await this.buildEnrichedPayload(accountId, additionalData);

      if (!owner?.email) {
        logger.warn({ accountId }, 'No owner email found for trial reminder');
        return;
      }

      await this.notifyService.sendNotification(env.SYSTEM_ACCOUNT_ID, env.SYSTEM_APP_ID, {
        channel: NOTIFICATION_CHANNELS.EMAIL as 'EMAIL',
        recipient: owner.email,
        templateId: env.TRIAL_REMINDER_TEMPLATE_ID,
        app_id: env.SYSTEM_APP_ID,
        payload,
      });

      logger.info({ accountId, email: owner.email }, 'Trial reminder email sent');
    } catch (error) {
      logger.error({ error, accountId }, 'Failed to send trial reminder email');
    }
  }

  /**
   * Send trial expired notification
   */
  static async sendTrialExpired(accountId: string, additionalData: Record<string, unknown> = {}): Promise<void> {
    if (!env.TRIAL_EXPIRED_TEMPLATE_ID || !env.SYSTEM_APP_ID) {
      logger.debug({ accountId }, 'Trial expired template not configured, skipping');
      return;
    }

    try {
      const { owner, payload } = await this.buildEnrichedPayload(accountId, additionalData);

      if (!owner?.email) {
        logger.warn({ accountId }, 'No owner email found for trial expired notification');
        return;
      }

      await this.notifyService.sendNotification(env.SYSTEM_ACCOUNT_ID, env.SYSTEM_APP_ID, {
        channel: NOTIFICATION_CHANNELS.EMAIL as 'EMAIL',
        recipient: owner.email,
        templateId: env.TRIAL_EXPIRED_TEMPLATE_ID,
        app_id: env.SYSTEM_APP_ID,
        payload,
      });

      logger.info({ accountId, email: owner.email }, 'Trial expired email sent');
    } catch (error) {
      logger.error({ error, accountId }, 'Failed to send trial expired email');
    }
  }

  /**
   * Send subscription cancelled confirmation email
   */
  static async sendSubscriptionCancelled(
    accountId: string,
    additionalData: Record<string, unknown> = {}
  ): Promise<void> {
    if (!env.SUBSCRIPTION_CANCELLED_TEMPLATE_ID || !env.SYSTEM_APP_ID) {
      logger.debug({ accountId }, 'Subscription cancelled template not configured, skipping');
      return;
    }

    try {
      const { owner, payload } = await this.buildEnrichedPayload(accountId, {
        cancellationDate: this.formatDate(new Date()),
        ...additionalData,
      });

      if (!owner?.email) {
        logger.warn({ accountId }, 'No owner email found for subscription cancelled notification');
        return;
      }

      await this.notifyService.sendNotification(env.SYSTEM_ACCOUNT_ID, env.SYSTEM_APP_ID, {
        channel: NOTIFICATION_CHANNELS.EMAIL as 'EMAIL',
        recipient: owner.email,
        templateId: env.SUBSCRIPTION_CANCELLED_TEMPLATE_ID,
        app_id: env.SYSTEM_APP_ID,
        payload,
      });

      logger.info({ accountId, email: owner.email }, 'Subscription cancelled email sent');
    } catch (error) {
      logger.error({ error, accountId }, 'Failed to send subscription cancelled email');
    }
  }

  /**
   * Send plan changed confirmation email
   */
  static async sendPlanChanged(accountId: string, additionalData: Record<string, unknown> = {}): Promise<void> {
    if (!env.PLAN_CHANGED_TEMPLATE_ID || !env.SYSTEM_APP_ID) {
      logger.debug({ accountId }, 'Plan changed template not configured, skipping');
      return;
    }

    try {
      const { owner, payload } = await this.buildEnrichedPayload(accountId, additionalData);

      if (!owner?.email) {
        logger.warn({ accountId }, 'No owner email found for plan changed notification');
        return;
      }

      await this.notifyService.sendNotification(env.SYSTEM_ACCOUNT_ID, env.SYSTEM_APP_ID, {
        channel: NOTIFICATION_CHANNELS.EMAIL as 'EMAIL',
        recipient: owner.email,
        templateId: env.PLAN_CHANGED_TEMPLATE_ID,
        app_id: env.SYSTEM_APP_ID,
        payload,
      });

      logger.info({ accountId, email: owner.email }, 'Plan changed email sent');
    } catch (error) {
      logger.error({ error, accountId }, 'Failed to send plan changed email');
    }
  }
}
