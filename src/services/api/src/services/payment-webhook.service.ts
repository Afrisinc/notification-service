import { prismaWrite } from '@shared/database';
import { logger } from '../config/logger';
import { PaygService } from './payg.service';
import { PaygRepository } from '../repositories/payg.repository';
import { SubscriptionRepository } from '../repositories/subscription.repository';
import { SubscriptionNotificationService } from './subscription-notification.service';
import type { CreditTransactionStatus } from '../types/payg.types';

/**
 * Webhook event data from afrisinc-pay
 */
export interface WebhookEventPayload {
  event: string;
  timestamp: string;
  data: Record<string, unknown>;
}

/**
 * One-off payment data structure
 */
export interface PaymentEventData {
  paymentId: string;
  orderId: string;
  amount: number;
  currency: string;
  status: string;
  customerEmail?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Mobile money payment event data structure
 */
export interface MobilePaymentEventData {
  paymentId: string;
  ref: string;
  orderId: string;
  amount: number;
  currency: string;
  phoneNumber: string;
  type: 'CASHIN' | 'CASHOUT';
  status: 'SUCCESSFUL' | 'FAILED';
  fee?: number;
  provider?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Subscription event data structure
 */
export interface SubscriptionEventData {
  accountId: string;
  subscriptionId: string;
  status?: string;
  currentPeriodStart?: number;
  currentPeriodEnd?: number;
  canceledAt?: number | null;
}

/**
 * Result of webhook processing
 */
export interface WebhookProcessResult {
  success: boolean;
  skipped?: boolean;
  error?: string;
}

/**
 * Service for processing payment webhook events from afrisinc-pay
 *
 * Handles:
 * - One-off payments (template purchases, subscription upgrades, PAYG top-ups)
 * - Subscription lifecycle events (payment success/failure, trial reminders, updates, cancellations)
 */
export class PaymentWebhookService {
  /**
   * Route and process a webhook event
   *
   * @param payload Webhook event payload
   * @returns Processing result
   */
  /**
   * Settle the PENDING credit transaction created at payment initialization.
   * Keyed by orderId (payment_ref); a no-op for legacy payments without one.
   */
  private static async settlePendingTransaction(
    orderId: string | undefined,
    status: CreditTransactionStatus
  ): Promise<void> {
    if (!orderId) return;
    try {
      const result = await PaygRepository.markTransactionStatus(orderId, status);
      if (result.count > 0) {
        logger.info({ orderId, status, count: result.count }, 'Pending credit transaction settled');
      }
    } catch (error) {
      logger.error({ error, orderId, status }, 'Failed to settle pending credit transaction');
    }
  }

  static async processEvent(payload: WebhookEventPayload): Promise<WebhookProcessResult> {
    const { event, data } = payload;

    logger.debug({ event }, 'Processing webhook event');

    // Card payment events (subscriptions via ITEC)
    if (event.startsWith('card.')) {
      return this.processCardPaymentEvent(event, data as unknown as PaymentEventData);
    }

    // Subscription lifecycle events
    if (event.startsWith('subscription.')) {
      return this.processSubscriptionEvent(event, data);
    }

    // Mobile money payment events
    if (event.startsWith('mobile.')) {
      return this.processMobilePaymentEvent(event, data as unknown as MobilePaymentEventData);
    }

    // One-off payment events
    if (event === 'payment.succeeded') {
      return this.processPaymentSucceeded(data as unknown as PaymentEventData);
    }

    // Unknown event - acknowledge but skip processing
    logger.debug({ event }, 'Skipping unhandled webhook event');
    return { success: true, skipped: true };
  }

