import { NextResponse } from "next/server";
import { getEarningsSummaryForUser } from "@/lib/earningsSummary";
import { getTradingPeriodFor, parseTradingPeriodKey } from "@/lib/tradingPeriod";
import { summarizeMarketingReportsForPeriod } from "@/lib/marketingPeriodTotals";
import { getSupportPeriodAggregates } from "@/lib/supportEntries";
import { prisma } from "@/lib/prisma";
import { getOrCreateCommissionPeriod } from "@/lib/commission";
import { composeIdentityResponse, resolveTargetUserId } from "@/lib/resolveTargetUser";
import type { Role } from "@prisma/client";
import { summarizePosReceiptsForPeriod } from "@/lib/posReceiptSummary";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const identity = await resolveTargetUserId(req, { allowedImpersonationRoles: ["ADMIN" as Role] });
  const meta = identity;
  const userId = identity.resolvedUserId;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const url = new URL(req.url);
  const periodKeyParam = url.searchParams.get("periodKey");
  const period = parseTradingPeriodKey(periodKeyParam ?? undefined) ?? getTradingPeriodFor(now);
  await getOrCreateCommissionPeriod(period.start);

  const summary = await getEarningsSummaryForUser({ userId, asOf: period.start });

  // Best-effort: expose canonical per-receipt keys so clients can dedupe local receipts.
  // For Brendah/Jeniffer/DIRECT_SALES_OPS (POS source-of-truth), use POS receipt keys.
  // Otherwise, fall back to marketing+support per-receipt keys.
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, attendantCategory: true },
  });
  const normalizedEmail = (user?.email ?? "").toLowerCase().trim();
  const usePosTotals =
    normalizedEmail === "jeniffer@betech.co.ke" ||
    normalizedEmail === "brendah@betech.co.ke" ||
    user?.attendantCategory === "DIRECT_SALES_OPS";

  let perReceiptCanonicalKeys: string[] = [];
  if (usePosTotals) {
    const pos = await summarizePosReceiptsForPeriod({ start: period.start, end: period.end, userId });
    perReceiptCanonicalKeys = pos.receiptKeys ?? [];
  } else {
    const [marketingSummary, supportSummary] = await Promise.all([
      summarizeMarketingReportsForPeriod({ userId, userEmail: identity.actorEmail, period }),
      getSupportPeriodAggregates({ userId, period }),
    ]);
    const marketingPer = (marketingSummary as any)?.perReceipts ?? {};
    const supportPer = (supportSummary as any)?.perReceipts ?? {};
    const merged = new Map<string, unknown>();

    for (const k of Object.keys(marketingPer)) merged.set(k, true);
    for (const k of Object.keys(supportPer)) {
      if (!merged.has(k)) merged.set(k, true);
    }
    perReceiptCanonicalKeys = Array.from(merged.keys());
  }

  const payload = {
    perReceiptCanonicalKeys,
    ...summary,
  };

  return NextResponse.json(composeIdentityResponse(meta, payload));
}
