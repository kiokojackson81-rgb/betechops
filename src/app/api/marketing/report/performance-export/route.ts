import { requireRole, getActorId } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { getTradingPeriodFor, parseTradingPeriodKey } from "@/lib/tradingPeriod";
import { getCurrentTradingPeriodFor } from "@/lib/marketingPeriod";
import { summarizeMarketingReportsForPeriod } from "@/lib/marketingPeriodTotals";
import { getSupportPeriodAggregates } from "@/lib/supportEntries";
import { nowInNairobi } from "@/lib/timezone";
import { getUserCommissionConfigLike } from "@/lib/userCommissionConfig";
import { summarizePosReceiptsForPeriod } from "@/lib/posReceiptSummary";
import {
  computeJenifferProratedCommission,
  computeSalesCommissionFromTiers,
  getOrCreateCommissionPeriod,
} from "@/lib/commission";
import { computeBrendahDirectCommission } from "@/lib/onlineCommission";
import { getUnpricedDailySalesForCurrentPeriod } from "@/lib/marketingUnpricedSales";

export const dynamic = "force-dynamic";

const quote = (s: unknown) => `"${String(s ?? "").replace(/"/g, '""')}"`;

function sanitizeFilename(value: string) {
  return value
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

export async function GET(req: Request) {
  const auth = await requireRole(["ADMIN", "SUPERVISOR", "ATTENDANT"]);
  if (!auth.ok) return auth.res;

  const url = new URL(req.url);
  const impersonateId = url.searchParams.get("impersonateId");
  const periodKeyParam = url.searchParams.get("periodKey") || url.searchParams.get("period");
  const requestedPeriod = parseTradingPeriodKey(periodKeyParam ?? undefined);

  const actorId = await getActorId();
  const targetUserId = impersonateId && auth.role === "ADMIN" ? impersonateId : actorId;
  if (!targetUserId) return new Response("Unauthorized", { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, name: true, email: true, attendantCategory: true },
  });
  if (!user) return new Response("User not found", { status: 404 });

  const commissionConfig = await getUserCommissionConfigLike(targetUserId);
  const usePosTotals = commissionConfig.posTotalsMode !== "NONE";
  const isBrendah = commissionConfig.salesCommissionMode === "BRENDAH_DIRECT";
  const isJeniffer = commissionConfig.salesCommissionMode === "JENIFFER_PRORATED";

  const today = nowInNairobi();
  const { tiers } = await getOrCreateCommissionPeriod(today);
  const current = await getCurrentTradingPeriodFor(today);

  let period: { start: Date; end: Date; key: string; label: string } = requestedPeriod
    ? {
        start: requestedPeriod.start,
        end: requestedPeriod.end,
        key: requestedPeriod.key,
        label: requestedPeriod.label,
      }
    : {
        start: current.startDate,
        end: current.endDate,
        key: current.key,
        label: current.label,
      };

  if (!requestedPeriod && !(today >= period.start && today <= period.end)) {
    const fallback = getTradingPeriodFor(today);
    period = { start: fallback.start, end: fallback.end, key: fallback.key, label: fallback.label };
  }

  const [marketingSummary, supportSummary] = await Promise.all([
    summarizeMarketingReportsForPeriod({
      userId: targetUserId,
      userEmail: (user.email ?? "").toLowerCase().trim() || null,
      period,
    }),
    getSupportPeriodAggregates({ userId: targetUserId, period }),
  ]);

  const marketingPer = (marketingSummary as any)?.perReceipts ?? {};
  const supportPer = (supportSummary as any)?.perReceipts ?? {};

  const merged = new Map<string, { sales: number; profit: number; items: number; mpesa: number; cash: number }>();
  for (const [k, v] of Object.entries(marketingPer) as [string, any][]) {
    merged.set(k, { sales: v.sales ?? 0, profit: v.profit ?? 0, items: v.items ?? 0, mpesa: v.mpesa ?? 0, cash: v.cash ?? 0 });
  }
  for (const [k, v] of Object.entries(supportPer) as [string, any][]) {
    const supportObj = { sales: v.sales ?? 0, profit: v.profit ?? 0, items: v.items ?? 0, mpesa: v.mpesa ?? 0, cash: v.cash ?? 0 };
    if (merged.has(k)) {
      const existing = merged.get(k)!;
      if ((existing.profit ?? 0) <= 0 && (supportObj.profit ?? 0) > 0) {
        merged.set(k, supportObj);
      }
      continue;
    }
    merged.set(k, supportObj);
  }

  let mergedSales = 0;
  let mergedProfit = 0;
  let mergedItems = 0;
  const mergedStats = { totalSalesMpesa: 0, totalSalesCash: 0, countMpesaReceipts: 0, countCashReceipts: 0 };
  for (const [, v] of merged) {
    mergedSales += v.sales;
    mergedProfit += v.profit;
    mergedItems += v.items;
    mergedStats.totalSalesMpesa += v.mpesa;
    mergedStats.totalSalesCash += v.cash;
    if (v.mpesa > 0) mergedStats.countMpesaReceipts += 1;
    if (v.cash > 0) mergedStats.countCashReceipts += 1;
  }
  const mergedReceipts = merged.size;

  let totalSales = mergedSales;
  let totalProfit = mergedProfit;
  let totalItems = mergedItems;
  let totalReceipts = mergedReceipts;
  let paymentStats = mergedStats;

  let posSummary: Awaited<ReturnType<typeof summarizePosReceiptsForPeriod>> | null = null;
  if (usePosTotals) {
    const posUserId = commissionConfig.posTotalsMode === "GLOBAL" ? null : targetUserId;
    posSummary = await summarizePosReceiptsForPeriod({
      start: period.start,
      end: period.end,
      userId: posUserId,
    });

    totalSales = posSummary.totalSales;
    totalProfit = posSummary.totalProfit;
    totalItems = posSummary.totalItems;
    totalReceipts = posSummary.totalReceipts;
    paymentStats = posSummary.paymentStats as any;
  }

  let commission = 0;
  if (usePosTotals && posSummary) {
    if (isBrendah) {
      commission = computeBrendahDirectCommission(posSummary.totalSales, posSummary.totalProfit).amount;
    } else if (isJeniffer) {
      const res = computeJenifferProratedCommission(
        posSummary.totalSales,
        tiers.map((t: any) => ({
          minSales: Number(t.minSales),
          maxSales: t.maxSales == null ? null : Number(t.maxSales),
          payoutFlat: Number(t.payoutFlat),
        })),
      );
      commission = Math.round(Number(res.commission ?? 0));
    } else {
      const fallbackPercent = posSummary.totalProfit > 0 ? 0.05 : 0;
      commission = Math.round(computeSalesCommissionFromTiers(posSummary.totalSales, posSummary.totalProfit, tiers as any, fallbackPercent));
    }
  } else if (totalSales > 0) {
    commission = isBrendah
      ? computeBrendahDirectCommission(totalSales, totalProfit).amount
      : Math.round(computeSalesCommissionFromTiers(totalSales, totalProfit, tiers as any));
  }

  try {
    if (!usePosTotals && user.email) {
      const unpriced = await getUnpricedDailySalesForCurrentPeriod();
      const hasUnpricedForUser = unpriced.some(
        (s) => (s.attendantEmail ?? "").toLowerCase() === user.email!.toLowerCase(),
      );
      if (hasUnpricedForUser) {
        commission = 0;
      }
    }
  } catch {
    // ignore
  }

  const generatedAt = new Date().toISOString();
  const header = [
    "GeneratedAtISO",
    "PeriodKey",
    "PeriodLabel",
    "PeriodStartISO",
    "PeriodEndISO",
    "UserId",
    "AttendantName",
    "AttendantEmail",
    "PosTotalsMode",
    "SalesCommissionMode",
    "TotalSalesKES",
    "TotalProfitKES",
    "TotalReceipts",
    "TotalItems",
    "MpesaSalesKES",
    "CashSalesKES",
    "CommissionKES",
  ];

  const row = [
    generatedAt,
    period.key,
    period.label,
    period.start.toISOString(),
    period.end.toISOString(),
    user.id,
    user.name ?? "",
    user.email ?? "",
    commissionConfig.posTotalsMode,
    commissionConfig.salesCommissionMode,
    Math.round(Number(totalSales ?? 0)),
    Math.round(Number(totalProfit ?? 0)),
    Math.round(Number(totalReceipts ?? 0)),
    Math.round(Number(totalItems ?? 0)),
    Math.round(Number(paymentStats?.totalSalesMpesa ?? 0)),
    Math.round(Number(paymentStats?.totalSalesCash ?? 0)),
    Math.round(Number(commission ?? 0)),
  ];

  const csv = [header.map(quote).join(","), row.map(quote).join(",")].join("\n");
  const filename = sanitizeFilename(
    `performance-${(user.email ?? user.id).toString()}-${period.key || "period"}.csv`,
  );
  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

