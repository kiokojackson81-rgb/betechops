import { prisma } from "@/lib/prisma";
import { getTradingPeriodFor } from "@/lib/tradingPeriod";
import { getOrCreateCommissionPeriod, computeSalesCommissionFromTiers, computeProductCommissions } from "./commission";
import { summarizeMarketingReportsForPeriod } from "@/lib/marketingPeriodTotals";

export type EarningsSummary = {
  periodKey: string;
  periodLabel: string;

  totalSales: number;
  totalProfit: number;
  totalNewProducts: number;
  totalEditedProducts: number;
  totalCopiedProducts: number;
  totalItems?: number;
  totalReceipts?: number;
  walkInsServed?: number;
  walkInsPurchased?: number;

  baseSalary: number;
  transportAllowance: number;

  salesCommission: number;
  newProductCommission: number;
  copiedCommission: number;
  editedCommission: number;
  grossCommission: number;
  batteryEarnings: number;

  bonusTotal: number;
  commissionTopUpTotal: number;

  chamaTotal: number;
  latenessTotal: number;
  disciplineTotal: number;
  otherDeductionsTotal: number;

  totalEarnings: number;
  totalDeductions: number;
  netPay: number;
  ledger?: {
    grossCommission: number;
    netCommission: number;
    penalties: number;
    detail: unknown;
  } | null;
};

