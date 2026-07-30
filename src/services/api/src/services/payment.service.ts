import { logger } from '../config/logger';
import { PaygRepository } from '../repositories/payg.repository';
import { SubscriptionRepository } from '../repositories/subscription.repository';
import { getPaymentClient, isPaymentClientInitialized } from '../utils/payment-client';
import { convertUsdToRwf } from '../utils/exchange-rate';
import { mapTransaction } from './payg.service';
import type { CreditTransactionType, InitializePaymentRequest, InitializePaymentResult } from '../types/payg.types';

const MIN_TOPUP_USD = 0.5;

/**
 * Single entry point that initializes a payment for either a PAYG top-up or a
 * subscription, via card or mobile money. A PENDING credit transaction is
 * recorded up front; the payment webhook settles it to COMPLETED/FAILED.
 */
export class PaymentService {
  static async initializePayment(accountId: string, req: InitializePaymentRequest): Promise<InitializePaymentResult> {
    if (!isPaymentClientInitialized()) {
      throw new Error('Payment service not configured');
    }

    if (req.method === 'card' && !req.email) {
      throw new Error('email is required for card payments');
    }
    if (req.method === 'mobile' && !req.phoneNumber) {
      throw new Error('phoneNumber is required for mobile payments');
    }

    const isSubscription = req.type === 'subscription';
    const txType: CreditTransactionType = isSubscription ? 'subscription' : 'topup';

    const { amountUSD, description, metadata } = await this.resolveOrder(req);

    const balance = await PaygRepository.getOrCreateBalance(accountId);
    const orderId = `${req.type}_${accountId}_${Date.now()}`;

    const pending = await PaygRepository.createPendingTransaction({
      accountId,
      creditBalanceId: balance.id,
      type: txType,
      amount: amountUSD,
      currentBalance: balance.balance,
      description,
      paymentRef: orderId,
    });

    // The payment gateway charges in RWF for Rwanda.
    const amountRWF = await convertUsdToRwf(amountUSD);
    // Both keys are set: the card webhook reads `paymentType`, the mobile webhook reads `type`.
    const gatewayMetadata = {
      ...metadata,
      accountId,
      transactionId: pending.id,
      paymentType: req.type,
      type: req.type,
    };

    const base = {
      transaction: mapTransaction(pending),
      orderId,
      amountUSD,
      amountRWF,
      method: req.method,
    };

    if (req.method === 'card') {
      const card = await getPaymentClient().initiateCardPayment({
        orderId,
        amount: Math.round(amountRWF * 100),
        email: req.email as string,
        currency: 'RWF',
        customerName: req.customerName,
        description,
        metadata: gatewayMetadata,
      });

      logger.info({ accountId, orderId, type: req.type, method: 'card', pcode: card.pcode }, 'Payment initialized');

      return {
        ...base,
        checkoutUrl: card.checkoutUrl,
        pcode: card.pcode,
        message: 'Complete the payment at the provided checkout URL.',
      };
    }

    const mobile = await getPaymentClient().mobileCashin({
      orderId,
      amount: Math.round(amountRWF),
      phoneNumber: req.phoneNumber as string,
      currency: 'RWF',
      customerName: req.customerName,
      description,
      metadata: gatewayMetadata,
    });

    logger.info({ accountId, orderId, type: req.type, method: 'mobile', ref: mobile.ref }, 'Payment initialized');

    return {
      ...base,
      paymentRef: mobile.ref,
      message: 'Approve the payment on your phone to complete the transaction.',
    };
  }

  private static async resolveOrder(
    req: InitializePaymentRequest
  ): Promise<{ amountUSD: number; description: string; metadata: Record<string, string> }> {
    if (req.type === 'subscription') {
      if (!req.planId) {
        throw new Error('planId is required for subscription payments');
      }
      const plan = await SubscriptionRepository.getPlanById(req.planId);
      if (!plan) {
        throw new Error('Plan not found');
      }
      const billingCycle = req.billingCycle ?? 'monthly';
      // price_yearly is the per-month rate when billed annually, so a year = ×12.
      const amountUSD = billingCycle === 'yearly' ? plan.price_yearly * 12 : plan.price_monthly;
      if (amountUSD <= 0) {
        throw new Error('This plan does not require payment');
      }
      return {
        amountUSD,
        description: `${plan.name} plan subscription (${billingCycle})`,
        metadata: { planId: req.planId, billingCycle, planName: plan.name },
      };
    }

    if (!req.amount || req.amount < MIN_TOPUP_USD) {
      throw new Error(`Minimum top-up amount is $${MIN_TOPUP_USD}`);
    }
    return {
      amountUSD: req.amount,
      description: `PAYG credit top-up — $${req.amount.toFixed(2)}`,
      metadata: { topUpAmountUSD: req.amount.toString() },
    };
  }
}
