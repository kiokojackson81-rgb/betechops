export type CommissionStep = {
  min: number;
  amount: number;
  label: string;
};

export const COMMISSION_LADDER: CommissionStep[] = [
  { min: 1_000_000, amount: 10_000, label: "1M tier" },
  { min: 2_000_000, amount: 15_000, label: "2M tier" },
  { min: 3_000_000, amount: 20_000, label: "3M tier" },
  { min: 4_000_000, amount: 20_000, label: "4M tier" },
  { min: 5_000_000, amount: 20_000, label: "5M tier" },
  { min: 6_000_000, amount: 20_000, label: "6M tier" },
  { min: 7_000_000, amount: 20_000, label: "7M tier" },
  { min: 8_000_000, amount: 20_000, label: "8M tier" },
  { min: 9_000_000, amount: 20_000, label: "9M tier" },
  { min: 10_000_000, amount: 20_000, label: "10M tier" },
];

export function calculateCumulativeCommission(periodSales: number) {
  let commission = 0;
  const tiersReached: string[] = [];

  for (const tier of COMMISSION_LADDER) {
    if (periodSales >= tier.min) {
      commission += tier.amount;
      tiersReached.push(tier.label);
    }
  }

  const nextTier = COMMISSION_LADDER.find((t) => periodSales < t.min);

  return {
    commission,
    tiersReached,
    nextTarget: nextTier?.min ?? null,
    nextTierReward: nextTier?.amount ?? null,
  };
}
