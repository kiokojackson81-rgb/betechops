import { NextResponse } from "next/server";
import { requireAttendant } from "@/lib/auth";
import { getMarketplaceAssignmentsForUser } from "@/lib/onlineOps";
import { prisma } from "@/lib/prisma";
import { getTradingPeriodFor, parseTradingPeriodKey } from "@/lib/tradingPeriod";
import { getCommissionSummaryForSales } from "@/lib/marketingCommission";
import { getOrCreateCommissionPeriod } from "@/lib/commission";
import { composeIdentityResponse, resolveTargetUserId } from "@/lib/resolveTargetUser";
import { recomputeWeeklySummary } from "../../../../lib/jobs/recomputeWeeklySummaries";
import { summarizePosReceiptsForPeriod } from "@/lib/posReceiptSummary";
import {
  computeOnlinePeriodCommission,
  resolveDirectCommissionMode,
  resolveOnlinePosOwnershipMode,
} from "@/lib/onlineCommission";

export const dynamic = "force-dynamic";

const parseDateParam = (value: string | null) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export async function GET(req: Request) {
  const auth = await requireAttendant(req, ["JUMIA_KILIMALL_OPS", "BETECH_OPS", "SUPERVISOR", "ADMIN"]);
  if (!auth.ok) return auth.res;

  const identity = await resolveTargetUserId(req);
  const meta = identity;
  const targetUserId = identity.resolvedUserId;
  if (!targetUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const targetUser = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { email: true },
  });

  const url = new URL(req.url);
  if (url.searchParams.has("start") || url.searchParams.has("end")) {
    return NextResponse.json({ error: "This endpoint requires a server-resolved trading period; do not supply start/end." }, { status: 400 });
  }
  const periodKeyParam = url.searchParams.get("periodKey");
  const requestedPeriod = parseTradingPeriodKey(periodKeyParam ?? undefined);
  const period = requestedPeriod ?? getTradingPeriodFor(new Date());
  await getOrCreateCommissionPeriod(period.start);
  const start = period.start;
  const end = period.end;
  const periodLabel = `${start.toLocaleDateString("en-KE", {
    day: "2-digit",
    month: "short",
  })} - ${end.toLocaleDateString("en-KE", { day: "2-digit", month: "short" })}`;
  const directPosSummary = await summarizePosReceiptsForPeriod({
    start,
    end,
    userId: targetUserId,
    ownershipMode: resolveOnlinePosOwnershipMode(targetUser?.email),
    supportPricingScope: "any",
  });

  const { assignments, accountIds } = await getMarketplaceAssignmentsForUser(targetUserId);
  if (!accountIds.length) {
    const emptyData = {
      period: { key: period.key, label: periodLabel, start: start.toISOString(), end: end.toISOString() },
      totals: { orders: 0, sales: 0, commission: 0, marketplaceSales: 0, remainingToNextTier: 2000000 },
      platforms: [],
      assignedAccounts: assignments.map((a) => ({ id: a.accountId, name: a.account?.displayName ?? null, platform: a.account?.platform })),
      marketplace: {
        jumiaSales: 0,
        kilimallSales: 0,
        payoutSales: 0,
        weeklyManualSales: 0,
        marketplaceSalesOnly: 0,
        toNextTier: 0,
        tierProgress: 0,
        commissionInfo: {},
      },
      directReceipts: {
        totalSales: Number(directPosSummary.totalSales ?? 0),
        totalProfit: Number(directPosSummary.totalProfit ?? 0),
        totalReceipts: Number(directPosSummary.totalReceipts ?? 0),
        totalItems: Number(directPosSummary.totalItems ?? 0),
      },
    };
    return NextResponse.json(composeIdentityResponse(meta, emptyData));
  }

  const accounts = await prisma.marketplaceAccount.findMany({
    where: { id: { in: accountIds } },
    select: { id: true, displayName: true, platform: true },
  });
  const accountMap = new Map(accounts.map((account) => [account.id, account]));

  const orders = await prisma.marketplaceOrder.findMany({
    where: {
      accountId: { in: accountIds },
      orderedAt: { gte: start, lte: end },
    },
    select: {
      accountId: true,
      sellingPrice: true,
      profit: true,
    },
  });

  const platformBuckets = new Map<
    string,
    { key: string; name: string; sales: number; commission: number; orders: number }
  >();
  let totalSales = 0;
  let totalCommission = 0;

  for (const order of orders) {
    const account = accountMap.get(order.accountId);
    const platformKey = (account?.platform ?? "UNKNOWN").toUpperCase();
    const bucket = platformBuckets.get(platformKey) ?? {
      key: platformKey,
      name: account?.displayName ?? platformKey,
      sales: 0,
      commission: 0,
      orders: 0,
    };
    const sales = Number(order.sellingPrice ?? 0);
    const commission = Number(order.profit ?? 0);
    bucket.sales += sales;
    bucket.commission += commission;
    bucket.orders += 1;
    platformBuckets.set(platformKey, bucket);
    totalSales += sales;
    totalCommission += commission;
  }

  const platforms = Array.from(platformBuckets.values());

  // Marketplace payout summaries can be useful for ops, but the attendant-facing
  // quick stats should reflect what has been recorded for the period (orders +
  // manual weekly entries). Keep payoutSales separate so it doesn't inflate
  // quick stats when no manual/order data has been captured.
  let payoutSales = 0;
  if (accountIds.length) {
    const aggs = await recomputeWeeklySummary(start, end);
    const filtered = aggs.filter((a) => accountIds.includes(a.accountId));
    payoutSales = filtered.reduce((s, a) => s + Number(a.totalGross ?? 0), 0);
  }

  const manualAgg = await prisma.weeklySale.groupBy({
    by: ["platform"],
    _sum: { amount: true },
    where: {
      userId: targetUserId,
      source: "MANUAL",
      status: { not: "REJECTED" },
      AND: [{ weekEnd: { gte: start } }, { weekStart: { lte: end } }],
    },
  });
  const manualJumiaSales = manualAgg
    .filter((r) => String(r.platform).toUpperCase() === "JUMIA")
    .reduce((s, r) => s + Number(r._sum?.amount ?? 0), 0);
  const manualKilimallSales = manualAgg
    .filter((r) => String(r.platform).toUpperCase() === "KILIMALL")
    .reduce((s, r) => s + Number(r._sum?.amount ?? 0), 0);
  const weeklyManualSales = manualJumiaSales + manualKilimallSales;

  const marketplaceSales = weeklyManualSales + platforms.reduce((s, p) => s + Number(p.sales || 0), 0);
  const totalSalesWithMarketplace = totalSales + weeklyManualSales;
  // marketplace-only sales (exclude direct/receipts) used to compute ladder progress
  const marketplaceSalesOnly = weeklyManualSales + platforms.reduce((s, p) => s + Number(p.sales || 0), 0);
  const commissionBreakdown = computeOnlinePeriodCommission(
    {
      attendantId: targetUserId,
      periodStart: start,
      periodEnd: end,
      directSales: Number(directPosSummary.totalSales ?? 0),
      directProfit: Number(directPosSummary.totalProfit ?? 0),
      jumiaSales:
        platforms
          .filter((p) => (p.key ?? "").toUpperCase().includes("JUMIA"))
          .reduce((s, p) => s + Number(p.sales || 0), 0) + manualJumiaSales,
      kilimallSales:
        platforms
          .filter((p) => (p.key ?? "").toUpperCase().includes("KILIMALL"))
          .reduce((s, p) => s + Number(p.sales || 0), 0) + manualKilimallSales,
    },
    { directCommissionMode: resolveDirectCommissionMode(targetUser?.email) },
  );
  const directCommission = Number(
    commissionBreakdown.lines.find((line) => line.channel === "DIRECT")?.commission ?? 0,
  );
  const marketplaceCommission = Number(
    commissionBreakdown.lines
      .filter((line) => line.channel === "JUMIA" || line.channel === "KILIMALL")
      .reduce((sum, line) => sum + Number(line.commission ?? 0), 0),
  );

  // commission summary for marketplace totals (used for "To next tier")
  const commissionInfo = getCommissionSummaryForSales(marketplaceSalesOnly);
  const nextTarget = commissionInfo.nextTarget ?? null;
  const toNextTier = nextTarget ? Math.max(0, nextTarget - marketplaceSalesOnly) : 0;
  const tierProgress = nextTarget ? Math.min(1, marketplaceSalesOnly / nextTarget) : 1;

  const data = {
    period: { key: period.key, label: periodLabel, start: start.toISOString(), end: end.toISOString() },
    totals: { orders: orders.length, sales: totalSales, commission: totalCommission },
    platforms,
    assignedAccounts: assignments.map((a) => ({ id: a.accountId, name: a.account?.displayName ?? null, platform: a.account?.platform })),
    marketplace: {
      jumiaSales: platforms
        .filter((p) => (p.key ?? "").toUpperCase().includes("JUMIA"))
        .reduce((s, p) => s + Number(p.sales || 0), 0) + manualJumiaSales,
      kilimallSales: platforms
        .filter((p) => (p.key ?? "").toUpperCase().includes("KILIMALL"))
        .reduce((s, p) => s + Number(p.sales || 0), 0) + manualKilimallSales,
      payoutSales,
      weeklyManualSales,
      marketplaceSalesOnly,
      toNextTier,
      tierProgress,
      commissionInfo,
    },
    directReceipts: {
      totalSales: Number(directPosSummary.totalSales ?? 0),
      totalProfit: Number(directPosSummary.totalProfit ?? 0),
      totalReceipts: Number(directPosSummary.totalReceipts ?? 0),
      totalItems: Number(directPosSummary.totalItems ?? 0),
    },
    commissions: {
      direct: directCommission,
      marketplaceCombined: marketplaceCommission,
      total: Number(commissionBreakdown.totalCommission ?? 0),
    },
  };

  return NextResponse.json(composeIdentityResponse(meta, data));
}
