import { NextResponse } from "next/server";
import { getEarningsSummaryForUser } from "@/lib/earningsSummary";
import { getTradingPeriodFor, parseTradingPeriodKey } from "@/lib/tradingPeriod";
import { summarizeMarketingReportsForPeriod } from "@/lib/marketingPeriodTotals";
import { getSupportPeriodAggregates } from "@/lib/supportEntries";
import { prisma } from "@/lib/prisma";
import { getOrCreateCommissionPeriod } from "@/lib/commission";
import { composeIdentityResponse, resolveTargetUserId } from "@/lib/resolveTargetUser";
import type { Role } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const identity = await resolveTargetUserId(req, { allowedImpersonationRoles: ["ADMIN" as Role] });
  const meta = identity;
  const userId = identity.resolvedUserId;
  if (!userId) {
    const r = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    r.headers.set("Cache-Control", "no-store, no-cache, max-age=0, must-revalidate");
    return r;
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });

  const now = new Date();
  const url = new URL(req.url);
  const periodKeyParam = url.searchParams.get("periodKey");
  const period = parseTradingPeriodKey(periodKeyParam ?? undefined) ?? getTradingPeriodFor(now);
  await getOrCreateCommissionPeriod(period.start);

  const [summary, marketingSummary, supportSummary, ledger] = await Promise.all([
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
    : summary.chamaTotal + summary.latenessTotal + summary.disciplineTotal + summary.otherDeductionsTotal;
  const netPay = usesSpecialComputedCommission
    ? Number(summary.netPay ?? 0)
    : totalEarnings - totalDeductions;

  const payload = {
    // expose canonical per-receipt keys for clients to dedupe local receipts
    perReceiptCanonicalKeys: Array.from(merged.keys()),
    ...summary,
    totalNewProducts: marketingSummary.totals.totalNewProducts,
    totalEditedProducts: marketingSummary.totals.totalEditedProducts,
    totalCopiedProducts: marketingSummary.totals.totalCopiedProducts,
    salesCommission,
    grossCommission,
    totalEarnings,
    totalDeductions,
    netPay,
    walkInsServed: marketingSummary.totals.walkInsServed,
    walkInsPurchased: marketingSummary.totals.walkInsPurchased,
    commission: grossCommission,
    ledger: ledger
      ? {
          grossCommission: Number(ledger.grossCommission),
          netCommission: Number(ledger.netCommission),
          penalties: Number(ledger.penalties),
          detail: ledger.detail,
        }
      : null,
  };

  const r = NextResponse.json(composeIdentityResponse(meta, payload));
  r.headers.set("Cache-Control", "no-store, no-cache, max-age=0, must-revalidate");
  return r;
}
