import { prisma } from "@/lib/prisma";
import { getTradingPeriodFor } from "@/lib/tradingPeriod";
import { COMMISSION_LADDER, calculateCumulativeCommission } from "./commissionCommon";

export type CommissionBreakdown = {
  periodKey: string;
  periodLabel: string;
  totalSales: number;
  totalProfit: number;
  salesCommission: number;
  newProductCommission: number;
  copiedCommission: number;
  editedCommission: number;
  grossCommission: number;
};

const DEFAULT_TIERS = [
  { minSales: 500_000, maxSales: 1_000_000, payoutFlat: 10_000 },
  { minSales: 2_000_000, maxSales: 2_000_000, payoutFlat: 15_000 },
  { minSales: 3_000_000, maxSales: 3_000_000, payoutFlat: 20_000 },
  { minSales: 4_000_000, maxSales: 4_000_000, payoutFlat: 20_000 },
  { minSales: 5_000_000, maxSales: 5_000_000, payoutFlat: 20_000 },
  { minSales: 6_000_000, maxSales: 6_000_000, payoutFlat: 20_000 },
  { minSales: 7_000_000, maxSales: 7_000_000, payoutFlat: 20_000 },
  { minSales: 8_000_000, maxSales: 8_000_000, payoutFlat: 20_000 },
  { minSales: 9_000_000, maxSales: 9_000_000, payoutFlat: 20_000 },
  { minSales: 10_000_000, maxSales: 10_000_000, payoutFlat: 20_000 },
];

export async function getOrCreateCommissionPeriod(date: Date) {
  const tradingPeriod = getTradingPeriodFor(date);
  if (!tradingPeriod) throw new Error("No trading period for given date");

  const { key: periodKey, label: periodLabel, start, end } = tradingPeriod;

  let period = await prisma.commissionPeriod.findFirst({
    where: {
      startDate: start,
      endDate: end,
    },
  });

  if (!period) {
    period = await prisma.commissionPeriod.create({
      data: {
        name: periodLabel,
        startDate: start,
        endDate: end,
      },
    });
  }

  const existingTiers = await prisma.commissionTier.findMany({
    where: { periodId: period.id },
  });

  if (existingTiers.length === 0) {
    await prisma.commissionTier.createMany({
      data: DEFAULT_TIERS.map((tier) => ({
        periodId: period!.id,
        minSales: tier.minSales,
        maxSales: tier.maxSales,
        payoutFlat: tier.payoutFlat,
      })),
    });
  }

  const tiers = await prisma.commissionTier.findMany({
    where: { periodId: period.id },
    orderBy: { minSales: "asc" },
  });

  return {
    period,
    tiers,
    tradingPeriod: {
      key: periodKey,
      label: periodLabel,
      startDate: start,
      endDate: end,
    },
  };
}

export function computeSalesCommissionFromTiers(
  totalSales: number,
  totalProfit: number,
  tiers: { minSales: number; maxSales: number; payoutFlat: number }[],
  // optional: percentage fallback to apply when sales are below first tier.
  // If `undefined` or 0 the fallback is disabled (returns 0 until a tier is reached).
  fallbackPercent: number | undefined = 0.05,
) {
  // If no tiers provided, fall back to the profit-percentage behavior.
  if (!tiers || tiers.length === 0) {
    if (!fallbackPercent || fallbackPercent <= 0) return 0;
    return fallbackPercent * totalProfit;
  }

  // Make a safe sorted copy of tiers by minSales.
  const sorted = [...tiers].sort((a, b) => a.minSales - b.minSales);

  const firstTierMin = sorted[0].minSales;
  if (totalSales < firstTierMin) {
    if (!fallbackPercent || fallbackPercent <= 0) return 0;
    return fallbackPercent * totalProfit;
  }

  let commission = 0;

  // We treat each tier as a band. For band i we consider the range from
  // bandStart (previous band end or this tier.min for the first) up to bandEnd.
  // Within a band, payout is proportional to progress through that band.
  let previousMaxSales = sorted[0].minSales;

  for (let i = 0; i < sorted.length; i++) {
    const tier = sorted[i];

    const bandStart = Math.max(tier.minSales, previousMaxSales);
    const bandEnd = tier.maxSales ?? tier.minSales;
    const bandWidth = Math.max(0, bandEnd - bandStart);

    if (bandWidth <= 0) {
      // Degenerate band — treat as a step. If we've reached it, award full payout.
      if (totalSales >= bandEnd) {
        commission += tier.payoutFlat;
        previousMaxSales = bandEnd;
        continue;
      } else {
        break;
      }
    }

    if (totalSales >= bandEnd) {
      // Completed this band fully → full payout
      commission += tier.payoutFlat;
    } else if (totalSales > bandStart) {
      // Inside this band → prorate based on progress and stop.
      const progress = (totalSales - bandStart) / bandWidth; // 0..1
      commission += tier.payoutFlat * progress;
      return commission;
    } else {
      // Haven't started this band yet.
      break;
    }

    previousMaxSales = bandEnd;
  }

  return commission;
}

export function computeProductCommissions(args: {
  newProducts: number;
  copiedProducts: number;
  editedProducts: number;
}) {
  const { newProducts, copiedProducts, editedProducts } = args;
  const eligibleNew = Math.max(0, newProducts - 2_000);
  const newProductCommission = Math.min(eligibleNew * 3, 10_000);
  const copiedCommission = Math.floor(copiedProducts / 5);
  const editedCommission = Math.floor(editedProducts / 10);
  return { newProductCommission, copiedCommission, editedCommission };
}

// Commission ladder used by reporting code to compute progress and cumulative rewards.
// Re-export pure helpers from the server-safe common module.
export { COMMISSION_LADDER, calculateCumulativeCommission };
