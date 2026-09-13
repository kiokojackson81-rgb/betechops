import { NextRequest, NextResponse } from "next/server";
import { verifySiteAssessmentToken } from "@/lib/siteAssessmentLink";
import { getSiteVisitById } from "@/lib/siteVisits";
import { generateSiteAssessmentReportPdf } from "@/lib/siteAssessmentReport";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") || "";
  const tokenPayload = verifySiteAssessmentToken(token);
  if (!tokenPayload) return NextResponse.json({ ok: false, error: "This assessment link is invalid or has expired." }, { status: 403 });
  const visit = await getSiteVisitById(tokenPayload.visitId);
  if (!visit || visit.assignedTechnicianId !== tokenPayload.technicianId || !visit.assessmentReport) {
    return NextResponse.json({ ok: false, error: "Assessment report not found." }, { status: 404 });
  }
  const pdf = await generateSiteAssessmentReportPdf({
    visitRef: visit.visitRef,
    customerName: visit.customerName,
    location: [visit.location, visit.landmark, visit.town, visit.county].filter(Boolean).join(", "),
    projectType: visit.projectType,
    visitReason: visit.visitReason,
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
