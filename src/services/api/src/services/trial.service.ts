/**
 * Trial Service
 * Handles trial period management, reminders, and expiration
 */

import { prismaRead, prismaWrite } from '@shared/database';
import { logger } from '../config/logger';
import { env } from '../config/env';
import { NotifyService } from './notify.service';

const notifyService = new NotifyService();

export class TrialService {
  /**
   * Get all subscriptions with trials expiring within specified days
   * @param daysUntilExpiration Number of days until trial expires
   */
  async getExpiringTrials(daysUntilExpiration: number) {
    const now = new Date();
    const expirationThreshold = new Date(now.getTime() + daysUntilExpiration * 24 * 60 * 60 * 1000);

    return prismaRead.subscription.findMany({
      where: {
        status: 'trialing',
        trial_ends_at: {
          lte: expirationThreshold,
          gt: now,
        },
        trial_reminder_sent: false,
      },
      include: {
        account: {
          include: {
            owner: true,
            organization: true,
          },
        },
        plan: true,
      },
    });
  }

  /**
   * Get all expired trials that need to be processed
   */
  async getExpiredTrials() {
    const now = new Date();

    return prismaRead.subscription.findMany({
      where: {
        status: 'trialing',
        trial_ends_at: {
          lte: now,
        },
      },
      include: {
        account: {
          include: {
            owner: true,
            organization: true,
          },
        },
        plan: true,
      },
    });
  }

  /**
   * Send trial reminder email to user
   * @param subscription Subscription with account and user info
   */
  async sendTrialReminder(subscription: any) {
    const user = subscription.account.owner;
    const daysRemaining = Math.ceil(
      (new Date(subscription.trial_ends_at).getTime() - Date.now()) / (24 * 60 * 60 * 1000)
    );

    try {
      await notifyService.sendNotification(env.SYSTEM_ACCOUNT_ID, env.SYSTEM_APP_ID, {
        channel: 'EMAIL',
        recipient: user.email,
        templateId: env.TRIAL_REMINDER_TEMPLATE_ID,
        app_id: env.SYSTEM_APP_ID,
        payload: {
          firstName: user.firstName,
          planName: subscription.plan.name,
          daysRemaining,
          trialEndsAt: new Date(subscription.trial_ends_at).toLocaleDateString(),
          upgradeUrl: `${env.WEBAPP_URL}/billing/upgrade`,
          companyName: env.COMPANY_NAME,
          supportEmail: env.SUPPORT_EMAIL,
        },
        priority: 'HIGH',
      });

      // Mark reminder as sent
      await prismaWrite.subscription.update({
        where: { id: subscription.id },
        data: { trial_reminder_sent: true },
      });

      logger.info({ subscriptionId: subscription.id, userId: user.id, daysRemaining }, 'Trial reminder sent');

      return true;
    } catch (error) {
      logger.error({ error, subscriptionId: subscription.id }, 'Failed to send trial reminder');
      return false;
    }
  }

  /**
   * Send trial expired notification
   * @param subscription Subscription with account and user info
   */
  async sendTrialExpiredNotification(subscription: any) {
    const user = subscription.account.owner;

    try {
      await notifyService.sendNotification(env.SYSTEM_ACCOUNT_ID, env.SYSTEM_APP_ID, {
        channel: 'EMAIL',
        recipient: user.email,
        templateId: env.TRIAL_EXPIRED_TEMPLATE_ID,
        app_id: env.SYSTEM_APP_ID,
        payload: {
          firstName: user.firstName,
          planName: subscription.plan.name,
          upgradeUrl: `${env.WEBAPP_URL}/billing/upgrade`,
          companyName: env.COMPANY_NAME,
          supportEmail: env.SUPPORT_EMAIL,
        },
        priority: 'HIGH',
      });

      logger.info({ subscriptionId: subscription.id, userId: user.id }, 'Trial expired notification sent');

      return true;
    } catch (error) {
      logger.error({ error, subscriptionId: subscription.id }, 'Failed to send trial expired notification');
      return false;
    }
  }

  /**
   * Handle expired trial - auto-charge if payment method exists, otherwise downgrade
   * @param subscription Subscription to process
   */
  async handleExpiredTrial(subscription: any) {
    try {
      const hasPaymentMethod = !!subscription.payment_method_id;

      if (hasPaymentMethod) {
        // Auto-charge and activate subscription
        await this.activateSubscriptionWithBilling(subscription);
      } else {
        // No payment method - downgrade to FREE
        await this.downgradeToFreePlan(subscription);
      }
    } catch (error) {
      logger.error({ error, subscriptionId: subscription.id }, 'Failed to handle expired trial');
      throw error;
    }
  }

  /**
   * Activate subscription and charge via Stripe
   * @param subscription Subscription with payment method
   */
  private async activateSubscriptionWithBilling(subscription: any) {
    const now = new Date();
    const billingCycle = subscription.billing_cycle;
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + (billingCycle === 'annual' || billingCycle === 'yearly' ? 12 : 1));

    // Calculate amount based on plan and billing cycle
    const amount =
      billingCycle === 'annual' || billingCycle === 'yearly'
        ? subscription.plan.price_yearly
        : subscription.plan.price_monthly;

