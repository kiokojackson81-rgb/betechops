import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { canAccessSiteVisit, getSiteVisitAccessActor } from "@/lib/siteVisitAccess";
import { getSiteVisitById } from "@/lib/siteVisits";
import { generateSiteAssessmentReportPdf } from "@/lib/siteAssessmentReport";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth().catch(() => null);
  const actor = await getSiteVisitAccessActor(session?.user as never);
  if (!actor) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  const { id } = await context.params;
  const visit = await getSiteVisitById(id);
  if (!visit?.assessmentReport) return NextResponse.json({ ok: false, error: "Assessment report not found." }, { status: 404 });
  if (!canAccessSiteVisit(actor, visit)) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  const pdf = await generateSiteAssessmentReportPdf({
    visitRef: visit.visitRef,
    customerName: visit.customerName,
    location: [visit.location, visit.landmark, visit.town, visit.county].filter(Boolean).join(", "),
    report: visit.assessmentReport,
  });
  return new NextResponse(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${visit.visitRef}-site-assessment-report.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
