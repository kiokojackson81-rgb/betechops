import { NextResponse } from "next/server";
import { requireAttendant } from "@/lib/auth";
import { getWarrantyCertificate, warrantyPdfBytes } from "@/lib/warrantyCertificates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type ParamsContext = { params: Promise<{ id: string }> | { id: string } };

export async function GET(request: Request, context: ParamsContext) {
  const guard = await requireAttendant(request, ["ADMIN", "SUPERVISOR", "ATTENDANT", "TECHNICAL_TEAM"]);
  if (!guard.ok) return guard.res;
  const { id } = await context.params;
  const certificate = await getWarrantyCertificate(id);
  if (!certificate) return NextResponse.json({ error: "No issued warranty certificate exists for this project." }, { status: 404 });
  try {
    const pdf = await warrantyPdfBytes(certificate);
    return new NextResponse(pdf, { headers: { "content-type": "application/pdf", "content-disposition": `attachment; filename="${certificate.certificateNo}.pdf"`, "cache-control": "private, no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Warranty PDF unavailable." }, { status: 503 });
  }
}