  /**
   * Process subscription lifecycle events
   */
  private static async processSubscriptionEvent(
    event: string,
    data: Record<string, unknown>
  ): Promise<WebhookProcessResult> {
    const eventData = this.parseSubscriptionEventData(data);

    if (!eventData.accountId || !eventData.subscriptionId) {
      logger.warn({ event, data }, 'Subscription event missing required fields');
      return { success: false, error: 'Missing required fields (accountId, subscriptionId)' };
    }

    switch (event) {
      case 'subscription.payment_succeeded':
        return this.handleSubscriptionPaymentSucceeded(eventData);

      case 'subscription.payment_failed':
        return this.handleSubscriptionPaymentFailed(eventData);

      case 'subscription.trial_will_end':
        return this.handleSubscriptionTrialWillEnd(eventData);

      case 'subscription.updated':
        return this.handleSubscriptionUpdated(eventData);

      case 'subscription.canceled':
        return this.handleSubscriptionCanceled(eventData);

      default:
        logger.debug({ event }, 'Skipping unhandled subscription event');
        return { success: true, skipped: true };
    }
  }

  /**
   * Parse subscription event data from raw webhook payload
   */
  private static parseSubscriptionEventData(data: Record<string, unknown>): SubscriptionEventData {
    return {
      accountId: data['accountId'] as string,
      subscriptionId: data['subscriptionId'] as string,
      status: data['status'] as string | undefined,
      currentPeriodStart: data['currentPeriodStart'] as number | undefined,
      currentPeriodEnd: data['currentPeriodEnd'] as number | undefined,
      canceledAt: data['canceledAt'] as number | null | undefined,
    };
  }

  /**
   * Handle subscription.payment_succeeded event
   * Stripe auto-charged after trial or monthly renewal
   */
  private static async handleSubscriptionPaymentSucceeded(data: SubscriptionEventData): Promise<WebhookProcessResult> {
    const { accountId, subscriptionId, currentPeriodStart, currentPeriodEnd } = data;

    try {
      await prismaWrite.subscription.updateMany({
        where: { account_id: accountId, provider_id: subscriptionId },
        data: {
          status: 'active',
          ...(currentPeriodStart && { current_period_start: new Date(currentPeriodStart * 1000) }),
          ...(currentPeriodEnd && { current_period_end: new Date(currentPeriodEnd * 1000) }),
        },
      });

      logger.info({ accountId, subscriptionId }, 'Subscription payment succeeded - status synced to active');

      // Send billing confirmation (fire-and-forget)
      SubscriptionNotificationService.sendBillingConfirmation(accountId).catch((err) =>
        logger.error({ err, accountId }, 'Failed to send billing confirmation')
      );

      return { success: true };
    } catch (error) {
      logger.error({ error, accountId, subscriptionId }, 'Failed to sync subscription after payment');
      return { success: false, error: 'Failed to sync subscription' };
    }
  }

  /**
   * Handle subscription.payment_failed event
   * Stripe failed to collect after all retries
   */
  private static async handleSubscriptionPaymentFailed(data: SubscriptionEventData): Promise<WebhookProcessResult> {
    const { accountId, subscriptionId } = data;

    try {
      await prismaWrite.subscription.updateMany({
        where: { account_id: accountId, provider_id: subscriptionId },
        data: { status: 'past_due' },
      });

      logger.warn({ accountId, subscriptionId }, 'Subscription payment failed - status set to past_due');

      // Send payment failed notification (fire-and-forget)
      SubscriptionNotificationService.sendPaymentFailed(accountId).catch((err) =>
        logger.error({ err, accountId }, 'Failed to send payment failed notification')
      );

      return { success: true };
    } catch (error) {
      logger.error({ error, accountId, subscriptionId }, 'Failed to update subscription to past_due');
      return { success: false, error: 'Failed to update subscription' };
    }
  }

