import { NextResponse } from "next/server";
import { getTradingPeriodFor } from "@/lib/tradingPeriod";
import { requireAttendant } from "@/lib/auth";
import { getSupportPeriodAggregates } from "@/lib/supportEntries";
import { getOrCreateCommissionPeriod } from "@/lib/commission";
import getAttendantCommissionSummary from "@/lib/attendantCommission";

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

  await getOrCreateCommissionPeriod(basisDate);
  const period = getTradingPeriodFor(basisDate);

  const summary = await getSupportPeriodAggregates({ userId: auth.user.id, period });
  const aggregates = summary.aggregates;

  const attendantSummary = await getAttendantCommissionSummary({ attendantId: auth.user.id, start: period.start, end: period.end });

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
      commission: attendantSummary.totalCommission,
      nextTarget: null,
      commissionBreakdown: attendantSummary.breakdown ?? undefined,
    },
  });
}
