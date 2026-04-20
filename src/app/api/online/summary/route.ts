import { NextResponse } from "next/server";
import { requireAttendant } from "@/lib/auth";
import { getAssignedMarketplaceSalesForPeriod, getMarketplaceAssignmentsForUser } from "@/lib/onlineOps";
import { prisma } from "@/lib/prisma";
import { getTradingPeriodFor, parseTradingPeriodKey } from "@/lib/tradingPeriod";
import { getOnlineOpsWindowForTradingPeriod } from "@/lib/onlineOpsWeeks";
import { getCommissionSummaryForSales } from "@/lib/marketingCommission";
import { getOrCreateCommissionPeriod } from "@/lib/commission";
import { composeIdentityResponse, resolveTargetUserId } from "@/lib/resolveTargetUser";
import { summarizePosReceiptsForPeriod } from "@/lib/posReceiptSummary";
import {
  computeOnlinePeriodCommission,
  resolveDirectCommissionMode,
  resolveOnlinePosOwnershipMode,
} from "@/lib/onlineCommission";

export const dynamic = "force-dynamic";

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
  const marketplaceWindow = getOnlineOpsWindowForTradingPeriod(period, period.end, 4);
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
    profitRecognitionMode: "salesDate",
  });

  const [{ assignments, accountIds }, marketplaceSalesSummary] = await Promise.all([
    getMarketplaceAssignmentsForUser(targetUserId),
    getAssignedMarketplaceSalesForPeriod(targetUserId, {
      key: marketplaceWindow.key,
      label: marketplaceWindow.label,
      start: marketplaceWindow.start,
      end: marketplaceWindow.end,
    }),
  ]);
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
        window: {
          key: marketplaceWindow.key,
          label: marketplaceWindow.label,
          start: marketplaceWindow.start.toISOString(),
          end: marketplaceWindow.end.toISOString(),
        },
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

  const platforms = Array.from(
    marketplaceSalesSummary.rows.reduce((map, row) => {
      const key = row.platform;
      const bucket = map.get(key) ?? {
        key,
        name: key,
        sales: 0,
        commission: 0,
        orders: 0,
      };
      bucket.sales += Number(row.sales ?? 0);
      bucket.orders += Number(row.orders ?? 0);
      map.set(key, bucket);
      return map;
    }, new Map<string, { key: string; name: string; sales: number; commission: number; orders: number }>()),
  ).map(([, value]) => value);

  const payoutSales = marketplaceSalesSummary.rows.reduce((sum, row) => sum + Number(row.payoutSales ?? 0), 0);
  const weeklyManualSales = marketplaceSalesSummary.rows.reduce((sum, row) => sum + Number(row.manualSales ?? 0), 0);
  const marketplaceSalesOnly = marketplaceSalesSummary.totals.sales;
  const commissionBreakdown = computeOnlinePeriodCommission(
    {
      attendantId: targetUserId,
      periodStart: start,
      periodEnd: end,
      directSales: Number(directPosSummary.totalSales ?? 0),
      directProfit: Number(directPosSummary.totalProfit ?? 0),
      jumiaSales: marketplaceSalesSummary.totals.jumiaSales,
      kilimallSales: marketplaceSalesSummary.totals.kilimallSales,
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
    totals: {
      orders: marketplaceSalesSummary.totals.orders,
      sales: marketplaceSalesSummary.totals.sales,
      commission: Number(commissionBreakdown.totalCommission ?? 0),
    },
    platforms,
    assignedAccounts: assignments.map((a) => ({ id: a.accountId, name: a.account?.displayName ?? null, platform: a.account?.platform })),
    marketplace: {
      jumiaSales: marketplaceSalesSummary.totals.jumiaSales,
      kilimallSales: marketplaceSalesSummary.totals.kilimallSales,
      payoutSales,
      weeklyManualSales,
      marketplaceSalesOnly,
      toNextTier,
      tierProgress,
      commissionInfo,
      window: {
        key: marketplaceWindow.key,
        label: marketplaceWindow.label,
        start: marketplaceWindow.start.toISOString(),
        end: marketplaceWindow.end.toISOString(),
      },
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
