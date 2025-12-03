import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api";
import { getTradingPeriodFor } from "@/lib/tradingPeriod";
import { getCurrentTradingPeriod } from "@/lib/marketingPeriod";
import { getMarketingReport } from "@/lib/marketingReport";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await requireRole(["ADMIN", "SUPERVISOR", "ATTENDANT"]);
  if (!auth.ok) return auth.res;

  const url = new URL(req.url);
  const dateStr = url.searchParams.get("date");
  const basisDate = dateStr ? new Date(dateStr) : null;
  const period = basisDate ? getTradingPeriodFor(basisDate) : await getCurrentTradingPeriod();

  const { aggregates } = await getMarketingReport({ tradingPeriodKey: period.key });

  return NextResponse.json({
    period: { key: period.key, label: period.label, start: period.start.toISOString(), end: period.end.toISOString() },
    aggregates: {
      totalSales: aggregates.totalSales,
      totalItems: aggregates.totalItems,
      paymentStats: aggregates.paymentStats,
      commission: aggregates.commission,
    },
  });
}
