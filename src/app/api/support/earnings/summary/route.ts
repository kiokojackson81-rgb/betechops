import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTradingPeriodFor } from "@/lib/tradingPeriod";
import { requireAttendant } from "@/lib/auth";
import { getSupportPeriodAggregates } from "@/lib/supportEntries";
import { getCommissionSummaryForSales } from "@/lib/marketingCommission";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await requireAttendant(req, ["SUPPORT_OPS", "ADMIN"]);
  if (!auth.ok) return auth.res;

  const period = getTradingPeriodFor(new Date());
  const periodKey = period.key;

  const [{ aggregates }, compPlan, adjustments, ledger] = await Promise.all([
    getSupportPeriodAggregates({ userId: auth.user.id, period }),
    prisma.attendantCompPlan.findUnique({ where: { attendantId: auth.user.id } }),
    prisma.attendantPayrollAdjustment.findMany({
      where: { attendantId: auth.user.id, periodKey },
    }),
    prisma.commissionLedger.findUnique({
      where: {
        userId_periodStart_periodEnd: {
          userId: auth.user.id,
          periodStart: period.start,
          periodEnd: period.end,
        },
      },
    }),
  ]);

  const periodSales = aggregates.totalSales;
  const periodProfit = aggregates.totalProfit;
  const totalBatteries = aggregates.newBatteries + aggregates.changedBatteries;
  const batteryEarnings = totalBatteries * 70;

  const commissionFromLedger = ledger ? Number(ledger.grossCommission ?? 0) : null;
  const salesCommission =
    commissionFromLedger ?? getCommissionSummaryForSales(periodSales).commission ?? 0;

  const baseSalary = compPlan?.baseSalary ?? 0;
  const transportAllowance = compPlan?.defaultTransportAllowance ?? 0;

  const sumByType = (types: string[]) =>
    adjustments
      .filter((adj) => types.includes(adj.adjustmentType))
      .reduce((sum, adj) => sum + (adj.amount ?? 0), 0);

  const bonusTotal = sumByType(["BONUS"]);
  const commissionTopUpTotal = sumByType(["COMMISSION_TOPUP"]);
  const chamaTotal = sumByType(["CHAMA"]);
  const latenessTotal = sumByType(["LATENESS"]);
  const disciplineTotal = sumByType(["DISCIPLINE"]);
  const otherDeductionsTotal = sumByType(["OTHER"]);

  const totalEarnings =
    baseSalary +
    transportAllowance +
    salesCommission +
    batteryEarnings +
    bonusTotal +
    commissionTopUpTotal;
  const totalDeductions = chamaTotal + latenessTotal + disciplineTotal + otherDeductionsTotal;
  const netPay = totalEarnings - totalDeductions;

  return NextResponse.json({
    periodKey,
    periodLabel: period.label,
    totalSales: periodSales,
    totalProfit: periodProfit,
    totalNewProducts: 0,
    totalEditedProducts: 0,
    totalCopiedProducts: 0,
    baseSalary,
    transportAllowance,
    salesCommission,
    newProductCommission: 0,
    copiedCommission: 0,
    editedCommission: 0,
    grossCommission: salesCommission + batteryEarnings + commissionTopUpTotal,
    bonusTotal,
    commissionTopUpTotal,
    chamaTotal,
    latenessTotal,
    disciplineTotal,
    otherDeductionsTotal,
    totalEarnings,
    totalDeductions,
    netPay,
    batteryEarnings,
  });
}
