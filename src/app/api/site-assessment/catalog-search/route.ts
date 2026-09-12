import { NextRequest, NextResponse } from "next/server";
import { searchLiveCatalog } from "@/lib/aiCatalog";
import { verifySiteAssessmentToken } from "@/lib/siteAssessmentLink";
import { getSiteVisitById } from "@/lib/siteVisits";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const token = String(body?.token || "");
  const query = String(body?.query || "").trim();
  const tokenPayload = verifySiteAssessmentToken(token);
  if (!tokenPayload) return NextResponse.json({ ok: false, error: "This assessment link is invalid or has expired." }, { status: 403 });
  const visit = await getSiteVisitById(tokenPayload.visitId);
  if (!visit || visit.assignedTechnicianId !== tokenPayload.technicianId) {
    return NextResponse.json({ ok: false, error: "This assessment is no longer assigned to this link." }, { status: 403 });
  }
  if (query.length < 2 || query.length > 160) {
    return NextResponse.json({ ok: false, error: "Enter 2 to 160 characters to search the Betech catalog." }, { status: 400 });
  }
  const catalog = await searchLiveCatalog({ query, origin: "https://www.betech.co.ke", limit: 6 });
  return NextResponse.json({
    ok: true,
    products: catalog.products,
    recommendationReason: catalog.recommendationReason,
    needsMoreInfo: catalog.needsMoreInfo,
  });
}
