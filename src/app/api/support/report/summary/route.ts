import { NextResponse } from "next/server";
import { getTradingPeriodFor } from "@/lib/tradingPeriod";
import { requireAttendant } from "@/lib/auth";
import { getSupportPeriodAggregates } from "@/lib/supportEntries";
import { getCommissionSummaryForSales } from "@/lib/marketingCommission";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await requireAttendant(req, ["SUPPORT_OPS", "ADMIN"]);
  if (!auth.ok) return auth.res;

  let basisDate = new Date();
  try {
    const url = new URL(req.url);
    const dateParam = url.searchParams.get("date");
    if (dateParam) {
      const parsed = new Date(dateParam);
      if (!Number.isNaN(parsed.getTime())) basisDate = parsed;
    }
  } catch {
    // ignore malformed URLs and fall back to current date
  }

  const period = getTradingPeriodFor(basisDate);
  const summary = await getSupportPeriodAggregates({ userId: auth.user.id, period });
  const aggregates = summary.aggregates;

  const commission = getCommissionSummaryForSales(aggregates.totalSales);

  return NextResponse.json({
    period: {
      key: period.key,
      label: period.label,
      start: period.start.toISOString(),
      end: period.end.toISOString(),
    },
    aggregates: {
      ...aggregates,
      batteryEarnings: (aggregates.newBatteries + aggregates.changedBatteries) * 70,
      commission: commission.commission,
      nextTarget: commission.nextTarget,
    },
  });
}