  /**
   * Handle subscription.trial_will_end event
   * Stripe fires 3 days before trial ends
   */
  private static async handleSubscriptionTrialWillEnd(data: SubscriptionEventData): Promise<WebhookProcessResult> {
    const { accountId, subscriptionId } = data;

    try {
      await prismaWrite.subscription.updateMany({
        where: { account_id: accountId, provider_id: subscriptionId },
        data: { trial_reminder_sent: true },
      });

      logger.info({ accountId, subscriptionId }, 'Trial ending soon - reminder marked');

      // Send trial reminder (fire-and-forget)
      SubscriptionNotificationService.sendTrialReminder(accountId).catch((err) =>
        logger.error({ err, accountId }, 'Failed to send trial reminder')
      );

      return { success: true };
    } catch (error) {
      logger.error({ error, accountId, subscriptionId }, 'Failed to process trial_will_end');
      return { success: false, error: 'Failed to process trial reminder' };
    }
  }

  /**
   * Handle subscription.updated event
   * Stripe subscription status changed (plan upgrade/downgrade, billing cycle change)
   */
  private static async handleSubscriptionUpdated(data: SubscriptionEventData): Promise<WebhookProcessResult> {
    const { accountId, subscriptionId, status, currentPeriodStart, currentPeriodEnd } = data;

    if (!status) {
      logger.warn({ data }, 'subscription.updated missing status field');
      return { success: false, error: 'Missing status field' };
    }

    try {
      await prismaWrite.subscription.updateMany({
        where: { account_id: accountId, provider_id: subscriptionId },
        data: {
          status,
          ...(currentPeriodStart && { current_period_start: new Date(currentPeriodStart * 1000) }),
          ...(currentPeriodEnd && { current_period_end: new Date(currentPeriodEnd * 1000) }),
        },
      });

      logger.info({ accountId, subscriptionId, status }, 'Subscription status synced');

      // Send plan changed notification (fire-and-forget)
      // The notification service will fetch current plan details
      SubscriptionNotificationService.sendPlanChanged(accountId, {
        newStatus: status,
      }).catch((err) => logger.error({ err, accountId }, 'Failed to send plan changed notification'));

      return { success: true };
    } catch (error) {
      logger.error({ error, accountId, subscriptionId }, 'Failed to sync subscription update');
      return { success: false, error: 'Failed to sync subscription' };
    }
  }

  /**
   * Handle subscription.canceled event
   * Subscription cancelled (user or Stripe)
   */
  private static async handleSubscriptionCanceled(data: SubscriptionEventData): Promise<WebhookProcessResult> {
    const { accountId, subscriptionId, canceledAt } = data;
    const cancellationDate = canceledAt ? new Date(canceledAt * 1000) : new Date();

    try {
      await prismaWrite.subscription.updateMany({
        where: { account_id: accountId, provider_id: subscriptionId },
        data: {
          status: 'cancelled',
          canceled_at: cancellationDate,
        },
      });

      logger.info({ accountId, subscriptionId }, 'Subscription cancelled and synced');

      // Send subscription cancelled confirmation (fire-and-forget)
      SubscriptionNotificationService.sendSubscriptionCancelled(accountId, {
        cancellationDate: cancellationDate.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
      }).catch((err) => logger.error({ err, accountId }, 'Failed to send subscription cancelled notification'));

      return { success: true };
    } catch (error) {
      logger.error({ error, accountId, subscriptionId }, 'Failed to sync subscription cancellation');
      return { success: false, error: 'Failed to cancel subscription' };
    }
  }

  // ─── Card Payment Events (ITEC PesaPal) ──────────────────────────────────────

  /**
   * Process card payment events from afrisinc-pay (ITEC PesaPal)
   * Handles payment.succeeded and payment.failed for card payments
   */
  private static async processCardPaymentEvent(event: string, data: PaymentEventData): Promise<WebhookProcessResult> {
    switch (event) {
      case 'card.payment_succeeded':
        return this.handleCardPaymentSucceeded(data);

      case 'card.payment_failed':
        return this.handleCardPaymentFailed(data);

      default:
        logger.debug({ event }, 'Skipping unhandled card payment event');
        return { success: true, skipped: true };
    }
  }

