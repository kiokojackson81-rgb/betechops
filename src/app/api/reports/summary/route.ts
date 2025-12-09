import { NextRequest, NextResponse } from "next/server";
import { requireAttendant } from "@/lib/auth";
import { getOnlineQuickStats, getOnlineEarningsSummary } from "@/lib/onlineOps";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const scope = url.searchParams.get("scope") ?? "attendant";
  if (scope !== "attendant") {
    return NextResponse.json({ error: "Unsupported scope" }, { status: 400 });
  }

  const auth = await requireAttendant(req, ["JUMIA_KILIMALL_OPS", "BETECH_OPS", "SUPERVISOR", "ADMIN"]);
  if (!auth.ok) return auth.res;

  const [quickStats, earnings] = await Promise.all([
    getOnlineQuickStats(auth.user.id),
    getOnlineEarningsSummary(auth.user.id),
  ]);

  return NextResponse.json({ scope, quickStats, earnings });
}
