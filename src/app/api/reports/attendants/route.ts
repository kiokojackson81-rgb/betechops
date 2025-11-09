import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api";
import { getAttendantCategorySummary } from "@/lib/attendants/reporting";

export async function GET(request: Request) {
  const auth = await requireRole("ADMIN");
  if (!auth.ok) return auth.res;

  const url = new URL(request.url);
  const rangeDays = Math.min(90, Math.max(1, Number(url.searchParams.get("days") || 7)));
  const summary = await getAttendantCategorySummary(rangeDays);

  return NextResponse.json({
    since: summary.since.toISOString(),
    days: summary.days,
    categories: summary.categories,
  });
}
