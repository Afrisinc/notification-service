import { logger } from '../config/logger';
import { PaygRepository } from '../repositories/payg.repository';
import { SubscriptionRepository } from '../repositories/subscription.repository';
import { prismaRead } from '@shared/database';
import { getPaymentClient, isPaymentClientInitialized } from '../utils/payment-client';
import { convertUsdToRwf } from '../utils/exchange-rate';
import { mapTransaction } from '../utils/transaction-mapper.util';
import { PaymentTrackingService } from './payment-tracking.service';
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

    // Generate shorter orderId: type_shortAccountId_timestamp
    const shortAccountId = accountId.substring(0, 12);
    const orderId = `${req.type}_${shortAccountId}_${Date.now()}`;

    const pending = await PaygRepository.createPendingTransaction({
      accountId,
      creditBalanceId: balance.id,
      type: txType,
      amount: amountUSD,
      currentBalance: balance.balance,
      description,
      paymentRef: orderId,
    });

    const currency = req.currency ?? 'USD';
    let amountRWF: number;
    let exchangeRate: number | undefined;
    let baseCode: string | undefined;
    let targetCode: string | undefined;
    let amountLocal: number | undefined;

    if (currency === 'RWF') {
      amountRWF = amountUSD;
    } else {
      const { amountRWF: converted, rateData } = await convertUsdToRwf(amountUSD);
      amountRWF = converted;
      exchangeRate = rateData.rate;
      baseCode = rateData.baseCode;
      targetCode = rateData.targetCode;
      amountLocal = Math.round(amountUSD * exchangeRate * 100);
    }

    await PaymentTrackingService.recordPaymentInitialization({
      accountId,
      ref: orderId,
      orderId,
      amount: Math.round(amountUSD * 100),
      currency: 'USD' as any,
      type: req.type as any,
      email: req.email,
      phoneNumber: req.phoneNumber,
      customerName: req.customerName,
      method: req.method,
      exchangeRate,
      baseCode,
      targetCode,
      amountLocal,
    });

    const gatewayMetadata = {
      ...metadata,
      accountId,
      transactionId: pending.id,
      paymentType: req.type,
      type: req.type,
      currency,
      amountUSD,
    };

    const base = {
      transaction: mapTransaction(pending),
      orderId,
      amountUSD,
      amountRWF,
      method: req.method,
    };

    if (req.method === 'card') {
      const cardPayload = {
        orderId,
        amount: Math.round(amountRWF * 100),
        email: req.email as string,
        currency: 'RWF',
        customerName: req.customerName,
        description,
        metadata: gatewayMetadata,
      };

      logger.info({ cardPayload }, '[PaymentService] Card payment payload');

      const card = await getPaymentClient().initiateCardPayment(cardPayload);

      logger.info({ accountId, orderId, type: req.type, method: 'card', pcode: card.pcode }, 'Payment initialized');

      return {
        ...base,
        checkoutUrl: card.checkoutUrl,
        pcode: card.pcode,
        message: 'Complete the payment at the provided checkout URL.',
      };
    }

    const mobilePayload = {
      orderId,
      amount: Math.round(amountRWF),
      phoneNumber: req.phoneNumber as string,
      customerName: req.customerName,
      description,
      metadata: gatewayMetadata,
      provider: 'itec', // ← Required by payment gateway
    };

    logger.info({ mobilePayload }, '[PaymentService] Mobile payment payload');

    const mobile = await getPaymentClient().mobileCashin(mobilePayload);

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
      description: `Template purchase: ${template.code} (USD ${amountUSD.toFixed(2)})`,
      metadata: { templateId: req.templateId, appId: req.appId, templateCode: template.code },
    };
  }

  private static async resolveTopupOrder(req: InitializePaymentRequest): Promise<OrderDetails> {
    if (!req.amount || req.amount < MIN_TOPUP_USD) {
      throw new Error(`Minimum top-up amount is $${MIN_TOPUP_USD}`);
    }
    return {
      amountUSD: req.amount,
      description: `PAYG credit top-up - USD ${req.amount.toFixed(2)}`,
      metadata: { topUpAmountUSD: req.amount.toString() },
    };
  }
}
