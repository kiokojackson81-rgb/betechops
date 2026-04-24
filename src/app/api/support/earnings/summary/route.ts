import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTradingPeriodFor, parseTradingPeriodKey } from "@/lib/tradingPeriod";
import { requireAttendant } from "@/lib/auth";
import { getSupportPeriodAggregates } from "@/lib/supportEntries";
import { getCommissionSummaryForSales } from "@/lib/marketingCommission";
import { getPeriodKeyVariantsFromDates } from "@/lib/payrollPeriodKey";
import { ensurePayrollAdjustmentStorage } from "@/lib/payrollAdjustmentStorage";
import { buildPayrollRow } from "@/lib/adminPayroll";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await requireAttendant(req, ["SUPPORT_OPS", "ADMIN"]);
  if (!auth.ok) return auth.res;

  const url = new URL(req.url);
  const periodKeyParam = url.searchParams.get("periodKey");
  const period = parseTradingPeriodKey(periodKeyParam ?? undefined) ?? getTradingPeriodFor(new Date());
  const periodKey = period.key;
  const attendant = await prisma.user.findUnique({
    where: { id: auth.user.id },
    select: { id: true, name: true, email: true, attendantCategory: true, isActive: true },
  });
  if (!attendant) {
    return NextResponse.json({ error: "Attendant not found" }, { status: 404 });
  }

  await ensurePayrollAdjustmentStorage();
  const [{ aggregates }, compPlan, adjustments, ledger, payrollRow] = await Promise.all([
    getSupportPeriodAggregates({ userId: auth.user.id, period }),
    prisma.attendantCompPlan.findUnique({ where: { attendantId: auth.user.id } }),
    prisma.attendantPayrollAdjustment.findMany({
      where: {
        attendantId: auth.user.id,
        periodKey: { in: getPeriodKeyVariantsFromDates(period.start, period.end) },
      },
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
    buildPayrollRow(attendant, period),
  ]);

  const periodSales = aggregates.totalSales;
  const periodProfit = aggregates.totalProfit;
  const totalBatteries = aggregates.newBatteries + aggregates.changedBatteries;
  const batteryEarnings = totalBatteries * 70;

  const detail = ledger?.detail as Record<string, any> | undefined;
  const supportDetail = detail && typeof detail === "object" ? (detail.support as Record<string, any> | undefined) : undefined;
  let salesCommission: number | null = null;
  // Prefer authoritative persisted commissionTotal when present
  if (ledger && Number(ledger.commissionTotal ?? 0) > 0) {
    salesCommission = Number(ledger.commissionTotal);
  } else if (supportDetail && typeof supportDetail.commission === "number") {
    salesCommission = supportDetail.commission;
  } else if (ledger && Number(ledger.grossCommission ?? 0) > 0) {
    salesCommission = Number(ledger.grossCommission) || 0;
  }
  if (salesCommission === null) {
    const fallbackCommission = Math.max(0, Math.round(periodProfit * 0.05));
    const tierCommission = getCommissionSummaryForSales(periodSales).commission ?? 0;
    salesCommission = fallbackCommission + tierCommission;
  }

  const baseSalary = compPlan?.baseSalary ?? 0;
  const transportAllowance = compPlan?.defaultTransportAllowance ?? 0;

  const sumSigned = (types: string[], defaultKind: "ADDITION" | "DEDUCTION") =>
    adjustments
      .filter((adj) => types.includes(adj.adjustmentType))
      .reduce((sum, adj) => {
        const amount = Number(adj.amount ?? 0);
        const kind = String(adj.adjustmentKind ?? defaultKind).toUpperCase();
        return sum + (kind === "ADDITION" ? amount : -amount);
      }, 0);
  const sumDeduction = (types: string[]) =>
    adjustments
      .filter((adj) => types.includes(adj.adjustmentType))
      .reduce((sum, adj) => {
        const amount = Number(adj.amount ?? 0);
        const kind = String(adj.adjustmentKind ?? "DEDUCTION").toUpperCase();
        return sum + (kind === "ADDITION" ? -amount : amount);
      }, 0);

  const bonusTotal = sumSigned(["BONUS"], "ADDITION");
  const commissionTopUpTotal = sumSigned(["COMMISSION_TOPUP"], "ADDITION");
  const chamaTotal = sumDeduction(["CHAMA"]);
  const latenessTotal = sumDeduction(["LATENESS"]);
  const disciplineTotal = sumDeduction(["DISCIPLINE"]);
  const otherDeductionsTotal = sumDeduction(["OTHER"]);

  const totalEarnings =
    baseSalary +
    transportAllowance +
    salesCommission +
    batteryEarnings +
    bonusTotal +
    commissionTopUpTotal;
  const totalDeductions = chamaTotal + latenessTotal + disciplineTotal + otherDeductionsTotal;
  const netPay = totalEarnings - totalDeductions;
  const adjustmentEntries = adjustments.map((a) => ({
    id: a.id,
    label: a.label,
    amount: a.amount ?? 0,
    adjustmentType: a.adjustmentType,
    adjustmentKind: String(a.adjustmentKind ?? "DEDUCTION").toUpperCase(),
  }));

  return NextResponse.json({
    periodKey,
    periodLabel: period.label,
    attendantCategory: payrollRow.attendantCategory,
    totalSales: periodSales,
    totalProfit: periodProfit,
    totalNewProducts: 0,
    totalEditedProducts: 0,
    totalCopiedProducts: 0,
    baseSalary: payrollRow.baseSalary,
    transportAllowance: payrollRow.transportAllowance,
    salesCommission: payrollRow.commissionDirect || payrollRow.commissionTotal,
    commissionDirect: payrollRow.commissionDirect,
    commissionMarketplaceJumia: payrollRow.commissionMarketplaceJumia,
    commissionMarketplaceKilimall: payrollRow.commissionMarketplaceKilimall,
    newProductCommission: 0,
    copiedCommission: 0,
    editedCommission: 0,
    grossCommission: payrollRow.commissionGross,
    bonusTotal: payrollRow.adjustmentBreakdown.bonus,
    commissionTopUpTotal: payrollRow.adjustmentBreakdown.commissionTopUp,
    chamaTotal: payrollRow.adjustmentBreakdown.chama,
    latenessTotal: payrollRow.adjustmentBreakdown.lateness,
    disciplineTotal: payrollRow.adjustmentBreakdown.discipline,
    otherDeductionsTotal: payrollRow.adjustmentBreakdown.other,
    totalEarnings: payrollRow.totalEarnings,
    totalDeductions: payrollRow.totalDeductions,
    netPay: payrollRow.netPay,
    batteryEarnings,
    adjustmentEntries: payrollRow.adjustmentEntries.map((entry) => ({
      id: entry.id,
      label: entry.label,
      amount: entry.amount,
      adjustmentType: entry.adjustmentType,
      adjustmentKind: entry.kind,
    })),
  });
}
