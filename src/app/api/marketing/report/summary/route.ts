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
      totalSales: aggregates.totalSales,
      totalItems: aggregates.totalItems,
      paymentStats: aggregates.paymentStats,
      commission: aggregates.commission,
    },
  });
}
