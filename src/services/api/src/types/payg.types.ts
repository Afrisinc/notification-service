/**
 * PAYG (Pay-as-you-go) domain types
 */

export type CreditTransactionType = 'topup' | 'deduction' | 'bonus' | 'refund' | 'subscription';

export type CreditTransactionStatus = 'PENDING' | 'COMPLETED' | 'FAILED';

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
  status: CreditTransactionStatus;
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

export type PaymentType = 'payg_topup' | 'subscription';
export type PaymentMethod = 'card' | 'mobile';

export interface InitializePaymentRequest {
  type: PaymentType;
  method: PaymentMethod;
  amount?: number; // USD — required for payg_topup; derived from the plan for subscription
  email?: string; // required for card
  phoneNumber?: string; // required for mobile
  customerName?: string;
  planId?: string; // required for subscription
  billingCycle?: 'monthly' | 'yearly';
}

export interface InitializePaymentResult {
  transaction: CreditTransactionDto;
  orderId: string;
  amountUSD: number;
  amountRWF: number;
  method: PaymentMethod;
  checkoutUrl?: string; // card
  pcode?: string; // card
  paymentRef?: string; // mobile
  message: string;
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