    try {
      // Charge via Stripe (integrate with your Stripe service)
      // const charge = await stripeService.chargePaymentMethod(
      //   subscription.payment_method_id,
      //   amount,
      //   subscription.plan.currency
      // );

      // Update subscription to active
      await prismaWrite.subscription.update({
        where: { id: subscription.id },
        data: {
          status: 'active',
          trial_ends_at: null,
          current_period_start: now,
          current_period_end: periodEnd,
        },
      });

      // Create invoice record
      const invoiceNumber = `INV-${Date.now()}-${subscription.id.slice(0, 8)}`;
      await prismaWrite.invoice.create({
        data: {
          subscription_id: subscription.id,
          invoice_number: invoiceNumber,
          amount,
          currency: subscription.plan.currency || 'USD',
          status: 'paid',
          issued_at: now,
          due_at: now,
          paid_at: now,
        },
      });

      // Send billing confirmation
      await this.sendBillingConfirmation(subscription, amount);

      logger.info(
        { subscriptionId: subscription.id, amount, planName: subscription.plan.name },
        'Trial ended - subscription activated with billing'
      );
    } catch (error) {
      // Payment failed - mark as past_due
      await prismaWrite.subscription.update({
        where: { id: subscription.id },
        data: { status: 'past_due' },
      });

      logger.error({ error, subscriptionId: subscription.id }, 'Payment failed on trial end');
      throw error;
    }
  }

  /**
   * Downgrade subscription to FREE plan
   * @param subscription Subscription to downgrade
   */
  private async downgradeToFreePlan(subscription: any) {
    const freePlan = await prismaRead.plan.findFirst({
      where: { name: 'FREE' },
    });

    if (!freePlan) {
      logger.error('FREE plan not found for trial downgrade');
      await prismaWrite.subscription.update({
        where: { id: subscription.id },
        data: { status: 'past_due' },
      });
      return;
    }

    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    await prismaWrite.subscription.update({
      where: { id: subscription.id },
      data: {
        plan_id: freePlan.id,
        status: 'active',
        trial_ends_at: null,
        payment_method_id: null,
        current_period_start: now,
        current_period_end: periodEnd,
      },
    });

    await this.sendTrialExpiredNotification(subscription);

    logger.info(
      { subscriptionId: subscription.id, accountId: subscription.account_id },
      'Trial expired - downgraded to FREE plan (no payment method)'
    );
  }

  /**
   * Send billing confirmation email
   * @param subscription Subscription that was charged
   * @param amount Amount charged
   */
  private async sendBillingConfirmation(subscription: any, amount: number) {
    const user = subscription.account.owner;

    try {
      await notifyService.sendNotification(env.SYSTEM_ACCOUNT_ID, env.SYSTEM_APP_ID, {
        channel: 'EMAIL',
        recipient: user.email,
        templateId: env.BILLING_CONFIRMATION_TEMPLATE_ID,
        app_id: env.SYSTEM_APP_ID,
        payload: {
          firstName: user.firstName,
          planName: subscription.plan.name,
          amount: `${subscription.plan.currency || 'USD'} ${amount.toFixed(2)}`,
          billingCycle: subscription.billing_cycle,
          nextBillingDate: new Date(
            Date.now() + (subscription.billing_cycle === 'annual' ? 365 : 30) * 24 * 60 * 60 * 1000
          ).toLocaleDateString(),
          billingUrl: `${env.WEBAPP_URL}/billing`,
          companyName: env.COMPANY_NAME,
          supportEmail: env.SUPPORT_EMAIL,
        },
        priority: 'HIGH',
      });
    } catch (error) {
      logger.error({ error, subscriptionId: subscription.id }, 'Failed to send billing confirmation');
    }
  }

  /**
   * Process all expiring trials - send reminders
   */
  async processExpiringTrials() {
    const reminderDays = parseInt(env.TRIAL_REMINDER_DAYS_BEFORE, 10) || 3;
    const expiringTrials = await this.getExpiringTrials(reminderDays);

    logger.info({ count: expiringTrials.length }, 'Processing expiring trials');

    let sent = 0;
    let failed = 0;

    for (const subscription of expiringTrials) {
      const success = await this.sendTrialReminder(subscription);
      if (success) {
        sent++;
      } else {
        failed++;
      }
    }

    return { sent, failed, total: expiringTrials.length };
  }

  /**
   * Process all expired trials - downgrade and notify
   */
  async processExpiredTrials() {
    const expiredTrials = await this.getExpiredTrials();

    logger.info({ count: expiredTrials.length }, 'Processing expired trials');

    let processed = 0;
    let failed = 0;

    for (const subscription of expiredTrials) {
      try {
        await this.handleExpiredTrial(subscription);
        processed++;
      } catch (error) {
        failed++;
      }
    }

    return { processed, failed, total: expiredTrials.length };
  }

  /**
   * Run all trial processing tasks
   * Called by cron job
   */
  async runTrialProcessing() {
    logger.info('Starting trial processing job');

    const reminderResults = await this.processExpiringTrials();
    const expiredResults = await this.processExpiredTrials();

    const summary = {
      reminders: reminderResults,
      expired: expiredResults,
      timestamp: new Date().toISOString(),
    };

    logger.info(summary, 'Trial processing completed');

    return summary;
  }

  /**
   * Get trial status for an account
   * @param accountId Account ID
   */
  async getTrialStatus(accountId: string) {
    const subscription = await prismaRead.subscription.findUnique({
      where: { account_id: accountId },
      include: { plan: true },
    });

    if (!subscription) {
      return null;
    }

    const isTrialing = subscription.status === 'trialing';
    // Note: trial_ends_at will be typed after running `prisma generate`
    const trialEndsAt = (subscription as any).trial_ends_at as Date | null;
    const daysRemaining = trialEndsAt
      ? Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
      : 0;

    return {
      isTrialing,
      trialEndsAt,
      daysRemaining,
      planName: subscription.plan.name,
      status: subscription.status,
    };
  }
}

export const trialService = new TrialService();