export async function getEarningsSummaryForUser(opts: { userId: string; asOf?: Date }) {
  const now = opts.asOf ?? new Date();
  const tradingPeriod = getTradingPeriodFor(now);
  const periodKey = `${tradingPeriod.start.toISOString().split("T")[0]}_${tradingPeriod.end.toISOString().split("T")[0]}`;
  const periodLabel = tradingPeriod.label;

  const { period, tiers, tradingPeriod: periodInfo } = await getOrCreateCommissionPeriod(now);
  const start = (periodInfo as any).startDate ?? (periodInfo as any).start;
  const end = (periodInfo as any).endDate ?? (periodInfo as any).end;

  const snapshots = await prisma.profitSnapshot.findMany({
    where: {
      orderItem: {
        order: {
          attendantId: opts.userId,
          createdAt: { gte: start, lte: end },
        },
      },
    },
    select: {
      revenue: true,
      profit: true,
    },
  });

  let totalSales = 0;
  let totalProfit = 0;
  for (const row of snapshots) {
    totalSales += Number(row.revenue ?? 0);
    totalProfit += Number(row.profit ?? 0);
  }

  const reports = await prisma.dailyReport.findMany({
    where: { userId: opts.userId, date: { gte: start, lte: end } },
    select: {
      newProducts: true,
      productsEdited: true,
      copiesUploaded: true,
    },
  });

  let newProducts = 0;
  let editedProducts = 0;
  let copiedProducts = 0;
  for (const report of reports) {
    newProducts += report.newProducts ?? 0;
    editedProducts += report.productsEdited ?? 0;
    copiedProducts += report.copiesUploaded ?? 0;
  }

  const marketingSummary = await summarizeMarketingReportsForPeriod({
    userId: opts.userId,
    period: tradingPeriod,
  });
  const marketingTotals = marketingSummary.totals;
  if (marketingTotals.totalSales > totalSales) {
    totalSales = marketingTotals.totalSales;
    totalProfit = marketingTotals.totalProfit;
  }

  const plan = await prisma.attendantCompPlan.findUnique({ where: { attendantId: opts.userId } });
  const baseSalary = plan?.baseSalary ?? 0;
  const transportAllowance = plan?.defaultTransportAllowance ?? 0;

  // Build two common periodKey formats used in various parts of the app so we
  // can find adjustments regardless of which format was used when creating them.
  // 1) YYYY-MM-DD_YYYY-MM-DD (used by some endpoints)
  // 2) <ISO_WITH_TZ>_<ISO_WITH_TZ> (used by admin/check scripts)
  const startDateOnly = tradingPeriod.start.toISOString().split("T")[0];
  const endDateOnly = tradingPeriod.end.toISOString().split("T")[0];
  const periodKeyDateOnly = `${startDateOnly}_${endDateOnly}`;
  const periodKeyIso = `${tradingPeriod.start.toISOString()}_${tradingPeriod.end.toISOString()}`;

  const adjustments = await prisma.attendantPayrollAdjustment.findMany({
    where: {
      attendantId: opts.userId,
      OR: [{ periodKey: periodKeyDateOnly }, { periodKey: periodKeyIso }],
    },
    orderBy: { createdAt: "desc" },
  });

  // Respect the adjustmentKind (ADDITION | DEDUCTION) when computing totals.
  // Some adjustment types (e.g., BONUS, COMMISSION_TOPUP) are meaningful as additions,
  // while CHAMA/LATENESS/DISCIPLINE/OTHER are deductions — but we still honour the
  // explicit adjustmentKind to allow admin-created additions or deductions.
  let bonusTotal = 0;
  let commissionTopUpTotal = 0;
  let chamaTotal = 0;
  let latenessTotal = 0;
  let disciplineTotal = 0;
  let otherDeductionsTotal = 0;

  const adjustmentEntries = adjustments.map((a) => ({
    id: a.id,
    label: a.label,
    amount: a.amount ?? 0,
    adjustmentType: a.adjustmentType,
    adjustmentKind: String(a.adjustmentKind ?? "DEDUCTION").toUpperCase(),
  }));

  for (const a of adjustments) {
    const kind = String(a.adjustmentKind ?? "DEDUCTION").toUpperCase();
    const amt = Number(a.amount ?? 0);
    const isAddition = kind === "ADDITION";
    const t = a.adjustmentType;

    if (t === "BONUS") {
      if (isAddition) bonusTotal += amt; else bonusTotal -= amt;
    } else if (t === "COMMISSION_TOPUP") {
      if (isAddition) commissionTopUpTotal += amt; else commissionTopUpTotal -= amt;
    } else if (t === "CHAMA") {
      if (!isAddition) chamaTotal += amt; else chamaTotal -= amt;
    } else if (t === "LATENESS") {
      if (!isAddition) latenessTotal += amt; else latenessTotal -= amt;
    } else if (t === "DISCIPLINE") {
      if (!isAddition) disciplineTotal += amt; else disciplineTotal -= amt;
    } else if (t === "OTHER") {
      if (!isAddition) otherDeductionsTotal += amt; else otherDeductionsTotal -= amt;
    } else {
      // unknown types: treat as deduction by default
      if (!isAddition) otherDeductionsTotal += amt; else bonusTotal += amt;
    }
  }

  // For the attendant-facing earnings summary we use the default behaviour
  // (which applies the configured profit-fallback percent) so this endpoint
  // mirrors previous commission calculations.
  const fallbackPercent = totalProfit > 0 ? 0.05 : 0;
  const salesCommission = computeSalesCommissionFromTiers(totalSales, totalProfit, tiers, fallbackPercent);
  const { newProductCommission, copiedCommission, editedCommission } = computeProductCommissions({
    newProducts,
    copiedProducts,
    editedProducts,
  });

  const grossCommission =
    salesCommission + newProductCommission + copiedCommission + editedCommission + commissionTopUpTotal;

  const totalEarnings = baseSalary + transportAllowance + grossCommission + bonusTotal;
  const totalDeductions = chamaTotal + latenessTotal + disciplineTotal + otherDeductionsTotal;
  const netPay = totalEarnings - totalDeductions;

  return {
    periodKey,
    periodLabel,
    totalSales,
    totalProfit,
    totalNewProducts: newProducts,
    totalEditedProducts: editedProducts,
    totalCopiedProducts: copiedProducts,
    totalItems: 0,
    totalReceipts: 0,
    walkInsServed: 0,
    walkInsPurchased: 0,
    baseSalary,
    transportAllowance,
    salesCommission,
    newProductCommission,
    copiedCommission,
    editedCommission,
    grossCommission,
    batteryEarnings: 0,
    bonusTotal,
    commissionTopUpTotal,
    chamaTotal,
    latenessTotal,
    disciplineTotal,
    otherDeductionsTotal,
    totalEarnings,
    totalDeductions,
    netPay,
    ledger: null,
    adjustmentEntries,
  };
}
