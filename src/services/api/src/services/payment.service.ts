import { logger } from '../config/logger';
import { PaygRepository } from '../repositories/payg.repository';
import { SubscriptionRepository } from '../repositories/subscription.repository';
import { prismaRead } from '@shared/database';
import { getPaymentClient, isPaymentClientInitialized } from '../utils/payment-client';
import { convertUsdToRwf } from '../utils/exchange-rate';
import { mapTransaction } from './payg.service';
import type { CreditTransactionType, InitializePaymentRequest, InitializePaymentResult } from '../types/payg.types';

const MIN_TOPUP_USD = 0.5;

interface OrderDetails {
  amountUSD: number;
  description: string;
  metadata: Record<string, string>;
}

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

    const txType: CreditTransactionType = req.type === 'subscription' ? 'subscription' : 'topup';

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

  private static async resolveOrder(req: InitializePaymentRequest): Promise<OrderDetails> {
    switch (req.type) {
      case 'subscription':
        return this.resolveSubscriptionOrder(req);
      case 'template_purchase':
        return this.resolveTemplatePurchaseOrder(req);
      case 'payg_topup':
        return this.resolveTopupOrder(req);
      default:
        throw new Error(`Unknown payment type: ${req.type}`);
    }
  }

  private static async resolveSubscriptionOrder(req: InitializePaymentRequest): Promise<OrderDetails> {
    if (!req.planId) {
      throw new Error('planId is required for subscription payments');
    }
    const plan = await SubscriptionRepository.getPlanById(req.planId);
    if (!plan) {
      throw new Error('Plan not found');
    }
    const billingCycle = req.billingCycle ?? 'monthly';
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

  private static async resolveTemplatePurchaseOrder(req: InitializePaymentRequest): Promise<OrderDetails> {
    if (!req.templateId) {
      throw new Error('templateId is required for template_purchase payments');
    }
    if (!req.appId) {
      throw new Error('appId is required for template_purchase payments');
    }
    const template = await prismaRead.template.findFirst({
      where: {
        id: req.templateId,
        visibility: 'marketplace',
        is_public: true,
      },
      select: { id: true, code: true, price: true },
    });
    if (!template) {
      throw new Error('Template not found or not available for purchase');
    }
    const amountUSD = Number(template.price ?? 0);
    if (amountUSD <= 0) {
      throw new Error('This is a free template — no payment required');
    }
    return {
      amountUSD,
      description: `Template purchase: ${template.code} ($${amountUSD.toFixed(2)} USD)`,
      metadata: { templateId: req.templateId, appId: req.appId, templateCode: template.code },
    };
  }

  private static async resolveTopupOrder(req: InitializePaymentRequest): Promise<OrderDetails> {
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