  /**
   * Handle card.payment_succeeded event
   * Activates subscription plan after card payment confirmation
   */
  private static async handleCardPaymentSucceeded(data: PaymentEventData): Promise<WebhookProcessResult> {
    await this.settlePendingTransaction(data.orderId, 'COMPLETED');

    const accountId = data.metadata?.['accountId'] as string | undefined;

    if (!accountId) {
      logger.warn({ paymentId: data.paymentId }, 'Card payment missing accountId in metadata');
      return { success: false, error: 'Missing accountId in metadata' };
    }

    const paymentType = data.metadata?.['paymentType'] as string | undefined;

    // Route based on payment type
    switch (paymentType) {
      case 'subscription':
        return this.handleCardSubscriptionPayment(data, accountId);

      default:
        logger.debug({ paymentId: data.paymentId, paymentType }, 'Skipping unhandled card payment type');
        return { success: true, skipped: true };
    }
  }

  /**
   * Handle subscription payment via card (ITEC)
   */
  private static async handleCardSubscriptionPayment(
    data: PaymentEventData,
    accountId: string
  ): Promise<WebhookProcessResult> {
    const planId = data.metadata?.['planId'] as string | undefined;
    const billingCycle = (data.metadata?.['billingCycle'] as string | undefined) ?? 'monthly';

    if (!planId) {
      logger.warn({ paymentId: data.paymentId }, 'Card subscription payment missing planId');
      return { success: false, error: 'Missing planId in metadata' };
    }

    try {
      await SubscriptionRepository.activateFromPayment(accountId, planId, billingCycle as 'monthly' | 'yearly');

      logger.info(
        { accountId, planId, billingCycle, paymentId: data.paymentId },
        'Subscription activated from card payment (ITEC)'
      );

      // Send billing confirmation notification (fire-and-forget)
      SubscriptionNotificationService.sendBillingConfirmation(accountId).catch((err) =>
        logger.error({ err, accountId }, 'Failed to send billing confirmation')
      );

      return { success: true };
    } catch (error) {
      logger.error(
        { error, accountId, planId, paymentId: data.paymentId },
        'Failed to activate subscription from card payment'
      );
      return { success: false, error: 'Failed to activate plan' };
    }
  }

  /**
   * Handle card.payment_failed event
   */
  private static async handleCardPaymentFailed(data: PaymentEventData): Promise<WebhookProcessResult> {
    await this.settlePendingTransaction(data.orderId, 'FAILED');

    const accountId = data.metadata?.['accountId'] as string | undefined;

    if (accountId) {
      logger.warn({ accountId, paymentId: data.paymentId, amount: data.amount }, 'Card payment failed');

      // Send payment failed notification (fire-and-forget)
      SubscriptionNotificationService.sendPaymentFailed(accountId).catch((err) =>
        logger.error({ err, accountId }, 'Failed to send payment failed notification')
      );
    }

    return { success: true };
  }

  /**
   * Process one-off payment.succeeded events
   */
  private static async processPaymentSucceeded(data: PaymentEventData): Promise<WebhookProcessResult> {
    await this.settlePendingTransaction(data.orderId, 'COMPLETED');

    const accountId = data.metadata?.['accountId'] as string | undefined;

    if (!accountId) {
      logger.warn({ paymentId: data.paymentId }, 'payment.succeeded missing accountId in metadata');
      return { success: false, error: 'Missing accountId in metadata' };
    }

    const paymentType = data.metadata?.['paymentType'] as string | undefined;

    // Route to appropriate handler based on payment type
    switch (paymentType) {
      case 'template':
      case 'template_purchase':
        return this.handleTemplatePayment(data, accountId);

      case 'subscription':
        return this.handleSubscriptionUpgradePayment(data, accountId);

      default:
        // Default to PAYG top-up
        return this.handlePaygTopUp(data, accountId);
    }
  }

