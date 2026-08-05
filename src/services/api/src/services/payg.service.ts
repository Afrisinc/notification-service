import { logger } from '../config/logger';
import { getConfig } from '@shared/config';
import { prismaRead, prismaWrite } from '@shared/database';
import { PaygRepository } from '../repositories/payg.repository';
import { PaymentRepository } from '../repositories/payment.repository';
import { SubscriptionRepository } from '../repositories/subscription.repository';
import { getPaymentClient, isPaymentClientInitialized, MobilePaymentResult } from '../utils/payment-client';
import { convertUsdToRwf } from '../utils/exchange-rate';
import { TOPUP_TIERS, getBonusPercent, calculateBonusAmount } from '../utils/bonus.util';
import { mapTransaction, mapTransactions, type RawCreditTransaction } from '../utils/transaction-mapper.util';
import type {
  PaygRates,
  TopUpRequest,
  TopUpResult,
  DeductCreditsRequest,
  DeductCreditsResult,
  CreditBalanceDto,
  PaygChannel,
} from '../types/payg.types';

// ─── Rates & tiers (source of truth = Pricing page) ─────────────────────────

export const PAYG_RATES: PaygRates = {
  EMAIL: 0.0008, // $0.80 per 1,000 emails
  SMS: 0.035, // $0.035 per message
  PUSH: 0.00005, // $0.50 per 10,000 push
  IN_APP: 0.00004, // $0.40 per 10,000 in-app
  WHATSAPP: 0.035, // $0.035 per message
};

const MIN_TOPUP_AMOUNT = 0.5; // USD

// ─── Mock payment processor (replace with Stripe/Paystack later) ─────────────

interface MockPaymentResult {
  success: boolean;
  ref: string;
  message: string;
}

