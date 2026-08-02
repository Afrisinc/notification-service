import { SubscriptionRepository } from '../repositories/subscription.repository';
import { getPaymentClient } from '../utils/payment-client';
import { logger } from '../config/logger';
import { convertUsdToRwf } from '../utils/exchange-rate';

export interface SubscriptionPaymentInitResult {
  checkoutUrl: string;
  pcode: string;
  orderId: string;
  amountUSD: number;
  planName: string;
  validUntil: string;
}

export class SubscriptionPaymentService {
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

    const { amountRWF: amountRwf } = await convertUsdToRwf(amountUSD);
    const amountCents = Math.round(amountRwf * 100);

    const cardPayment = await getPaymentClient().initiateCardPayment({
      orderId,
      amount: amountCents,
      email: customerEmail,
      currency: 'RWF',
      description: `Subscription upgrade to ${plan.name} (${billingCycle}): USD ${amountUSD} (~RWF ${Math.round(amountRwf)})`,
      metadata: {
        accountId,
        paymentType: 'subscription',
        planId,
        billingCycle,
        amountUSD: amountUSD.toString(),
        amountRWF: amountRwf.toString(),
      },
    });

    logger.info(
      { accountId, planId, billingCycle, amountUSD, amountRWF: amountRwf, orderId, pcode: cardPayment.pcode },
      'Subscription card payment initiated (Afrisinc-pay) — converted USD to RWF'
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
