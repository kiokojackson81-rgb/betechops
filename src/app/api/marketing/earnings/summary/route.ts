import { NextResponse } from "next/server";
import { requireRole, getActorId } from "@/lib/api";
import { getTradingPeriodFor } from "@/lib/tradingPeriod";
import { getEarningsSummaryForAttendant } from "@/lib/marketingEarnings";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await requireRole(["ADMIN", "SUPERVISOR", "ATTENDANT"]);
  if (!auth.ok) return auth.res;

  const url = new URL(req.url);
  const impersonate = url.searchParams.get("impersonateId") || url.searchParams.get("attendantId");

  let attendantId: string | null = null;
  try {
    if (impersonate && auth.role === "ADMIN") {
      attendantId = impersonate;
    } else {
      attendantId = await getActorId();
    }
  } catch (e) {
    attendantId = await getActorId();
  }

  if (!attendantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const period = getTradingPeriodFor(new Date());
  // allow callers to specify a periodKey/periodLabel so earnings can be
  // calculated for arbitrary periods (useful for admin impersonation/tests)
  const urlObj = new URL(req.url);
  const periodKeyParam = urlObj.searchParams.get("periodKey");
  const periodLabelParam = urlObj.searchParams.get("periodLabel");

  const periodKey = periodKeyParam ?? period.key;
  const periodLabel = periodLabelParam ?? period.label;

  try {
    const summary = await getEarningsSummaryForAttendant({ attendantId, periodKey, periodLabel });
    return NextResponse.json({ periodKey, periodLabel, summary });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to compute earnings";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
