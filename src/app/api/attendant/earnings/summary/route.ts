import { NextResponse } from "next/server";
import { getEarningsSummaryForUser } from "@/lib/earningsSummary";
import { getTradingPeriodFor, parseTradingPeriodKey } from "@/lib/tradingPeriod";
import { summarizeMarketingReportsForPeriod } from "@/lib/marketingPeriodTotals";
import { getSupportPeriodAggregates } from "@/lib/supportEntries";
import { prisma } from "@/lib/prisma";
import { getOrCreateCommissionPeriod } from "@/lib/commission";
import { composeIdentityResponse, resolveTargetUserId } from "@/lib/resolveTargetUser";
import type { Role } from "@prisma/client";
import { buildPayrollRow } from "@/lib/adminPayroll";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
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
  await getOrCreateCommissionPeriod(period.start);

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
    buildPayrollRow(targetUser, period),
  ]);
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

  const detail = ledger?.detail as Record<string, any> | undefined;
  const marketingCommission = detail && typeof detail === "object" ? Number(detail.marketing?.commission ?? 0) : 0;
  const supportCommission = detail && typeof detail === "object" ? Number(detail.support?.commission ?? 0) : 0;
  const normalizedEmail =
    (summary.attendantEmail ?? targetUser?.email ?? "").toLowerCase().trim();
  const usesSpecialComputedCommission =
    normalizedEmail === "brendah@betech.co.ke" || normalizedEmail === "jeniffer@betech.co.ke";

  let salesCommission = Number(summary.salesCommission ?? 0);
  const ledgerPersisted = Number((ledger as any)?.commissionTotal ?? (ledger as any)?.commission_total ?? 0);
  if (!usesSpecialComputedCommission) {
    salesCommission = marketingCommission + supportCommission;
    if (ledgerPersisted > 0) {
      salesCommission = ledgerPersisted;
    } else {
      if (salesCommission === 0 && ledger) {
        salesCommission = Number(ledger.grossCommission ?? 0);
      }
      if (salesCommission === 0) {
        salesCommission = summary.salesCommission;
      }
    }
  }

  const grossCommission = usesSpecialComputedCommission
    ? Number(summary.grossCommission ?? salesCommission)
    : ledgerPersisted > 0
      ? ledgerPersisted
      : salesCommission + summary.newProductCommission + summary.copiedCommission + summary.editedCommission + summary.commissionTopUpTotal;

  const totalEarnings = usesSpecialComputedCommission
    ? Number(summary.totalEarnings ?? 0)
    : summary.baseSalary + summary.transportAllowance + grossCommission + summary.bonusTotal;
  const totalDeductions = usesSpecialComputedCommission
    ? Number(summary.totalDeductions ?? 0)
    : summary.chamaTotal +
      summary.latenessTotal +
      summary.disciplineTotal +
      summary.otherDeductionsTotal +
      Number(summary.cashAdvanceTotal ?? 0);
  const netPay = usesSpecialComputedCommission
    ? Number(summary.netPay ?? 0)
    : totalEarnings - totalDeductions;

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
    bonusTotal: payrollRow.adjustmentBreakdown.bonus,
    commissionTopUpTotal: payrollRow.adjustmentBreakdown.commissionTopUp,
    chamaTotal: payrollRow.adjustmentBreakdown.chama,
    latenessTotal: payrollRow.adjustmentBreakdown.lateness,
    disciplineTotal: payrollRow.adjustmentBreakdown.discipline,
    otherDeductionsTotal: payrollRow.adjustmentBreakdown.other,
    cashAdvanceTotal: payrollRow.adjustmentBreakdown.cashAdvance,
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

  return NextResponse.json(composeIdentityResponse(meta, payload));
}
