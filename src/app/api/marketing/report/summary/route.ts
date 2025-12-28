import { NextResponse } from "next/server";
import { requireRole, getActorId } from "@/lib/api";
import { getTradingPeriodFor } from "@/lib/tradingPeriod";
import { getCurrentTradingPeriodFor } from "@/lib/marketingPeriod";
import { summarizeMarketingReportsForPeriod } from "@/lib/marketingPeriodTotals";
import { getSupportPeriodAggregates } from "@/lib/supportEntries";
import { getCommissionSummaryForSales } from "@/lib/marketingCommission";
import { getUnpricedDailySalesForCurrentPeriod } from "@/lib/marketingUnpricedSales";
import { getOrCreateCommissionPeriod } from "@/lib/commission";
import { prisma } from "@/lib/prisma";
import { nowInNairobi } from "@/lib/timezone";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await requireRole(["ADMIN", "SUPERVISOR", "ATTENDANT"]);
  if (!auth.ok) return auth.res;

  const url = new URL(req.url);
  const impersonateId = url.searchParams.get("impersonateId");
  const actorId = await getActorId();
  const targetUserId =
    impersonateId && auth.role === "ADMIN" ? impersonateId : actorId;
  if (!targetUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = nowInNairobi();
  await getOrCreateCommissionPeriod(today);
  const current = await getCurrentTradingPeriodFor(today);

  let argPeriod: {
    start: Date;
    end: Date;
    key: string;
    label: string;
  } = {
    start: current.startDate,
    end: current.endDate,
    key: current.key,
    label: current.label,
  };

  if (!(today >= argPeriod.start && today <= argPeriod.end)) {
    const fallback = getTradingPeriodFor(today);
    argPeriod = {
      start: fallback.start,
      end: fallback.end,
      key: fallback.key,
      label: fallback.label,
    };
  }

  const [marketingSummary, supportSummary] = await Promise.all([
    summarizeMarketingReportsForPeriod({ userId: targetUserId, period: argPeriod }),
    getSupportPeriodAggregates({ userId: targetUserId, period: argPeriod }),
  ]);

  const marketingTotals = marketingSummary?.totals ?? {
    totalSales: 0,
    totalProfit: 0,
    totalReceipts: 0,
    totalItems: 0,
    totalNewProducts: 0,
    totalEditedProducts: 0,
    totalCopiedProducts: 0,
    walkInsServed: 0,
    walkInsPurchased: 0,
    paymentStats: { totalSalesMpesa: 0, totalSalesCash: 0, countMpesaReceipts: 0, countCashReceipts: 0 },
  };

  const supportAggregates = supportSummary?.aggregates ?? {
    totalSales: 0,
    totalProfit: 0,
    totalReceipts: 0,
    totalItems: 0,
    newBatteries: 0,
    changedBatteries: 0,
    paymentStats: { totalSalesMpesa: 0, totalSalesCash: 0, countMpesaReceipts: 0, countCashReceipts: 0 },
  };

  // per-receipt maps returned by the summarizers (keyed by canonical receipt id)
  const marketingPer = (marketingSummary as any)?.perReceipts ?? {};
  const supportPer = (supportSummary as any)?.perReceipts ?? {};

  // Merge with precedence: MARKETING > SUPPORT
  const merged = new Map<string, { sales: number; profit: number; items: number; mpesa: number; cash: number }>();

  for (const [k, v] of Object.entries(marketingPer) as [string, any][]) {
    merged.set(k, { sales: v.sales ?? 0, profit: v.profit ?? 0, items: v.items ?? 0, mpesa: v.mpesa ?? 0, cash: v.cash ?? 0 });
  }

  for (const [k, v] of Object.entries(supportPer) as [string, any][]) {
    if (merged.has(k)) continue; // marketing wins
    merged.set(k, { sales: v.sales ?? 0, profit: v.profit ?? 0, items: v.items ?? 0, mpesa: v.mpesa ?? 0, cash: v.cash ?? 0 });
  }

  // compute merged totals
  let totalSales = 0;
  let totalProfit = 0;
  let totalItems = 0;
  const mergedPaymentStats = { totalSalesMpesa: 0, totalSalesCash: 0, countMpesaReceipts: 0, countCashReceipts: 0 };

  for (const [, v] of merged) {
    totalSales += v.sales;
    totalProfit += v.profit;
    totalItems += v.items;
    mergedPaymentStats.totalSalesMpesa += v.mpesa;
    mergedPaymentStats.totalSalesCash += v.cash;
    if (v.mpesa > 0) mergedPaymentStats.countMpesaReceipts += 1;
    if (v.cash > 0) mergedPaymentStats.countCashReceipts += 1;
  }

  let commission = 0;
  if (totalProfit > 0) {
    const commissionInfo = getCommissionSummaryForSales(totalSales);
    commission = commissionInfo.commission ?? 0;
    if (commission === 0 && totalSales > 0 && totalSales < 500_000) {
      commission = Math.round(Math.max(totalProfit, 0) * 0.05);
    }
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { email: true },
    });
    const userEmail = user?.email?.toLowerCase() ?? null;
    if (userEmail) {
      const unpriced = await getUnpricedDailySalesForCurrentPeriod();
      const hasUnpricedForUser = unpriced.some(
        (s) => (s.attendantEmail ?? "").toLowerCase() === userEmail,
      );
      if (hasUnpricedForUser) {
        commission = 0;
      }
    }
  } catch {
    // ignore
  }

  try {
    const ledger = await prisma.commissionLedger.findUnique({
      where: {
        userId_periodStart_periodEnd: {
          userId: targetUserId,
          periodStart: argPeriod.start,
          periodEnd: argPeriod.end,
        },
      },
    });

    if (ledger) {
      const detail: any = ledger.detail ?? {};
      const marketingCommission = Number(detail.marketing?.commission ?? 0);
      const supportCommission = Number(detail.support?.commission ?? 0);
      const combinedDetailCommission = marketingCommission + supportCommission;

      if (combinedDetailCommission > 0) {
        commission = combinedDetailCommission;
      } else {
        const ledgerNet = Number(
          ledger.netCommission ?? ledger.grossCommission ?? commission,
        );
        commission = Number.isFinite(ledgerNet) ? ledgerNet : commission;
      }
    }
  } catch {
    // ignore
  }

  const res = NextResponse.json({
    period: {
      key: String(argPeriod.key ?? ""),
      label: String(argPeriod.label ?? ""),
      start: argPeriod.start.toISOString(),
      end: argPeriod.end.toISOString(),
    },
    aggregates: {
      totalSales,
      totalItems,
      paymentStats: mergedPaymentStats,
      commission: { commission },
    },
  });

  res.headers.set("Cache-Control", "no-store, no-cache, max-age=0, must-revalidate");
  return res;
}
