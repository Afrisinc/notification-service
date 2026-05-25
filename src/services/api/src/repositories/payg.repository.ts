import { prismaRead, prismaWrite } from '@shared/database';
import { logger } from '../config/logger';
import type { CreditTransactionType, PaygChannel } from '../types/payg.types';

export class PaygRepository {
  // ─── Balance ────────────────────────────────────────────────────────────────

  static async getBalance(accountId: string) {
    return prismaRead.creditBalance.findUnique({ where: { account_id: accountId } });
  }

  static async getOrCreateBalance(accountId: string) {
    const existing = await prismaRead.creditBalance.findUnique({
      where: { account_id: accountId },
    });
    if (existing) return existing;

    return prismaWrite.creditBalance.create({
      data: { account_id: accountId, balance: 0, currency: 'USD' },
    });
  }

  static async updateBalance(accountId: string, newBalance: number) {
    return prismaWrite.creditBalance.update({
      where: { account_id: accountId },
      data: { balance: newBalance, updated_at: new Date() },
    });
  }

  // ─── Transactions ────────────────────────────────────────────────────────────

  static async createTransaction(data: {
    accountId: string;
    creditBalanceId: string;
    type: CreditTransactionType;
    amount: number;
    balanceAfter: number;
    description?: string;
    channel?: PaygChannel;
    notificationId?: string;
    paymentRef?: string;
    bonusPercent?: number;
  }) {
    return prismaWrite.creditTransaction.create({
      data: {
        account_id: data.accountId,
        credit_balance_id: data.creditBalanceId,
        type: data.type,
        amount: data.amount,
        balance_after: data.balanceAfter,
        description: data.description ?? null,
        channel: data.channel ?? null,
        notification_id: data.notificationId ?? null,
        payment_ref: data.paymentRef ?? null,
        bonus_percent: data.bonusPercent ?? null,
      },
    });
  }

  static async getTransactions(accountId: string, opts: { page: number; limit: number; type?: string }) {
    const skip = (opts.page - 1) * opts.limit;

    const where: Record<string, unknown> = { account_id: accountId };
    if (opts.type) where['type'] = opts.type;

    const [items, total] = await Promise.all([
      prismaRead.creditTransaction.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take: opts.limit,
      }),
      prismaRead.creditTransaction.count({ where }),
    ]);

    return { items, total, page: opts.page, limit: opts.limit };
  }

  // ─── Atomic top-up (balance + transaction in one write tx) ──────────────────

  static async atomicTopUp(
    accountId: string,
    balanceId: string,
    currentBalance: number,
    topUpAmount: number,
    bonusAmount: number,
    paymentRef: string,
    bonusPercent: number
  ) {
    return prismaWrite.$transaction(async (tx) => {
      const totalCredit = topUpAmount + bonusAmount;
      const newBalance = currentBalance + totalCredit;

      // Update balance
      const balance = await tx.creditBalance.update({
        where: { id: balanceId },
        data: { balance: newBalance, updated_at: new Date() },
      });

      // Top-up transaction
      const topUpTx = await tx.creditTransaction.create({
        data: {
          account_id: accountId,
          credit_balance_id: balanceId,
          type: 'topup',
          amount: topUpAmount,
          balance_after: currentBalance + topUpAmount,
          description: `Credit top-up — $${topUpAmount.toFixed(2)}`,
          payment_ref: paymentRef,
          bonus_percent: bonusPercent,
        },
      });

      // Bonus transaction (if applicable)
      let bonusTx = null;
      if (bonusAmount > 0) {
        bonusTx = await tx.creditTransaction.create({
          data: {
            account_id: accountId,
            credit_balance_id: balanceId,
            type: 'bonus',
            amount: bonusAmount,
            balance_after: newBalance,
            description: `Top-up bonus — ${bonusPercent}% on $${topUpAmount.toFixed(2)}`,
            bonus_percent: bonusPercent,
          },
        });
      }

      return { balance, topUpTx, bonusTx, newBalance };
    });
  }

  // ─── Atomic deduction ────────────────────────────────────────────────────────

  static async atomicDeduct(
    accountId: string,
    balanceId: string,
    currentBalance: number,
    amount: number,
    channel: PaygChannel,
    description: string,
    notificationId?: string
  ) {
    return prismaWrite.$transaction(async (tx) => {
      const newBalance = parseFloat((currentBalance - amount).toFixed(6));

      await tx.creditBalance.update({
        where: { id: balanceId },
        data: { balance: newBalance, updated_at: new Date() },
      });

      const deductTx = await tx.creditTransaction.create({
        data: {
          account_id: accountId,
          credit_balance_id: balanceId,
          type: 'deduction',
          amount: -amount,
          balance_after: newBalance,
          description,
          channel,
          notification_id: notificationId ?? null,
        },
      });

      return { newBalance, deductTx };
    });
  }
}
