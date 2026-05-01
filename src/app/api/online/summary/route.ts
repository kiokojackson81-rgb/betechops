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

const normalizeReceiptNumber = (input: unknown) => {
  if (input == null) return "";
  return String(input).trim().toUpperCase().replace(/[\s\-_]+/g, "").replace(/[^A-Z0-9]/g, "");
};

const extractReceiptSales = (receipt: {
  totals?: Record<string, unknown> | null;
  data?: Record<string, unknown> | null;
  order?: { totalAmount?: number | null } | null;
}) => {
  const totals = receipt.totals ?? {};
  const data = receipt.data ?? {};
  const candidates = [
    totals.total,
    totals.sellingTotal,
    totals.grandTotal,
    totals.amount,
    totals.subtotal,
    data.total,
    data.amount,
    receipt.order?.totalAmount,
  ];
  for (const value of candidates) {
    const num = Number(value ?? 0);
    if (Number.isFinite(num) && num > 0) return num;
  }
  return 0;
};

async function computeProfit10DirectProfitFallback(args: {
  userId: string;
  start: Date;
  end: Date;
}) {
  const receipts = await prisma.receipt.findMany({
    where: {
      AND: [
        {
          OR: [
            { generatedAt: { gte: args.start, lte: args.end } },
            { createdAt: { gte: args.start, lte: args.end } },
          ],
        },
        { issuedById: args.userId },
      ],
    },
    select: {
      receiptNumber: true,
      generatedAt: true,
      createdAt: true,
      totals: true,
      data: true,
      order: {
        select: {
          orderNumber: true,
          paymentStatus: true,
          totalAmount: true,
          attendantId: true,
        },
      },
    },
  });

  const paidReceipts = receipts.filter((receipt) => {
    const paymentStatus = String(receipt.order?.paymentStatus ?? "").trim().toUpperCase();
    return paymentStatus === "PAID";
  });

  const receiptMeta = paidReceipts.map((receipt) => {
    const salesDate = receipt.generatedAt ?? receipt.createdAt ?? args.start;
    const canonical =
      normalizeReceiptNumber(receipt.order?.orderNumber) ||
      normalizeReceiptNumber(receipt.receiptNumber) ||
      normalizeReceiptNumber((receipt.data as Record<string, unknown> | null)?.orderRef);
    const ymd = salesDate.toISOString().slice(0, 10);
    return {
      canonical,
      receiptKey: canonical ? `${ymd}:${canonical}` : "",
      sales: extractReceiptSales(receipt as any),
    };
  });

  const canonicalNumbers = Array.from(new Set(receiptMeta.map((item) => item.canonical).filter(Boolean)));
  const receiptKeys = Array.from(new Set(receiptMeta.map((item) => item.receiptKey).filter(Boolean)));
  if (!canonicalNumbers.length && !receiptKeys.length) return 0;

  const supportReceipts = await prisma.supportReceipt.findMany({
    where: {
      OR: [
        ...(canonicalNumbers.length ? [{ receiptNumber: { in: canonicalNumbers } }] : []),
        ...(receiptKeys.length ? [{ receiptKey: { in: receiptKeys } }] : []),
      ],
    },
    select: {
      receiptNumber: true,
      receiptKey: true,
      buyingTotal: true,
      items: {
        select: {
          buyingPrice: true,
        },
      },
    },
  });

  const buyingByCanonical = new Map<string, number>();
  for (const row of supportReceipts) {
    const itemBuyingTotal = Array.isArray(row.items)
      ? row.items.reduce((sum, item) => sum + Number(item.buyingPrice ?? 0), 0)
      : 0;
    const buyingTotal = Math.max(Number(row.buyingTotal ?? 0), itemBuyingTotal);
    if (!(buyingTotal > 0)) continue;
    const keys = [
      normalizeReceiptNumber(row.receiptNumber),
      normalizeReceiptNumber(row.receiptKey),
      normalizeReceiptNumber(String(row.receiptKey ?? "").split(":").pop() ?? ""),
    ].filter(Boolean);
    for (const key of keys) {
      if (!buyingByCanonical.has(key)) buyingByCanonical.set(key, buyingTotal);
    }
  }

  return receiptMeta.reduce((sum, receipt) => {
    if (!receipt.canonical || receipt.sales <= 0) return sum;
    const buyingTotal = Number(buyingByCanonical.get(receipt.canonical) ?? 0);
    if (!(buyingTotal > 0)) return sum;
    return sum + (receipt.sales - buyingTotal);
  }, 0);
}

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
    return NextResponse.json(
      { error: "This endpoint requires a server-resolved trading period; do not supply start/end." },
      { status: 400 },
    );
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
  const directCommissionMode = resolveDirectCommissionMode(targetUser?.email);
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
      assignedAccounts: assignments.map((a) => ({
        id: a.accountId,
        name: a.account?.displayName ?? null,
        platform: a.account?.platform,
      })),
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
  const fallbackDirectProfit =
    directCommissionMode === "PROFIT_10" &&
    Number(directPosSummary.totalSales ?? 0) > 0 &&
    Number(directPosSummary.totalProfit ?? 0) <= 0
      ? await computeProfit10DirectProfitFallback({ userId: targetUserId, start, end })
      : 0;
  const effectiveDirectProfit =
    directCommissionMode === "PROFIT_10" && fallbackDirectProfit > 0
      ? fallbackDirectProfit
      : Number(directPosSummary.totalProfit ?? 0);

  const commissionBreakdown = computeOnlinePeriodCommission(
    {
      attendantId: targetUserId,
      periodStart: start,
      periodEnd: end,
      directSales: Number(directPosSummary.totalSales ?? 0),
      directProfit: effectiveDirectProfit,
      jumiaSales: marketplaceSalesSummary.totals.jumiaSales,
      kilimallSales: marketplaceSalesSummary.totals.kilimallSales,
    },
    { directCommissionMode },
  );
  const directCommission = Number(
    commissionBreakdown.lines.find((line) => line.channel === "DIRECT")?.commission ?? 0,
  );
  const marketplaceCommission = Number(
    commissionBreakdown.lines
      .filter((line) => line.channel === "JUMIA" || line.channel === "KILIMALL")
      .reduce((sum, line) => sum + Number(line.commission ?? 0), 0),
  );

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
    assignedAccounts: assignments.map((a) => ({
      id: a.accountId,
      name: a.account?.displayName ?? null,
      platform: a.account?.platform,
    })),
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
      totalProfit: effectiveDirectProfit,
      totalReceipts: Number(directPosSummary.totalReceipts ?? 0),
      totalItems: Number(directPosSummary.totalItems ?? 0),
    },
    commissions: {
      direct: directCommission,
      marketplaceCombined: marketplaceCommission,
      total: Number(commissionBreakdown.totalCommission ?? 0),
      directCommissionMode,
    },
  };

  return NextResponse.json(composeIdentityResponse(meta, data));
}
