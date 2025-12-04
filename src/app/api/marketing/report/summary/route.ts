import { NextResponse } from "next/server";
import { requireRole, getActorId } from "@/lib/api";
import { getTradingPeriodFor } from "@/lib/tradingPeriod";
import { getCurrentTradingPeriod } from "@/lib/marketingPeriod";
import { summarizeMarketingReportsForPeriod } from "@/lib/marketingPeriodTotals";
import { getSupportPeriodAggregates } from "@/lib/supportEntries";
import { getCommissionSummaryForSales } from "@/lib/marketingCommission";

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

  const [{ totals: marketingTotals }, supportSummary] = await Promise.all([
    summarizeMarketingReportsForPeriod({ userId: targetUserId, period }),
    getSupportPeriodAggregates({ userId: targetUserId, period }),
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

  return NextResponse.json({
    period: { key: period.key, label: period.label, start: startDate.toISOString(), end: endDate.toISOString() },
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
