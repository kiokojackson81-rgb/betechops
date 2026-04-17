import { NextRequest, NextResponse } from "next/server";
import { requireRoleOrBenjamin } from "@/lib/api";
import { getDividedReportForWeek } from "@/lib/dividedReport";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function normalize(value: unknown): string {
  return String(value ?? "").trim();
}

export async function GET(req: NextRequest) {
  const auth = await requireRoleOrBenjamin(["ADMIN", "SUPERVISOR"]);
  if (!auth.ok) return auth.res;

  const { searchParams } = new URL(req.url);
  const weekStartRaw = normalize(searchParams.get("weekStart"));
  if (!weekStartRaw) {
    return NextResponse.json({ error: "weekStart is required (YYYY-MM-DD)" }, { status: 400 });
  }

  try {
    const report = await getDividedReportForWeek(weekStartRaw);
    return NextResponse.json(report, {
      headers: {
        "Cache-Control": "no-store, no-cache, max-age=0, must-revalidate",
        Pragma: "no-cache",
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || String(err) }, { status: 400 });
  }
}
