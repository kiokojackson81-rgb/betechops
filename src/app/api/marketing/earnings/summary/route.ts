import { NextResponse } from "next/server";
import { requireRole, getActorId } from "@/lib/api";
import { getTradingPeriodFor } from "@/lib/tradingPeriod";
import { getEarningsSummaryForUser } from "@/lib/earningsSummary";
import { summarizePosReceiptsForPeriod } from "@/lib/posReceiptSummary";
import { prisma } from "@/lib/prisma";
import { getOrCreateUserCommissionConfig } from "@/lib/userCommissionConfig";
import { buildPayrollRow } from "@/lib/adminPayroll";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await requireRole(["ADMIN", "SUPERVISOR", "ATTENDANT"]);
  if (!auth.ok) return auth.res;

  const url = new URL(req.url);
  const impersonate = url.searchParams.get("impersonateId") || url.searchParams.get("attendantId");

  let attendantId: string | null = null;
  try {
    if (impersonate && auth.role === "ADMIN") {
      attendantId = impersonate;
    } else {
      attendantId = await getActorId();
    }
  } catch (e) {
    attendantId = await getActorId();
  }

  if (!attendantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const period = getTradingPeriodFor(new Date());
  // Enforce server-resolved trading period for dashboard totals.
  // Do not accept client-supplied `periodKey` or `periodLabel`.
  const urlObj = new URL(req.url);
  if (urlObj.searchParams.has("periodKey") || urlObj.searchParams.has("periodLabel")) {
    return NextResponse.json({ error: "This endpoint requires a server-resolved trading period; do not supply periodKey/periodLabel." }, { status: 400 });
  }

  const periodKey = period.key;
  const periodLabel = period.label;

  try {
    const attendant = await prisma.user.findUnique({
      where: { id: attendantId },
      select: { id: true, name: true, email: true, attendantCategory: true, isActive: true },
    });
    if (!attendant) {
      return NextResponse.json({ error: "Attendant not found" }, { status: 404 });
    }

    const [userSummary, payrollRow] = await Promise.all([
      getEarningsSummaryForUser({ userId: attendantId }),
      buildPayrollRow(attendant, period),
    ]);

    const commissionConfig = await getOrCreateUserCommissionConfig(attendantId);
    const usePosTotals = commissionConfig.posTotalsMode !== "NONE";
    let posSummary: Awaited<ReturnType<typeof summarizePosReceiptsForPeriod>> | null = null;
    if (usePosTotals) {
      const posUserId = commissionConfig.posTotalsMode === "GLOBAL" ? null : attendantId;
      posSummary = await summarizePosReceiptsForPeriod({ start: period.start, end: period.end, userId: posUserId });
      userSummary.totalSales = posSummary.totalSales;
      userSummary.totalProfit = posSummary.totalProfit;
      // Do NOT override `userSummary.salesCommission` here — `getEarningsSummaryForUser`
      // already applies per-account commission mode and may provide `jenifferProgress`.
    }

    const ledger = await prisma.commissionLedger.findUnique({
      where: {
        userId_periodStart_periodEnd: {
          userId: attendantId,
          periodStart: period.start,
          periodEnd: period.end,
        },
      },
    });

    // If POS totals are in use, prefer the computed `userSummary.salesCommission`
    // and do not apply the CommissionLedger override. Otherwise, prefer persisted
    // ledger values when present.
    let salesCommission = 0;
    if (!usePosTotals) {
      const detail = ledger?.detail as Record<string, any> | undefined;
      const marketingCommission = detail && typeof detail === "object" ? Number(detail.marketing?.commission ?? 0) : 0;
      const supportCommission = detail && typeof detail === "object" ? Number(detail.support?.commission ?? 0) : 0;

      salesCommission = marketingCommission + supportCommission;
      if (salesCommission === 0 && ledger) {
        salesCommission = Number(ledger.grossCommission ?? 0);
      }
    }

    if (salesCommission === 0) {
      salesCommission = userSummary.salesCommission;
    }

    const grossCommission =
      salesCommission +
      userSummary.newProductCommission +
      userSummary.copiedCommission +
      userSummary.editedCommission +
      userSummary.commissionTopUpTotal;

    const totalEarnings =
      userSummary.baseSalary + userSummary.transportAllowance + grossCommission + userSummary.bonusTotal;
    const totalDeductions =
      userSummary.chamaTotal +
      userSummary.latenessTotal +
      userSummary.disciplineTotal +
      userSummary.otherDeductionsTotal;
    const netPay = totalEarnings - totalDeductions;

    const summary = {
      periodKey,
      periodLabel,
      sales: userSummary.totalSales,
      attendantCategory: payrollRow.attendantCategory,
      baseSalary: payrollRow.baseSalary,
      transportAllowance: payrollRow.transportAllowance,
      jenifferProgress: (userSummary as any).jenifferProgress ?? null,
      salesCommission: payrollRow.commissionDirect || payrollRow.commissionTotal,
      commissionDirect: payrollRow.commissionDirect,
      commissionMarketplaceJumia: payrollRow.commissionMarketplaceJumia,
      commissionMarketplaceKilimall: payrollRow.commissionMarketplaceKilimall,
      commission: payrollRow.commissionTotal,
      grossCommission: payrollRow.commissionGross,
      bonusTotal: payrollRow.adjustmentBreakdown.bonus,
      commissionTopUpTotal: payrollRow.adjustmentBreakdown.commissionTopUp,
      chamaTotal: payrollRow.adjustmentBreakdown.chama,
      latenessTotal: payrollRow.adjustmentBreakdown.lateness,
      disciplineTotal: payrollRow.adjustmentBreakdown.discipline,
      otherDeductionsTotal: payrollRow.adjustmentBreakdown.other,
      adjustmentEntries: payrollRow.adjustmentEntries.map((entry) => ({
        id: entry.id,
        label: entry.label,
        amount: entry.amount,
        adjustmentType: entry.adjustmentType,
        adjustmentKind: entry.kind,
      })),
      totalEarnings: payrollRow.totalEarnings,
      totalDeductions: payrollRow.totalDeductions,
      netPay: payrollRow.netPay,
    };

    return NextResponse.json({ periodKey, periodLabel, summary });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to compute earnings";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