function mockProcessPayment(amount: number): MockPaymentResult {
  // Always succeeds in mock mode.
  // Real integration: call Stripe/Paystack/Flutterwave here and return ref.
  const ref = `MOCK-${Date.now()}-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
  logger.info({ amount, ref }, '[MOCK] Payment processor — payment accepted');
  return { success: true, ref, message: 'Payment accepted (mock)' };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function mapBalance(b: {
  id: string;
  account_id: string;
  balance: number;
  currency: string;
  updated_at: Date;
}): CreditBalanceDto {
  return {
    id: b.id,
    accountId: b.account_id,
    balance: b.balance,
    currency: b.currency,
    updatedAt: b.updated_at,
  };
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class PaygService {
  /**
   * Get current credit balance (creates one if first-time PAYG user)
   */
  static async getBalance(accountId: string): Promise<CreditBalanceDto> {
    const balance = await PaygRepository.getOrCreateBalance(accountId);
    return mapBalance(balance as Parameters<typeof mapBalance>[0]);
  }

  /**
   * Initialise a card payment for a PAYG top-up via ITEC PesaPal.
   * Converts USD amount to RWF before sending to payment provider.
   * Balance is NOT credited here — that happens in creditFromPayment()
   * after afrisinc-pay fires the internal payment-event webhook.
   */
  static async initTopUp(
    accountId: string,
    amount: number,
    customerEmail: string
  ): Promise<{ checkoutUrl: string; pcode: string; orderId: string; amountUSD: number }> {
    if (amount < MIN_TOPUP_AMOUNT) {
      throw new Error(`Minimum top-up amount is $${MIN_TOPUP_AMOUNT}`);
    }

    if (!isPaymentClientInitialized()) {
      throw new Error('Payment service not configured');
    }

    const orderId = `topup_${accountId}_${Date.now()}`;

    const { amountRWF: amountRwf } = await convertUsdToRwf(amount);
    const amountCents = Math.round(amountRwf * 100);

    const cardPayment = await getPaymentClient().initiateCardPayment({
      orderId,
      amount: amountCents,
      email: customerEmail,
      currency: 'RWF', // PesaPal charges in RWF for Rwanda
      description: `Top-up: USD ${amount} (~RWF ${Math.round(amountRwf)})`,
      metadata: {
        accountId,
        paymentType: 'payg_topup',
        topUpAmountUSD: amount.toString(),
        topUpAmountRWF: amountRwf.toString(),
      },
    });

    logger.info(
      { accountId, amountUSD: amount, amountRWF: amountRwf, orderId, pcode: cardPayment.pcode },
      'PAYG top-up card payment initiated (ITEC PesaPal) — converted USD to RWF'
    );

    return {
      checkoutUrl: cardPayment.checkoutUrl,
      pcode: cardPayment.pcode,
      orderId,
      amountUSD: amount,
    };
  }

  /**
   * Credit PAYG balance after afrisinc-pay confirms payment via webhook.
   * Fetches the original USD amount from payment table (not from webhook response).
   * Called by the internal /api/internal/payment-event endpoint.
   */
  static async creditFromPayment(params: {
    accountId: string;
    amountCents: number;
    paymentRef: string;
  }): Promise<TopUpResult> {
    // Fetch payment record to get the correct USD amount stored at initialization
    const payment = await PaymentRepository.findByRef(params.paymentRef);

    if (!payment) {
      throw new Error(`Payment record not found for ref: ${params.paymentRef}`);
    }

    // Use the original USD amount from payment table, not the webhook response
    const amount = payment.amount / 100; // Convert from cents to USD
    const balance = await PaygRepository.getOrCreateBalanceForUpdate(params.accountId);
    const bonusPercent = getBonusPercent(amount);
    const bonusAmount = calculateBonusAmount(amount, bonusPercent);

    const result = await PaygRepository.atomicTopUp(
      params.accountId,
      balance.id,
      balance.balance,
      amount,
      bonusAmount,
      params.paymentRef,
      bonusPercent
    );

    logger.info(
      {
        accountId: params.accountId,
        amount,
        bonus: bonusAmount,
        newBalance: result.newBalance,
        paymentRef: params.paymentRef,
      },
      'PAYG balance credited from payment webhook — using payment table amount'
    );

    return {
      transaction: mapTransaction({ ...result.topUpTx, status: 'COMPLETED' } as Parameters<typeof mapTransaction>[0]),
      bonusTransaction: result.bonusTx
        ? mapTransaction({ ...result.bonusTx, status: 'COMPLETED' } as Parameters<typeof mapTransaction>[0])
        : null,
      newBalance: result.newBalance,
      bonusPercent,
      bonusAmount,
    };
  }

  /**
   * Top up credits (legacy mock path — used for testing only).
   * @deprecated Use initTopUp() + creditFromPayment() for real payments.
   */
  static async topUp(accountId: string, req: TopUpRequest): Promise<TopUpResult> {
    if (req.amount < MIN_TOPUP_AMOUNT) {
      throw new Error(`Minimum top-up amount is $${MIN_TOPUP_AMOUNT}`);
    }

    // Mock payment
    const payment = mockProcessPayment(req.amount);
    if (!payment.success) {
      throw new Error(`Payment failed: ${payment.message}`);
    }

    const balance = await PaygRepository.getOrCreateBalanceForUpdate(accountId);
    const bonusPercent = getBonusPercent(req.amount);
    const bonusAmount = Number.parseFloat(((req.amount * bonusPercent) / 100).toFixed(6));

    const result = await PaygRepository.atomicTopUp(
      accountId,
      balance.id,
      balance.balance,
      req.amount,
      bonusAmount,
      req.paymentRef ?? payment.ref,
      bonusPercent
    );

    logger.info(
      { accountId, amount: req.amount, bonus: bonusAmount, newBalance: result.newBalance },
      'PAYG top-up completed'
    );

    return {
      transaction: mapTransaction({ ...result.topUpTx, status: 'COMPLETED' } as Parameters<typeof mapTransaction>[0]),
      bonusTransaction: result.bonusTx
        ? mapTransaction({ ...result.bonusTx, status: 'COMPLETED' } as Parameters<typeof mapTransaction>[0])
        : null,
      newBalance: result.newBalance,
      bonusPercent,
      bonusAmount,
    };
  }

  /**
   * Deduct credits for a sent message.
   * Called by the notification send pipeline for PAYG accounts.
   * Returns insufficientFunds=true (non-throwing) if balance is too low.
   */
  static async deductCredits(req: DeductCreditsRequest): Promise<DeductCreditsResult> {
    try {
      const balance = await PaygRepository.getOrCreateBalance(req.accountId);
      const rate = PAYG_RATES[req.channel];

      if (rate === undefined) {
        throw new Error(`Unknown PAYG channel: ${req.channel}`);
      }

      const cost = parseFloat((rate * req.quantity).toFixed(6));

      if (balance.balance < cost) {
        logger.warn(
          { accountId: req.accountId, channel: req.channel, cost, balance: balance.balance },
          'PAYG insufficient funds'
        );
        return { success: false, amountDeducted: 0, newBalance: balance.balance, insufficientFunds: true };
      }

      const description = `${req.channel} send — ${req.quantity} message${req.quantity !== 1 ? 's' : ''} @ $${rate}/msg`;

      const result = await PaygRepository.atomicDeduct(
        req.accountId,
        balance.id,
        balance.balance,
        cost,
        req.channel,
        description,
        req.notificationId
      );

      logger.debug(
        { accountId: req.accountId, channel: req.channel, cost, newBalance: result.newBalance },
        'PAYG credit deducted'
      );

      return { success: true, amountDeducted: cost, newBalance: result.newBalance, insufficientFunds: false };
    } catch (error) {
      logger.error({ error, accountId: req.accountId }, 'Failed to deduct PAYG credits');
      throw error;
    }
  }

  /**
   * Get transaction history with pagination
   */
  static async getTransactions(accountId: string, opts: { page: number; limit: number; type?: string }) {
    const result = await PaygRepository.getTransactions(accountId, opts);
    return {
      items: result.items.map((t: any) =>
        mapTransaction({ ...t, status: 'COMPLETED' } as Parameters<typeof mapTransaction>[0])
      ),
      total: result.total,
      page: result.page,
      limit: result.limit,
      pages: Math.ceil(result.total / result.limit),
    };
  }

  /**
   * Return the current PAYG rates and available top-up tiers
   */
  static getRates() {
    return {
      rates: {
        EMAIL: { ratePerMessage: PAYG_RATES.EMAIL, ratePer1000: PAYG_RATES.EMAIL * 1000, unit: 'per email' },
        SMS: { ratePerMessage: PAYG_RATES.SMS, ratePer1000: PAYG_RATES.SMS * 1000, unit: 'per message' },
        PUSH: { ratePerMessage: PAYG_RATES.PUSH, ratePer10000: PAYG_RATES.PUSH * 10000, unit: 'per 10,000 pushes' },
        IN_APP: {
          ratePerMessage: PAYG_RATES.IN_APP,
          ratePer10000: PAYG_RATES.IN_APP * 10000,
          unit: 'per 10,000 in-app',
        },
      },
      topUpTiers: TOPUP_TIERS.filter((t) => t.minAmount > 0),
      minimumTopUp: MIN_TOPUP_AMOUNT,
      currency: 'USD',
      creditsExpire: false,
      note: 'WhatsApp ($0.085/conversation) coming soon',
    };
  }

  /**
   * Check if account has sufficient balance for a planned send
   */
  static async checkSufficientBalance(
    accountId: string,
    channel: PaygChannel,
    quantity: number
  ): Promise<{ sufficient: boolean; required: number; available: number }> {
    const balance = await PaygRepository.getOrCreateBalance(accountId);
    const rate = PAYG_RATES[channel];
    const required = Number.parseFloat((rate * quantity).toFixed(6));

    return {
      sufficient: balance.balance >= required,
      required,
      available: balance.balance,
    };
  }

  /**
   * Fire-and-forget: send a low-balance email alert if the account's PAYG
   * credit balance has dropped below the configured threshold.
   *
   * Throttled to once per 24 h via LimitNotificationLog (same table used by
   * subscription limit alerts) so the user isn't spammed on every send.
   *
   * Call this after every successful deduction — it is designed to be
   * called with .catch(() => {}) and never throws to the caller.
   */
  static async checkAndAlertLowBalance(accountId: string): Promise<void> {
    try {
      const config = getConfig();
      const threshold = config.PAYG_LOW_BALANCE_THRESHOLD_USD ?? 5;
      const templateId = config.PAYG_LOW_BALANCE_TEMPLATE_ID ?? null;
      const systemAccountId = config.SYSTEM_ACCOUNT_ID ?? null;
      const systemAppId = config.SYSTEM_APP_ID ?? null;

      if (!templateId || !systemAccountId || !systemAppId) {
        logger.debug({ accountId }, 'PAYG low-balance alert skipped — template/system account not configured');
        return;
      }

      const balance = await PaygRepository.getBalance(accountId);
      if (!balance || balance.balance > threshold) return;

      // ── DB-backed throttle (24 h) ──────────────────────────────────────────
      const THROTTLE_MS = 24 * 60 * 60 * 1000;
      const since = new Date(Date.now() - THROTTLE_MS);
      const recent = await (prismaRead as any).limitNotificationLog.findFirst({
        where: {
          account_id: accountId,
          limit_type: 'payg_balance',
          status: 'low',
          sent_at: { gte: since },
        },
      });
      if (recent) {
        logger.debug({ accountId }, 'PAYG low-balance alert throttled');
        return;
      }

      // ── Resolve account owner ──────────────────────────────────────────────
      const account = await prismaRead.account.findUnique({
        where: { id: accountId },
        include: { owner: true },
      });
      if (!account?.owner?.email) return;

      const ownerName = `${account.owner.firstName ?? ''} ${account.owner.lastName ?? ''}`.trim() || 'there';

      // ── Send alert email via system account ────────────────────────────────
      // Lazy-import NotifyService to avoid circular dependency (payg ↔ notify)
      const { notifyService } = await import('./notify.service');
      await notifyService.sendNotification(systemAccountId, systemAppId, {
        channel: 'EMAIL',
        recipient: account.owner.email,
        templateId,
        app_id: systemAppId,
        payload: {
          accountName: ownerName,
          balance: balance.balance.toFixed(2),
          threshold: threshold.toFixed(2),
          currency: balance.currency,
          topUpUrl: 'https://notify.afrisinc.com/billing/payg',
        },
        priority: 'HIGH',
      });

      // ── Record so we don't alert again within 24 h ────────────────────────
      await (prismaWrite as any).limitNotificationLog.create({
        data: { account_id: accountId, limit_type: 'payg_balance', status: 'low' },
      });

      logger.info({ accountId, balance: balance.balance, threshold }, 'PAYG low-balance alert sent');
    } catch (error) {
      logger.error({ error, accountId }, 'PAYG low-balance alert failed');
    }
  }

  // ─── Mobile Money Methods ─────────────────────────────────────────────────────

  /**
   * Initiate mobile money payment (PAYG top-up or subscription)
   * User pays via MTN/Airtel Mobile Money, action is processed after webhook confirmation
   */
  static async initMobileTopUp(
    accountId: string,
    amount: number,
    phoneNumber: string,
    customerName?: string,
    options?: {
      paymentType?: 'payg_topup' | 'subscription';
      planId?: string;
      billingCycle?: 'monthly' | 'yearly';
    }
  ): Promise<{ payment: MobilePaymentResult; message: string }> {
    if (amount < 100) {
      throw new Error('Minimum mobile money payment is 100 RWF');
    }

    if (!isPaymentClientInitialized()) {
      throw new Error('Payment service not configured');
    }

    const paymentType = options?.paymentType ?? 'payg_topup';
    const isSubscription = paymentType === 'subscription';

    // Build metadata and description based on payment type
    let description: string;
    let metadata: Record<string, unknown>;
    let orderId: string;

    if (isSubscription) {
      if (!options?.planId) {
        throw new Error('planId is required for subscription payments');
      }

      // Fetch plan details for description
      const plan = await SubscriptionRepository.getPlanById(options.planId);
      if (!plan) {
        throw new Error('Plan not found');
      }

      const billingCycle = options.billingCycle ?? 'monthly';
      orderId = `msub_${accountId}_${options.planId}_${billingCycle}_${Date.now()}`;
      description = `${plan.name} plan subscription (${billingCycle})`;
      metadata = {
        accountId,
        type: 'subscription',
        planId: options.planId,
        billingCycle,
        planName: plan.name,
      };
    } else {
      orderId = `momo_topup_${accountId}_${Date.now()}`;
      description = 'PAYG credit top-up';
      metadata = { accountId, type: 'payg_topup' };
    }

    const payment = await getPaymentClient().mobileCashin({
      orderId,
      amount,
      phoneNumber,
      customerName,
      description,
      metadata,
    });

    logger.info(
      { accountId, amount, phoneNumber, ref: payment.ref, orderId, paymentType },
      'Mobile money payment initiated'
    );

    const message = isSubscription
      ? `Please confirm the payment of ${amount.toLocaleString()} RWF on your phone to activate your subscription`
      : 'Please approve the payment on your phone. Credits will be added once payment is confirmed.';

    return { payment, message };
  }

  /**
   * Get mobile payment status by ID
   */
  static async getMobilePayment(paymentId: string): Promise<MobilePaymentResult> {
    if (!isPaymentClientInitialized()) {
      throw new Error('Payment service not configured');
    }

    return getPaymentClient().getMobilePayment(paymentId);
  }

  /**
   * Get mobile payment status by Paypack reference
   */
  static async getMobilePaymentByRef(ref: string): Promise<MobilePaymentResult> {
    if (!isPaymentClientInitialized()) {
      throw new Error('Payment service not configured');
    }

    return getPaymentClient().getMobilePaymentByRef(ref);
  }

  /**
   * Credit PAYG balance after mobile money payment confirmation (webhook)
   * Fetches the original USD amount from payment table (not from webhook response).
   * Called by the internal webhook handler when Paypack confirms payment
   */
  static async creditFromMobilePayment(params: {
    accountId: string;
    amountRwf: number;
    paymentRef: string;
  }): Promise<TopUpResult> {
    const payment = await PaymentRepository.findByRef(params.paymentRef);

    if (!payment) {
      throw new Error(`Payment record not found for ref: ${params.paymentRef}`);
    }

    const amountUsd = payment.amount / 100; // Convert from cents to USD

    const balance = await PaygRepository.getOrCreateBalanceForUpdate(params.accountId);
    const bonusPercent = getBonusPercent(amountUsd);
    const bonusAmount = Number.parseFloat(((amountUsd * bonusPercent) / 100).toFixed(6));

    const result = await PaygRepository.atomicTopUp(
      params.accountId,
      balance.id,
      balance.balance,
      amountUsd,
      bonusAmount,
      params.paymentRef,
      bonusPercent
    );

    logger.info(
      {
        accountId: params.accountId,
        amountRwf: params.amountRwf,
        amountUsd,
        bonus: bonusAmount,
        newBalance: result.newBalance,
        paymentRef: params.paymentRef,
      },
      'PAYG balance credited from mobile money payment — using payment table amount'
    );

    return {
      transaction: mapTransaction({ ...result.topUpTx, status: 'COMPLETED' } as Parameters<typeof mapTransaction>[0]),
      bonusTransaction: result.bonusTx
        ? mapTransaction({ ...result.bonusTx, status: 'COMPLETED' } as Parameters<typeof mapTransaction>[0])
        : null,
      newBalance: result.newBalance,
      bonusPercent,
      bonusAmount,
    };
  }
}
