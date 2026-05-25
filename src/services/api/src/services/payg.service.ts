import { logger } from '../config/logger';
import { getConfig } from '@shared/config';
import { prismaRead, prismaWrite } from '@shared/database';
import { PaygRepository } from '../repositories/payg.repository';
import type {
  PaygRates,
  TopUpTier,
  TopUpRequest,
  TopUpResult,
  DeductCreditsRequest,
  DeductCreditsResult,
  CreditBalanceDto,
  CreditTransactionDto,
  PaygChannel,
} from '../types/payg.types';

// ─── Rates & tiers (source of truth = Pricing page) ─────────────────────────

export const PAYG_RATES: PaygRates = {
  EMAIL: 0.0008, // $0.80 per 1,000 emails
  SMS: 0.035, // $0.035 per message
  PUSH: 0.00005, // $0.50 per 10,000 push
  IN_APP: 0.00004, // $0.40 per 10,000 in-app
};

const TOPUP_TIERS: TopUpTier[] = [
  { minAmount: 250, bonusPercent: 15 },
  { minAmount: 100, bonusPercent: 10 },
  { minAmount: 50, bonusPercent: 5 },
  { minAmount: 0, bonusPercent: 0 },
];

const MIN_TOPUP_AMOUNT = 5; // USD

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

function getBonusPercent(amount: number): number {
  const tier = TOPUP_TIERS.find((t) => amount >= t.minAmount);
  return tier?.bonusPercent ?? 0;
}

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

function mapTransaction(t: {
  id: string;
  account_id: string;
  type: string;
  amount: number;
  balance_after: number;
  description: string | null;
  channel: string | null;
  notification_id: string | null;
  payment_ref: string | null;
  bonus_percent: number | null;
  created_at: Date;
}): CreditTransactionDto {
  return {
    id: t.id,
    accountId: t.account_id,
    type: t.type as CreditTransactionDto['type'],
    amount: t.amount,
    balanceAfter: t.balance_after,
    description: t.description,
    channel: t.channel,
    notificationId: t.notification_id,
    paymentRef: t.payment_ref,
    bonusPercent: t.bonus_percent,
    createdAt: t.created_at,
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
   * Top up credits.
   * Applies bonus tier automatically. Mocks payment processing.
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

    const balance = await PaygRepository.getOrCreateBalance(accountId);
    const bonusPercent = getBonusPercent(req.amount);
    const bonusAmount = parseFloat(((req.amount * bonusPercent) / 100).toFixed(6));

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
      transaction: mapTransaction(result.topUpTx as Parameters<typeof mapTransaction>[0]),
      bonusTransaction: result.bonusTx ? mapTransaction(result.bonusTx as Parameters<typeof mapTransaction>[0]) : null,
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
      items: result.items.map((t: Parameters<typeof mapTransaction>[0]) => mapTransaction(t)),
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
    const required = parseFloat((rate * quantity).toFixed(6));

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
}
