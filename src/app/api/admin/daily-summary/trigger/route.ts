import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api";
import { getTradingPeriodFor } from "@/lib/tradingPeriod";
import { computeAdminReceiptSummary } from "@/lib/adminReceiptsSummary";
import { buildAdminSummaryMessage } from "@/lib/adminSummaryMessage";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await requireRole(["ADMIN", "SUPERVISOR"]);
  if (!auth.ok) return auth.res;

  const now = new Date();
  const period = getTradingPeriodFor(now);
  const start = period.start;
  const end = now;

  const summary = await computeAdminReceiptSummary({ start, end, scope: "global" });
  const payload = buildAdminSummaryMessage({ summary, start, end });

  return NextResponse.json(payload);
}
