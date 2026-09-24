import { NextResponse } from "next/server";
import { getEarningsSummaryForUser } from "@/lib/earningsSummary";
import { getTradingPeriodFor, parseTradingPeriodKey } from "@/lib/tradingPeriod";
import { summarizeMarketingReportsForPeriod } from "@/lib/marketingPeriodTotals";
import { getSupportPeriodAggregates } from "@/lib/supportEntries";
import { prisma } from "@/lib/prisma";
import { composeIdentityResponse, resolveTargetUserId } from "@/lib/resolveTargetUser";
import getAttendantCommissionSummary from "@/lib/attendantCommission";
import type { Role } from "@prisma/client";
import { calculatePayrollForAttendant } from "@/lib/adminPayroll";
import { startPayrollTiming } from "@/lib/payrollTiming";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const timing = startPayrollTiming("/api/attendant/earnings/summary");
  const identity = await resolveTargetUserId(req, { allowedImpersonationRoles: ["ADMIN" as Role] });
  const meta = identity;
  const userId = identity.resolvedUserId;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, attendantCategory: true, isActive: true },
  });
  if (!targetUser) {
    return NextResponse.json({ error: "Attendant not found" }, { status: 404 });
  }

  const now = new Date();
  const url = new URL(req.url);
  const periodKeyParam = url.searchParams.get("periodKey");
  const period = parseTradingPeriodKey(periodKeyParam ?? undefined) ?? getTradingPeriodFor(now);

  const [summary, marketingSummary, supportSummary, ledger, payrollRow] = await Promise.all([
    getEarningsSummaryForUser({ userId, asOf: period.start }),
    summarizeMarketingReportsForPeriod({ userId, userEmail: targetUser?.email ?? null, period }),
    getSupportPeriodAggregates({ userId, period }),
    prisma.commissionLedger.findUnique({
      where: {
        userId_periodStart_periodEnd: {
          userId,
          periodStart: period.start,
          periodEnd: period.end,
        },
      },
    }),
    calculatePayrollForAttendant(targetUser, period),
  ]);
  const attendantCanonical = await getAttendantCommissionSummary({ attendantId: userId, start: period.start, end: period.end });
  // Merge per-receipt maps from marketing and support to expose canonical keys
  // for clients (dedupe helpers). POS totals and commission come from
  // `getEarningsSummaryForUser`, which now includes paid POS receipts.
  const marketingPer = (marketingSummary as any)?.perReceipts ?? {};
  const supportPer = (supportSummary as any)?.perReceipts ?? {};
  const merged = new Map<string, any>();
  for (const [k, v] of Object.entries(marketingPer) as [string, any][]) merged.set(k, v);
  for (const [k, v] of Object.entries(supportPer) as [string, any][]) {
    if (merged.has(k)) continue;
    merged.set(k, v);
  }

  const payload = {
    // expose canonical per-receipt keys for clients to dedupe local receipts
    perReceiptCanonicalKeys: Array.from(merged.keys()),
    ...summary,
    attendantCategory: payrollRow.attendantCategory,
    baseSalary: payrollRow.baseSalary,
    transportAllowance: payrollRow.transportAllowance,
    totalNewProducts: marketingSummary.totals.totalNewProducts,
    totalEditedProducts: marketingSummary.totals.totalEditedProducts,
    totalCopiedProducts: marketingSummary.totals.totalCopiedProducts,
    salesCommission: payrollRow.commissionDirect || payrollRow.commissionTotal,
    commissionDirect: payrollRow.commissionDirect,
    commissionMarketplaceJumia: payrollRow.commissionMarketplaceJumia,
    commissionMarketplaceKilimall: payrollRow.commissionMarketplaceKilimall,
    grossCommission: payrollRow.commissionGross,
    commission: payrollRow.commissionTotal,
    bonusTotal: payrollRow.totalAdditions,
    commissionTopUpTotal: payrollRow.totalAdditions,
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
    commissionBreakdown: attendantCanonical.breakdown ?? undefined,
    walkInsServed: marketingSummary.totals.walkInsServed,
    walkInsPurchased: marketingSummary.totals.walkInsPurchased,
    ledger: ledger
      ? {
          grossCommission: Number(ledger.grossCommission),
          netCommission: Number(ledger.netCommission),
          penalties: Number(ledger.penalties),
          detail: ledger.detail,
        }
      : null,
  };

  Object.assign(payload, {
    totalSales: attendantCanonical.totalSales, totalProfit: attendantCanonical.totalProfit,
    totalReceipts: attendantCanonical.receiptsCount, totalItems: attendantCanonical.totalItems,
    receiptBreakdown: attendantCanonical.receiptBreakdown,
    recordedSales: attendantCanonical.recordedSales, commissionEligibleSales: attendantCanonical.commissionEligibleSales,
  });
  return timing.finish(NextResponse.json(composeIdentityResponse(meta, payload)));
}
