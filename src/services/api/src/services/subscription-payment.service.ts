import { SubscriptionRepository } from '../repositories/subscription.repository';
import { getPaymentClient } from '../utils/payment-client';
import { logger } from '../config/logger';

export interface SubscriptionPaymentInitResult {
  clientSecret: string;
  paymentIntentId: string;
  orderId: string;
  amountCents: number;
  planName: string;
}

export class SubscriptionPaymentService {
  /**
   * Create a Stripe Payment Intent for a plan upgrade.
   *
   * Pricing:
   *  - monthly  → price_monthly (USD) × 100 cents
   *  - yearly   → price_yearly (monthly-equivalent) × 12 × 100 cents
   *
   * After Stripe confirms on the client, afrisinc-pay fires the merchant
   * webhook → internal /payment-event → internal.routes.ts activates the plan.
   */
  static async initPayment(
    accountId: string,
    planId: string,
    billingCycle: 'monthly' | 'yearly',
    customerEmail: string
  ): Promise<SubscriptionPaymentInitResult> {
    const plan = await SubscriptionRepository.getPlanById(planId);
    if (!plan) {
      throw Object.assign(new Error('Plan not found'), { statusCode: 404 });
    }

    // price_yearly = per-month rate when billed annually
    const priceMonthly = Number(plan.price_monthly);
    const priceYearly = Number(plan.price_yearly);

    const amountUSD = billingCycle === 'yearly' ? priceYearly * 12 : priceMonthly;

    const amountCents = Math.round(amountUSD * 100);

    if (amountCents <= 0) {
      throw Object.assign(new Error('Free plans do not require payment'), { statusCode: 422 });
    }

    const orderId = `sub_${accountId}_${planId}_${billingCycle}_${Date.now()}`;

    const intent = await getPaymentClient().createPaymentIntent({
      amount: amountCents,
      currency: 'USD',
      orderId,
      customerEmail,
      metadata: {
        accountId,
        paymentType: 'subscription',
        planId,
        billingCycle,
      },
    });

    logger.info({ accountId, planId, billingCycle, amountCents, orderId }, 'Subscription payment intent created');

    return {
      clientSecret: intent.clientSecret,
      paymentIntentId: intent.id,
      orderId,
      amountCents,
      planName: plan.name,
    };
  }
}
