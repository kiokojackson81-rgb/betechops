import { prisma } from "@/lib/prisma";
import { getTradingPeriodFor } from "@/lib/tradingPeriod";

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
) {
  const firstTierMin = tiers.length ? tiers[0].minSales : 500_000;
  if (totalSales < firstTierMin) {
    return 0.05 * totalProfit;
  }
  let commission = 0;
  for (const tier of tiers) {
    if (totalSales >= tier.minSales) {
      commission += tier.payoutFlat;
    }
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
