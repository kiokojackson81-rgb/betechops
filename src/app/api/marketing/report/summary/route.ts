import { NextResponse } from "next/server";
import { requireRole, getActorId } from "@/lib/api";
import { getTradingPeriodFor } from "@/lib/tradingPeriod";
import { getCurrentTradingPeriod } from "@/lib/marketingPeriod";
import { summarizeMarketingReportsForPeriod } from "@/lib/marketingPeriodTotals";
import { getSupportPeriodAggregates } from "@/lib/supportEntries";
import { getCommissionSummaryForSales } from "@/lib/marketingCommission";
import { getUnpricedDailySalesForCurrentPeriod } from "@/lib/marketingUnpricedSales";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await requireRole(["ADMIN", "SUPERVISOR", "ATTENDANT"]);
  if (!auth.ok) return auth.res;

  const url = new URL(req.url);
  const dateStr = url.searchParams.get("date");
  const impersonateId = url.searchParams.get("impersonateId");
  const actorId = await getActorId();
  const targetUserId = impersonateId && auth.role === "ADMIN" ? impersonateId : actorId;
  if (!targetUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const basisDate = dateStr ? new Date(dateStr) : null;
  const period = basisDate ? getTradingPeriodFor(basisDate) : await getCurrentTradingPeriod();

  // Normalize period for downstream libs when the shape may vary between
  // `tradingPeriod.ts` and `marketingPeriod.ts`. Use `any` to satisfy callers
  // that expect slightly different period types.
  const argPeriod: any = period as any;

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
  const totalReceipts = marketingTotals.totalReceipts + supportTotals.totalReceipts;

  const commissionInfo = getCommissionSummaryForSales(totalSales);
  let commission = commissionInfo.commission ?? 0;
  if (commission === 0 && totalSales > 0 && totalSales < 500_000) {
    commission = Math.round(Math.max(totalProfit, 0) * 0.05);
  }

  // If there are any unpriced sales for this attendant in the current
  // period, zero out commission until pricing is completed. This prevents
  // attendants from receiving commission computed from unpriced receipts.
  try {
    const user = await prisma.user.findUnique({ where: { id: targetUserId }, select: { email: true } });
    const userEmail = user?.email?.toLowerCase() ?? null;
    if (userEmail) {
      const unpriced = await getUnpricedDailySalesForCurrentPeriod();
      const hasUnpricedForUser = unpriced.some((s) => (s.attendantEmail ?? "").toLowerCase() === userEmail);
      if (hasUnpricedForUser) {
        commission = 0;
      }
    }
  } catch (e) {
    // If pricing check fails, do not block returning computed commission —
    // silently ignore and return the computed value.
  }

  // `period` can be the TradingPeriod from `tradingPeriod.ts` (has `start`/`end`)
  // or the one from `marketingPeriod.ts` (has `startDate`/`endDate`). Normalize here.
  let startDate: Date;
  let endDate: Date;
  if ("start" in period && "end" in period) {
    startDate = (period as any).start;
    endDate = (period as any).end;
  } else {
    startDate = (period as any).startDate;
    endDate = (period as any).endDate;
  }

  const normalizedPeriod = {
    key: String((period as any).key ?? ""),
    label: String((period as any).label ?? ""),
    start: startDate.toISOString(),
    end: endDate.toISOString(),
  };

  return NextResponse.json({
    period: normalizedPeriod,
    aggregates: {
      totalSales,
      totalProfit,
      totalItems,
      totalReceipts,
      paymentStats: marketingTotals.paymentStats,
      commission: { commission },
    },
  });
}
