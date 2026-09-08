import type { CreditTransactionDto } from '../types/payg.types';

export interface RawCreditTransaction {
  id: string;
  account_id: string;
  type: string;
  status: string;
  amount: number;
  balance_after: number;
  description: string | null;
  channel: string | null;
  notification_id: string | null;
  payment_ref: string | null;
  bonus_percent: number | null;
  created_at: Date;
}

export function mapTransaction(t: RawCreditTransaction): CreditTransactionDto {
  return {
    id: t.id,
    accountId: t.account_id,
    type: t.type as CreditTransactionDto['type'],
    status: t.status as CreditTransactionDto['status'],
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

export function mapTransactions(transactions: RawCreditTransaction[]): CreditTransactionDto[] {
  return transactions.map(mapTransaction);
}
