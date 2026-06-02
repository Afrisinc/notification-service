/**
 * TrialSubscriptionService
 *
 * Orchestrates the two-step SetupIntent trial flow:
 *
 *   Step 1 — createSetupIntent(accountId, email, name)
 *     • Calls afrisinc-pay POST /subscriptions/setup-intent
 *     • afrisinc-pay creates/retrieves a Stripe Customer (cus_xxx)
 *     • Returns { customerId, clientSecret } to the frontend
 *     • Stores stripeCustomerId on the Account record
 *
 *   Step 2 — activateSubscription(accountId, planId, billingCycle, paymentMethodId, customerId)
 *     • Called after frontend confirmCardSetup() succeeds
 *     • Calls afrisinc-pay POST /subscriptions/create
 *     • Stripe creates the Subscription in 'trialing' status
 *     • Stores sub_xxx (provider_id) + pm_xxx on the Subscription record
 *     • Stripe owns auto-charge, dunning, and lifecycle from this point
 */
import { prismaWrite, prismaRead } from '@shared/database';
import { getPaymentClient } from '../utils/payment-client';
import { logger } from '../config/logger';

const TRIAL_DAYS = 14;

export class TrialSubscriptionService {
  /**
   * Step 1: Ensure a Stripe Customer exists for this account and return a
   * SetupIntent client_secret for the frontend to confirm the card.
   *
   * Idempotent — if the account already has a stripeCustomerId we reuse it.
   */
  static async createSetupIntent(
    accountId: string,
    email: string,
    name?: string
  ): Promise<{ customerId: string; clientSecret: string; setupIntentId: string }> {
    // Check if account already has a Stripe customer
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const account = (await (prismaRead.account as any).findUnique({
      where: { id: accountId },
      select: { stripe_customer_id: true },
    })) as { stripe_customer_id: string | null } | null;

    // If customer already exists, create a fresh SetupIntent for them
    if (account?.stripe_customer_id) {
      const result = await getPaymentClient().createSetupIntent(email, name);
      // The payment client may return a different customerId if email lookup found
      // an existing one — store whichever comes back
      if (result.customerId !== account.stripe_customer_id) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (prismaWrite.account as any).update({
          where: { id: accountId },
          data: { stripe_customer_id: result.customerId },
        });
      }
      logger.info({ accountId, customerId: result.customerId }, 'SetupIntent created for existing customer');
      return result;
    }

    // No customer yet — create one via afrisinc-pay
    const result = await getPaymentClient().createSetupIntent(email, name);

    // Persist the Stripe Customer ID on the account
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prismaWrite.account as any).update({
      where: { id: accountId },
      data: { stripe_customer_id: result.customerId },
    });

    logger.info({ accountId, customerId: result.customerId }, 'Stripe customer created and stored');
    return result;
  }

  /**
   * Step 2: Create the Stripe Subscription with trial after card confirmation.
   *
   * Called after stripe.confirmCardSetup() succeeds on the frontend.
   * The paymentMethodId (pm_xxx) is the card that Stripe will auto-charge.
   */
  static async activateSubscription(
    accountId: string,
    planId: string,
    billingCycle: 'monthly' | 'annual',
    paymentMethodId: string,
    customerId: string
  ): Promise<void> {
    // Load plan for pricing
    const plan = await prismaRead.plan.findUnique({
      where: { id: planId },
      select: { id: true, name: true, price_monthly: true, price_yearly: true },
    });

    if (!plan) {
      throw Object.assign(new Error(`Plan not found: ${planId}`), { statusCode: 404 });
    }

    const priceMonthly = Number(plan.price_monthly);
    const priceYearly = Number(plan.price_yearly);

    // For 'annual' billing: charge yearly price × 12 as a single yearly amount
    // For 'monthly': charge monthly price
    const amountUSD = billingCycle === 'annual' ? priceYearly * 12 : priceMonthly;
    const amountCents = Math.round(amountUSD * 100);

    if (amountCents <= 0) {
      throw Object.assign(new Error('Free plans do not require a payment method'), { statusCode: 422 });
    }

    const stripeResult = await getPaymentClient().createStripeSubscription({
      customerId,
      paymentMethodId,
      amountCents,
      currency: 'usd',
      trialDays: TRIAL_DAYS,
      metadata: {
        accountId,
        planId,
        planName: plan.name,
        billingCycle,
      },
    });

    // Convert Unix timestamps to Date objects
    const periodStart = new Date(stripeResult.currentPeriodStart * 1000);
    const periodEnd = new Date(stripeResult.currentPeriodEnd * 1000);
    const trialEndsAt = stripeResult.trialEnd ? new Date(stripeResult.trialEnd * 1000) : null;

    // Upsert the subscription record with Stripe-owned data
    await prismaWrite.subscription.upsert({
      where: { account_id: accountId },
      create: {
        account_id: accountId,
        plan_id: planId,
        status: stripeResult.status, // 'trialing'
        billing_cycle: billingCycle,
        current_period_start: periodStart,
        current_period_end: periodEnd,
        provider: 'stripe',
        provider_id: stripeResult.subscriptionId, // sub_xxx
        payment_method_id: paymentMethodId, // pm_xxx
        trial_ends_at: trialEndsAt,
        trial_reminder_sent: false,
      },
      update: {
        plan_id: planId,
        status: stripeResult.status,
        billing_cycle: billingCycle,
        current_period_start: periodStart,
        current_period_end: periodEnd,
        provider: 'stripe',
        provider_id: stripeResult.subscriptionId,
        payment_method_id: paymentMethodId,
        trial_ends_at: trialEndsAt,
        trial_reminder_sent: false,
        canceled_at: null,
      },
    });

    logger.info(
      {
        accountId,
        planId,
        billingCycle,
        subscriptionId: stripeResult.subscriptionId,
        status: stripeResult.status,
        trialEndsAt,
      },
      'Trial subscription activated — Stripe owns auto-charge lifecycle'
    );
  }

  /**
   * Public (pre-account) SetupIntent creation used during the signup flow.
   *
   * At signup time there is no accountId yet — the account is created at
   * the end of the flow. This method creates a Stripe Customer + SetupIntent
   * without needing an accountId. The backend will link the customerId to the
   * newly-created account during AuthService.register().
   */
  static async createAnonymousSetupIntent(
    email: string,
    name?: string
  ): Promise<{ customerId: string; clientSecret: string; setupIntentId: string }> {
    const result = await getPaymentClient().createSetupIntent(email, name);
    logger.info({ customerId: result.customerId }, 'Anonymous SetupIntent created for signup flow');
    return result;
  }
}