  /**
   * Handle template purchase payment
   */
  private static async handleTemplatePayment(data: PaymentEventData, accountId: string): Promise<WebhookProcessResult> {
    const templateId = data.metadata?.['templateId'] as string | undefined;
    const appId = data.metadata?.['appId'] as string | undefined;

    if (!templateId || !appId) {
      logger.warn({ paymentId: data.paymentId }, 'Template payment missing templateId or appId');
      return { success: false, error: 'Missing templateId or appId in metadata' };
    }

    try {
      const { marketplaceService } = await import('./marketplace.service');
      await marketplaceService.installTemplate(templateId, appId, accountId, {});

      logger.info({ accountId, templateId, appId, paymentId: data.paymentId }, 'Template installed from payment');

      return { success: true };
    } catch (error) {
      logger.error(
        { error, accountId, templateId, appId, paymentId: data.paymentId },
        'Failed to install template from payment'
      );
      return { success: false, error: 'Failed to install template' };
    }
  }

  /**
   * Handle subscription upgrade payment (plan upgrade via PaymentIntent)
   */
  private static async handleSubscriptionUpgradePayment(
    data: PaymentEventData,
    accountId: string
  ): Promise<WebhookProcessResult> {
    const planId = data.metadata?.['planId'] as string | undefined;
    const billingCycle = (data.metadata?.['billingCycle'] as string | undefined) ?? 'monthly';

    if (!planId) {
      logger.warn({ paymentId: data.paymentId }, 'Subscription payment missing planId');
      return { success: false, error: 'Missing planId in metadata' };
    }

    try {
      await SubscriptionRepository.activateFromPayment(accountId, planId, billingCycle as 'monthly' | 'yearly');

      logger.info(
        { accountId, planId, billingCycle, paymentId: data.paymentId },
        'Subscription activated from payment'
      );

      return { success: true };
    } catch (error) {
      logger.error({ error, accountId, planId, paymentId: data.paymentId }, 'Failed to activate subscription plan');
      return { success: false, error: 'Failed to activate plan' };
    }
  }

  /**
   * Handle PAYG balance top-up
   */
  private static async handlePaygTopUp(data: PaymentEventData, accountId: string): Promise<WebhookProcessResult> {
    try {
      await PaygService.creditFromPayment({
        accountId,
        amountCents: data.amount,
        paymentRef: data.paymentId,
      });

      logger.info({ accountId, paymentId: data.paymentId, amount: data.amount }, 'PAYG balance credited from payment');

      return { success: true };
    } catch (error) {
      logger.error({ error, accountId, paymentId: data.paymentId }, 'Failed to credit PAYG balance');
      return { success: false, error: 'Failed to credit balance' };
    }
  }

  // ─── Mobile Money Payment Events ──────────────────────────────────────────────

  /**
   * Process mobile money payment events
   */
  private static async processMobilePaymentEvent(
    event: string,
    data: MobilePaymentEventData
  ): Promise<WebhookProcessResult> {
    switch (event) {
      case 'mobile.payment_succeeded':
        return this.handleMobilePaymentSucceeded(data);

      case 'mobile.payment_failed':
        return this.handleMobilePaymentFailed(data);

      default:
        logger.debug({ event }, 'Skipping unhandled mobile payment event');
        return { success: true, skipped: true };
    }
  }

  /**
   * Handle mobile.payment_succeeded event
   * Routes to appropriate handler based on payment type (PAYG or subscription)
   */
  private static async handleMobilePaymentSucceeded(data: MobilePaymentEventData): Promise<WebhookProcessResult> {
    await this.settlePendingTransaction(data.orderId, 'COMPLETED');

    const accountId = data.metadata?.['accountId'] as string | undefined;
    const paymentType = data.metadata?.['type'] as string | undefined;

    if (!accountId) {
      logger.warn({ ref: data.ref, orderId: data.orderId }, 'Mobile payment missing accountId in metadata');
      return { success: false, error: 'Missing accountId in metadata' };
    }

    // Route based on payment type
    switch (paymentType) {
      case 'payg_topup':
        return this.handleMobilePaygTopUp(data, accountId);

      case 'subscription':
        return this.handleMobileSubscriptionPayment(data, accountId);

      case 'template_purchase':
        return this.handleMobileTemplatePurchase(data, accountId);

      default:
        logger.debug({ ref: data.ref, paymentType }, 'Skipping unhandled mobile payment type');
        return { success: true, skipped: true };
    }
  }

