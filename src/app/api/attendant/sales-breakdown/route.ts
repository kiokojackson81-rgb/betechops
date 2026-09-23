import { NextResponse } from "next/server";
import { resolveTargetUserId } from "@/lib/resolveTargetUser";
import { getAttendantCommissionSummary } from "@/lib/attendantCommission";
import { getTradingPeriodFor, parseTradingPeriodKey } from "@/lib/tradingPeriod";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const identity = await resolveTargetUserId(req, { allowedImpersonationRoles: ["ADMIN"] });
  if (!identity.resolvedUserId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const key = new URL(req.url).searchParams.get("periodKey");
  const period = parseTradingPeriodKey(key ?? undefined) ?? getTradingPeriodFor(new Date());
  const summary = await getAttendantCommissionSummary({ attendantId: identity.resolvedUserId, start: period.start, end: period.end });
  return NextResponse.json(summary, { headers: { "Cache-Control": "private, no-store" } });
}
