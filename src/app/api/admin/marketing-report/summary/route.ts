import { NextRequest, NextResponse } from "next/server";
import { startOfDay, endOfDay } from "date-fns";
import { getMarketingSummary } from "@/lib/marketingReport";
import { requireRole } from "@/lib/api";
import { getOrCreateCommissionPeriod } from "@/lib/commission";

export async function GET(request: NextRequest) {
  const auth = await requireRole("ADMIN");
  if (!auth.ok) return auth.res;

  const url = new URL(request.url);
  const fromParam = url.searchParams.get("from");
  const toParam = url.searchParams.get("to");

  if (!fromParam || !toParam) {
    return NextResponse.json({ error: "Missing from/to" }, { status: 400 });
  }

  const fromDate = startOfDay(new Date(fromParam));
  const toDate = endOfDay(new Date(toParam));

  await getOrCreateCommissionPeriod(fromDate);

  try {
    const summary = await getMarketingSummary({ from: fromDate, to: toDate });
    return NextResponse.json(summary);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message || "Failed to compute summary" }, { status: 500 });
  }
}
