/**
 * PAYG (Pay-as-you-go) domain types
 */

export type CreditTransactionType = 'topup' | 'deduction' | 'bonus' | 'refund';

export type PaygChannel = 'EMAIL' | 'SMS' | 'PUSH' | 'IN_APP';

/** Per-message rates in USD */
export interface PaygRates {
  EMAIL: number; // 0.0008 per email  ($0.80 / 1,000)
  SMS: number; // 0.035 per message
  PUSH: number; // 0.00005 per push  ($0.50 / 10,000)
  IN_APP: number; // 0.00004 per in-app ($0.40 / 10,000)
}

/** Top-up tiers with bonus percentages */
export interface TopUpTier {
  minAmount: number;
  bonusPercent: number;
}

export interface CreditBalanceDto {
  id: string;
  accountId: string;
  balance: number;
  currency: string;
  updatedAt: Date;
}

export interface CreditTransactionDto {
  id: string;
  accountId: string;
  type: CreditTransactionType;
  amount: number;
  balanceAfter: number;
  description: string | null;
  channel: string | null;
  notificationId: string | null;
  paymentRef: string | null;
  bonusPercent: number | null;
  createdAt: Date;
}

export interface TopUpRequest {
  amount: number; // USD amount to top up (min $5)
  paymentRef?: string; // provided by real payment processor later
}

export interface TopUpResult {
  transaction: CreditTransactionDto;
  bonusTransaction: CreditTransactionDto | null;
  newBalance: number;
  bonusPercent: number;
  bonusAmount: number;
}

export interface DeductCreditsRequest {
  accountId: string;
  channel: PaygChannel;
  quantity: number;
  notificationId?: string;
}

export interface DeductCreditsResult {
  success: boolean;
  amountDeducted: number;
  newBalance: number;
  insufficientFunds: boolean;
}