  /**
   * Handle mobile PAYG top-up payment
   */
  private static async handleMobilePaygTopUp(
    data: MobilePaymentEventData,
    accountId: string
  ): Promise<WebhookProcessResult> {
    try {
      await PaygService.creditFromMobilePayment({
        accountId,
        amountRwf: data.amount,
        paymentRef: data.ref,
      });

      logger.info(
        { accountId, ref: data.ref, amount: data.amount, currency: data.currency },
        'PAYG balance credited from mobile money payment'
      );

      return { success: true };
    } catch (error) {
      logger.error({ error, accountId, ref: data.ref }, 'Failed to credit PAYG balance from mobile payment');
      return { success: false, error: 'Failed to credit balance' };
    }
  }

  /**
   * Handle mobile subscription payment
   * Activates subscription plan after successful mobile money payment
   */
  private static async handleMobileSubscriptionPayment(
    data: MobilePaymentEventData,
    accountId: string
  ): Promise<WebhookProcessResult> {
    const planId = data.metadata?.['planId'] as string | undefined;
    const billingCycle = (data.metadata?.['billingCycle'] as string | undefined) ?? 'monthly';

    if (!planId) {
      logger.warn({ ref: data.ref, accountId }, 'Mobile subscription payment missing planId');
      return { success: false, error: 'Missing planId in metadata' };
    }

    try {
      await SubscriptionRepository.activateFromPayment(accountId, planId, billingCycle as 'monthly' | 'yearly');

      logger.info(
        { accountId, planId, billingCycle, ref: data.ref, amount: data.amount },
        'Subscription activated from mobile money payment'
      );

      // Send subscription activation notification (fire-and-forget)
      SubscriptionNotificationService.sendBillingConfirmation(accountId).catch((err) =>
        logger.error({ err, accountId }, 'Failed to send subscription activation notification')
      );

      return { success: true };
    } catch (error) {
      logger.error({ error, accountId, planId, ref: data.ref }, 'Failed to activate subscription from mobile payment');
      return { success: false, error: 'Failed to activate subscription' };
    }
  }

  /**
   * Handle mobile template purchase payment
   * Installs template after successful mobile money payment
   */
  private static async handleMobileTemplatePurchase(
    data: MobilePaymentEventData,
    accountId: string
  ): Promise<WebhookProcessResult> {
    const templateId = data.metadata?.['templateId'] as string | undefined;
    const appId = data.metadata?.['appId'] as string | undefined;

    if (!templateId || !appId) {
      logger.warn({ ref: data.ref, accountId }, 'Mobile template purchase missing templateId or appId');
      return { success: false, error: 'Missing templateId or appId in metadata' };
    }

    try {
      const { marketplaceService } = await import('./marketplace.service');
      await marketplaceService.installTemplate(templateId, appId, accountId, {});

      logger.info({ accountId, templateId, appId, ref: data.ref }, 'Template installed from mobile money payment');

      return { success: true };
    } catch (error) {
      logger.error(
        { error, accountId, templateId, appId, ref: data.ref },
        'Failed to install template from mobile money payment'
      );
      return { success: false, error: 'Failed to install template' };
    }
  }

  /**
   * Handle mobile.payment_failed event
   * Mobile money payment failed - log and notify if needed
   */
  private static async handleMobilePaymentFailed(data: MobilePaymentEventData): Promise<WebhookProcessResult> {
    await this.settlePendingTransaction(data.orderId, 'FAILED');

    const accountId = data.metadata?.['accountId'] as string | undefined;

    logger.warn(
      { accountId, ref: data.ref, orderId: data.orderId, phoneNumber: data.phoneNumber },
      'Mobile money payment failed'
    );

    // Could send a notification to the user here if needed
    // For now, just acknowledge the event

    return { success: true };
  }
}
