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

  const [{ totals: marketingTotals }, supportSummary] = await Promise.all([
    summarizeMarketingReportsForPeriod({ userId: targetUserId, period: argPeriod }),
    getSupportPeriodAggregates({ userId: targetUserId, period: argPeriod }),
  ]);

  const supportTotals = supportSummary?.aggregates ?? {
    totalSales: 0,
    totalProfit: 0,
    totalReceipts: 0,
    totalItems: 0,
  };

  const totalSales = marketingTotals.totalSales + supportTotals.totalSales;
  const totalProfit = marketingTotals.totalProfit + supportTotals.totalProfit;
  const totalItems = marketingTotals.totalItems + supportTotals.totalItems;

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
      paymentStats: marketingTotals.paymentStats,
      commission: { commission },
    },
  });

  res.headers.set("Cache-Control", "no-store, no-cache, max-age=0, must-revalidate");
  return res;
}
