import { prisma } from "@/lib/prisma";
import { getOrCreateCommissionPeriod, computeSalesCommissionFromTiers } from "@/lib/commission";
import { getMarketingReport } from "./marketingReport";
import { summarizeMarketingReportsForPeriod } from "@/lib/marketingPeriodTotals";
import { getSupportPeriodAggregates } from "./supportEntries";
import { getTradingPeriodFor, getRecentTradingPeriods } from "./tradingPeriod";
import { getPeriodKeyVariants } from "./payrollPeriodKey";

export type EarningsSummary = {
  periodKey: string;
  periodLabel: string;

  sales: number;

  baseSalary: number;
  transportAllowance: number;
  salesCommission: number;
  commission: number;
  bonusTotal: number;
  chamaTotal: number;
  latenessTotal: number;
  disciplineTotal: number;
  otherDeductionsTotal: number;
  cashAdvanceTotal: number;

  totalEarnings: number;   // base + transport + commission + bonus
  totalDeductions: number; // chama + lateness + discipline + other
  netPay: number;          // totalEarnings - totalDeductions;
  adjustmentEntries?: { id: string; label: string; amount: number; adjustmentType: string; adjustmentKind: string }[];
};

export async function getEarningsSummaryForAttendant(opts: {
  attendantId: string;
  periodKey: string;
  periodLabel: string;
}): Promise<EarningsSummary> {
  const { attendantId, periodKey, periodLabel } = opts;

  // 1) Determine trading period (prefer caller's periodKey) and then fetch total sales

  // 1b) Include support sales for this attendant in the same period so commission
  // reflects both marketing and support priced items. Prefer the periodKey
  // passed from the caller; fall back to the current trading period.
  let period = getTradingPeriodFor(new Date());
  if (periodKey) {
    const recent = getRecentTradingPeriods(24);
    const found = recent.find((p) => p.key === periodKey);
    if (found) period = found;
  }

  const tradingPeriod = period;
  const marketingSummary = await summarizeMarketingReportsForPeriod({ userId: attendantId, period: tradingPeriod });
  const marketingSales = marketingSummary?.totals?.totalSales ?? 0;

  const supportSummary = await getSupportPeriodAggregates({ userId: attendantId, period });
  // Merge per-receipt maps to avoid double-counting
  const marketingPer = (marketingSummary as any)?.perReceipts ?? {};
  const supportPer = (supportSummary as any)?.perReceipts ?? {};
  const merged = new Map<string, { sales: number; profit: number }>();
  for (const [k, v] of Object.entries(marketingPer) as [string, any][]) {
    merged.set(k, { sales: v.sales ?? 0, profit: v.profit ?? 0 });
  }
  for (const [k, v] of Object.entries(supportPer) as [string, any][]) {
    const supportObj = { sales: v.sales ?? 0, profit: v.profit ?? 0 };
    if (merged.has(k)) {
      const existing = merged.get(k)!;
      if ((existing.profit ?? 0) <= 0 && (supportObj.profit ?? 0) > 0) {
        merged.set(k, supportObj);
      }
      continue;
    }
    merged.set(k, supportObj);
  }
  let sales = 0;
  for (const [, v] of merged) sales += v.sales;

  // 2) Commission: only award commission once the attendant crosses the
  //    minimum ladder target (KES 1,000,000). Before that no commission
  //    should appear in any earnings summary.
  const { tiers } = (await getOrCreateCommissionPeriod(new Date()));
  const marketingProfit = marketingSummary?.totals?.totalProfit ?? 0;
  const supportProfit = supportSummary?.aggregates?.totalProfit ?? 0;
  let periodProfit = marketingProfit + supportProfit;
  // if merged has per-receipt profit, prefer merged profit
  let mergedProfit = 0;
  for (const [, v] of merged) mergedProfit += v.profit;
  if (mergedProfit > 0) periodProfit = mergedProfit;
  const MIN_SALES_FOR_COMMISSION = 1_000_000;
  const rawCommission = computeSalesCommissionFromTiers(sales, periodProfit, tiers);
  const commission = sales >= MIN_SALES_FOR_COMMISSION ? rawCommission : 0;

  // 3) Comp plan (if none, treat as zeros)
  const plan = await prisma.attendantCompPlan.findUnique({ where: { attendantId } });

  const baseSalary = plan?.baseSalary ?? 0;
  const transportAllowance = plan?.defaultTransportAllowance ?? 0;

  // 4) All adjustments for this period
  const variants = getPeriodKeyVariants(periodKey);
  const adjustmentFilterKeys = variants.length ? variants : [periodKey];
  const adjustments = await prisma.attendantPayrollAdjustment.findMany({
    where: { attendantId, periodKey: { in: adjustmentFilterKeys } },
  });

  const sumSigned = (filterFn: (a: any) => boolean, defaultKind: "ADDITION" | "DEDUCTION") =>
    adjustments
      .filter(filterFn)
      .reduce((acc, a) => {
        const amount = Number(a.amount ?? 0);
        const kind = String(a.adjustmentKind ?? defaultKind).toUpperCase();
        return acc + (kind === "ADDITION" ? amount : -amount);
      }, 0);
  const sumDeduction = (filterFn: (a: any) => boolean) =>
    adjustments
      .filter(filterFn)
      .reduce((acc, a) => {
        const amount = Number(a.amount ?? 0);
        const kind = String(a.adjustmentKind ?? "DEDUCTION").toUpperCase();
        return acc + (kind === "ADDITION" ? -amount : amount);
      }, 0);

  const bonusTotal = sumSigned(
    (a) => a.adjustmentType === "BONUS" || a.adjustmentType === "COMMISSION_TOPUP",
    "ADDITION",
  );
  const chamaTotal = sumDeduction((a) => a.adjustmentType === "CHAMA");
  const latenessTotal = sumDeduction((a) => a.adjustmentType === "LATENESS");
  const disciplineTotal = sumDeduction((a) => a.adjustmentType === "DISCIPLINE");
  const otherDeductionsTotal = sumDeduction((a) => a.adjustmentType === "OTHER");
  const cashAdvanceTotal = sumDeduction((a) => a.adjustmentType === "CASH_ADVANCE");

  const totalEarnings = baseSalary + transportAllowance + commission + bonusTotal;
  const totalDeductions = chamaTotal + latenessTotal + disciplineTotal + otherDeductionsTotal + cashAdvanceTotal;

  const netPay = totalEarnings - totalDeductions;

  const adjustmentEntries = adjustments.map((a) => ({
    id: a.id,
    label: a.label,
    amount: a.amount ?? 0,
    adjustmentType: a.adjustmentType,
    adjustmentKind: String(a.adjustmentKind ?? "DEDUCTION").toUpperCase(),
  }));

  return {
    periodKey,
    periodLabel,

    sales,

    baseSalary,
    transportAllowance,
    salesCommission: commission,
    commission,
    bonusTotal,
    chamaTotal,
    latenessTotal,
    disciplineTotal,
    otherDeductionsTotal,
    cashAdvanceTotal,

    totalEarnings,
    totalDeductions,
    netPay,
    adjustmentEntries,
  };
}
