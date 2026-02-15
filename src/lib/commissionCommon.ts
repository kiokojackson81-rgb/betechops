export const COMMISSION_LADDER: { min: number; reward: number }[] = [
  { min: 1_000_000, reward: 10_000 },
  { min: 2_000_000, reward: 15_000 },
  { min: 3_000_000, reward: 20_000 },
  { min: 4_000_000, reward: 20_000 },
  { min: 5_000_000, reward: 20_000 },
  { min: 6_000_000, reward: 20_000 },
  { min: 7_000_000, reward: 20_000 },
  { min: 8_000_000, reward: 20_000 },
  { min: 9_000_000, reward: 20_000 },
  { min: 10_000_000, reward: 20_000 },
];

export function calculateCumulativeCommission(totalSales: number) {
  const tiersReached = COMMISSION_LADDER.filter((t) => t.min <= totalSales);
  const commission = tiersReached.reduce((sum, t) => sum + t.reward, 0);
  const nextTier = COMMISSION_LADDER.find((t) => t.min > totalSales) || null;
  return {
    commission,
    tiersReached: tiersReached.map((t) => `${t.min}`),
    nextTarget: nextTier?.min ?? null,
    nextTierReward: nextTier?.reward ?? null,
  };
}
