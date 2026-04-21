import { requireAttendant } from "@/lib/auth";
import { parseTradingPeriodKey, getTradingPeriodFor } from "@/lib/tradingPeriod";
import { generateOnlinePerformancePdfResponse } from "@/lib/onlinePerformanceExport";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth = await requireAttendant(req, ["JUMIA_KILIMALL_OPS", "BETECH_OPS", "SUPERVISOR", "ADMIN"]);
  if (!auth.ok) return auth.res;

  const url = new URL(req.url);
  const period = parseTradingPeriodKey(url.searchParams.get("periodKey") ?? undefined) ?? getTradingPeriodFor(new Date());
  return generateOnlinePerformancePdfResponse({ userId: auth.user.id, period });
}
