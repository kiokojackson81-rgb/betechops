import { NextResponse } from "next/server";
import { requireAttendant } from "@/lib/auth";
import { composeIdentityResponse, resolveTargetUserId } from "@/lib/resolveTargetUser";
import { getOnlineEarningsSummary } from "@/lib/onlineOps";
import { getTradingPeriodFor, parseTradingPeriodKey } from "@/lib/tradingPeriod";

export const dynamic = "force-dynamic";

const parseDateParam = (value: string | null) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export async function GET(req: Request) {
  const auth = await requireAttendant(req, ["JUMIA_KILIMALL_OPS", "BETECH_OPS", "SUPERVISOR", "ADMIN"]);
  if (!auth.ok) {
    const r = auth.res;
    try {
      r.headers.set("Cache-Control", "no-store, no-cache, max-age=0, must-revalidate");
    } catch {}
    return r;
  }

  const identity = await resolveTargetUserId(req);
  const attendantId = identity.resolvedUserId;
  if (!attendantId) {
    const r = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    r.headers.set("Cache-Control", "no-store, no-cache, max-age=0, must-revalidate");
    return r;
  }

  const url = new URL(req.url);
  const startParam = parseDateParam(url.searchParams.get("start"));
  const endParam = parseDateParam(url.searchParams.get("end"));
  const periodKeyParam = url.searchParams.get("periodKey");
  const requestedPeriod = parseTradingPeriodKey(periodKeyParam ?? undefined);

  const period =
    startParam && endParam
      ? {
          key: requestedPeriod?.key ?? "custom",
          label: requestedPeriod?.label ?? "Selected period",
          start: startParam,
          end: endParam,
        }
      : requestedPeriod ?? getTradingPeriodFor(new Date());

  const summary = await getOnlineEarningsSummary(attendantId, { period });
  const r = NextResponse.json(composeIdentityResponse(identity, summary as unknown as Record<string, unknown>));
  r.headers.set("Cache-Control", "no-store, no-cache, max-age=0, must-revalidate");
  return r;
}
