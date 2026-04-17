import { NextRequest, NextResponse } from "next/server";
import { requireRoleOrBenjamin } from "@/lib/api";
import { buildDividedPdfBuffer } from "@/lib/dividedPdf";
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
    return NextResponse.json({ error: "weekStart is required" }, { status: 400 });
  }

  try {
    const report = await getDividedReportForWeek(weekStartRaw);
    const pdfBytes = await buildDividedPdfBuffer(report);
    const fileName = `divided-${weekStartRaw}.pdf`;

    return new Response(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err: any) {
    console.error("Divided PDF export failed", err);
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 });
  }
}
