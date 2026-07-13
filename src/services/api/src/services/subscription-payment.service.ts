import { SubscriptionRepository } from '../repositories/subscription.repository';
import { getPaymentClient } from '../utils/payment-client';
import { logger } from '../config/logger';

export interface SubscriptionPaymentInitResult {
  checkoutUrl: string;
  pcode: string;
  orderId: string;
  amountUSD: number;
  planName: string;
  validUntil: string;
}

export class SubscriptionPaymentService {
  /**
   * Initiate card payment for subscription upgrade via ITEC PesaPal (africinc-pay).
   *
   * Pricing:
   *  - monthly  → price_monthly (USD)
   *  - yearly   → price_yearly (monthly-equivalent) × 12 (USD)
   *
   * Returns checkout URL for customer to complete payment.
   * After payment is confirmed, afrisinc-pay fires webhook → activates plan.
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

    if (amountUSD <= 0) {
      throw Object.assign(new Error('Free plans do not require payment'), { statusCode: 422 });
    }

    const orderId = `sub_${accountId}_${planId}_${billingCycle}_${Date.now()}`;

    const cardPayment = await getPaymentClient().initiateCardPayment({
      orderId,
      amount: Math.round(amountUSD * 100), // Convert to cents for africnc-pay
      email: customerEmail,
      description: `Subscription upgrade to ${plan.name} (${billingCycle})`,
      metadata: {
        accountId,
        paymentType: 'subscription',
        planId,
        billingCycle,
      },
    });

    logger.info(
      { accountId, planId, billingCycle, amountUSD, orderId, pcode: cardPayment.pcode },
      'Subscription card payment initiated (ITEC PesaPal)'
    );

    return {
      checkoutUrl: cardPayment.checkoutUrl,
      pcode: cardPayment.pcode,
      orderId,
      amountUSD,
      planName: plan.name,
      validUntil: cardPayment.validUntil,
    };
  }
}
