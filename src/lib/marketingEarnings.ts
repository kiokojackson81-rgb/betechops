import { prisma } from "@/lib/prisma";
import { getCommissionSummaryForSales } from "./marketingCommission";
import { getMarketingReport } from "./marketingReport";
import { getSupportPeriodAggregates } from "./supportEntries";
import { getTradingPeriodFor, getRecentTradingPeriods } from "./tradingPeriod";

export type EarningsSummary = {
  periodKey: string;
  periodLabel: string;

  sales: number;

  baseSalary: number;
  transportAllowance: number;
  commission: number;
  bonusTotal: number;
  chamaTotal: number;
  latenessTotal: number;
  disciplineTotal: number;
  otherDeductionsTotal: number;

  totalEarnings: number;   // base + transport + commission + bonus
  totalDeductions: number; // chama + lateness + discipline + other
  netPay: number;          // totalEarnings - totalDeductions;
};

export async function getEarningsSummaryForAttendant(opts: {
  attendantId: string;
  periodKey: string;
  periodLabel: string;
}): Promise<EarningsSummary> {
  const { attendantId, periodKey, periodLabel } = opts;

  // 1) Fetch total sales for this attendant + period via existing report helper
  const report = await getMarketingReport({ tradingPeriodKey: periodKey, submittedById: attendantId });
  const marketingSales = report?.aggregates?.totalSales ?? 0;

  // 1b) Include support sales for this attendant in the same period so commission
  // reflects both marketing and support priced items. Prefer the periodKey
  // passed from the caller; fall back to the current trading period.
  let period = getTradingPeriodFor(new Date());
  if (periodKey) {
    const recent = getRecentTradingPeriods(24);
    const found = recent.find((p) => p.key === periodKey);
    if (found) period = found;
  }

  const supportSummary = await getSupportPeriodAggregates({ userId: attendantId, period });
  const supportSales = supportSummary?.aggregates?.totalSales ?? 0;

  const sales = marketingSales + supportSales;

  // 2) Commission from existing helper
  const commissionSummary = getCommissionSummaryForSales(sales);
  const commission = commissionSummary.commission ?? 0;

  // 3) Comp plan (if none, treat as zeros)
  const plan = await prisma.attendantCompPlan.findUnique({ where: { attendantId } });

  const baseSalary = plan?.baseSalary ?? 0;
  const transportAllowance = plan?.defaultTransportAllowance ?? 0;

  // 4) All adjustments for this period
  const adjustments = await prisma.attendantPayrollAdjustment.findMany({ where: { attendantId, periodKey } });

  const sum = (filterFn: (a: any) => boolean) =>
    adjustments.filter(filterFn).reduce((acc, a) => acc + (a.amount ?? 0), 0);

  const bonusTotal = sum(
    (a) => a.adjustmentType === "BONUS" || a.adjustmentType === "COMMISSION_TOPUP",
  );
  const chamaTotal = sum((a) => a.adjustmentType === "CHAMA");
  const latenessTotal = sum((a) => a.adjustmentType === "LATENESS");
  const disciplineTotal = sum((a) => a.adjustmentType === "DISCIPLINE");
  const otherDeductionsTotal = sum((a) => a.adjustmentType === "OTHER");

  const totalEarnings = baseSalary + transportAllowance + commission + bonusTotal;
  const totalDeductions = chamaTotal + latenessTotal + disciplineTotal + otherDeductionsTotal;

  const netPay = totalEarnings - totalDeductions;

  return {
    periodKey,
    periodLabel,

    sales,

    baseSalary,
    transportAllowance,
    commission,
    bonusTotal,
    chamaTotal,
    latenessTotal,
    disciplineTotal,
    otherDeductionsTotal,

    totalEarnings,
    totalDeductions,
    netPay,
  };
}
