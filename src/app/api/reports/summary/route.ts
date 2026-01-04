import { NextRequest, NextResponse } from "next/server";
import { requireAttendant } from "@/lib/auth";
import { getOnlineQuickStats, getOnlineEarningsSummary, findPreferredCommissionLedger } from "@/lib/onlineOps";
import { getOrCreateCommissionPeriod } from "@/lib/commission";

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

  // Ensure quick stats commission uses authoritative persisted commissionTotal when available
  if (earnings?.commissionTotal && Number(earnings.commissionTotal) > 0) {
    quickStats.commissionKes = Number(earnings.commissionTotal);
  }

  // Also expose which CommissionLedger id was selected (if any) for debugging
  try {
    const ledger = await findPreferredCommissionLedger(auth.user.id, (await getOrCreateCommissionPeriod(new Date())).tradingPeriod as any);
    // attach ledgerId to quickStats for visibility
    (quickStats as any).ledgerId = (ledger as any)?.id ?? null;
  } catch (e) {
    // ignore
  }

  return NextResponse.json({ scope, quickStats, earnings });
}
