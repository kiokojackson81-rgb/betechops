import { prisma } from "@/lib/prisma";
import { getTradingPeriodFor } from "@/lib/tradingPeriod";
import { getOrCreateCommissionPeriod, computeSalesCommissionFromTiers, computeProductCommissions } from "./commission";

export type EarningsSummary = {
  periodKey: string;
  periodLabel: string;

  totalSales: number;
  totalProfit: number;
  totalNewProducts: number;
  totalEditedProducts: number;
  totalCopiedProducts: number;

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

  const plan = await prisma.attendantCompPlan.findUnique({ where: { attendantId: opts.userId } });
  const baseSalary = plan?.baseSalary ?? 0;
  const transportAllowance = plan?.defaultTransportAllowance ?? 0;

  const adjustments = await prisma.attendantPayrollAdjustment.findMany({
    where: { attendantId: opts.userId, periodKey },
  });

  const sum = (filterFn: (a: typeof adjustments[number]) => boolean) =>
    adjustments.filter(filterFn).reduce((acc, a) => acc + (a.amount ?? 0), 0);

  const bonusTotal = sum((a) => a.adjustmentType === "BONUS");
  const commissionTopUpTotal = sum((a) => a.adjustmentType === "COMMISSION_TOPUP");
  const chamaTotal = sum((a) => a.adjustmentType === "CHAMA");
  const latenessTotal = sum((a) => a.adjustmentType === "LATENESS");
  const disciplineTotal = sum((a) => a.adjustmentType === "DISCIPLINE");
  const otherDeductionsTotal = sum((a) => a.adjustmentType === "OTHER");

  const salesCommission = computeSalesCommissionFromTiers(totalSales, totalProfit, tiers);
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
  };
}
