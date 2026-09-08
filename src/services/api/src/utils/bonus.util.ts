export interface TopUpTier {
  minAmount: number;
  bonusPercent: number;
}

export const TOPUP_TIERS: TopUpTier[] = [
  { minAmount: 250, bonusPercent: 5 }, //change this to 15% when we have enough funds
  { minAmount: 100, bonusPercent: 2 }, //change this to 10% when we have enough funds
  { minAmount: 50, bonusPercent: 1 }, //change this to 5% when we have enough funds
  { minAmount: 0, bonusPercent: 0 },
];

export function getBonusPercent(amount: number): number {
  const tier = TOPUP_TIERS.find((t) => amount >= t.minAmount);
  return tier?.bonusPercent ?? 0;
}

export function calculateBonusAmount(amount: number, bonusPercent: number): number {
  return Number.parseFloat(((amount * bonusPercent) / 100).toFixed(6));
}

export function calculateTotalCredit(topUpAmount: number, bonusAmount: number): number {
  return topUpAmount + bonusAmount;
}
