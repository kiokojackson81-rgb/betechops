import { calculateCumulativeCommission } from "./commission";

export type CommissionSummary = {
  commission: number;
  currentSales: number;
  nextTarget: number | null;
  tiersReached: string[];
  nextTierReward: number | null;
};

// Wrapper that exposes the commission logic used across admin + tracker.
// It delegates to the existing `calculateCumulativeCommission` implementation
// to ensure the math stays identical.
export function getCommissionSummaryForSales(totalSales: number): CommissionSummary {
  const info = calculateCumulativeCommission(totalSales);
  return {
    commission: info.commission,
    currentSales: totalSales,
    nextTarget: info.nextTarget ?? null,
    tiersReached: info.tiersReached ?? [],
    nextTierReward: info.nextTierReward ?? null,
  };
}
