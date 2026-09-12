import { NextResponse } from "next/server";
import { verifySiteAssessmentToken } from "@/lib/siteAssessmentLink";
import { getSiteVisitById } from "@/lib/siteVisits";
import { dispatchSiteAssessmentReportPublished } from "@/lib/siteVisitNotifications";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const token = String(body?.token || "");
  const tokenPayload = verifySiteAssessmentToken(token);
  if (!tokenPayload) {
    return NextResponse.json({ ok: false, error: "This assessment link is invalid or has expired." }, { status: 403 });
  }
  const visit = await getSiteVisitById(tokenPayload.visitId);
  if (!visit || visit.assignedTechnicianId !== tokenPayload.technicianId) {
    return NextResponse.json({ ok: false, error: "This assessment is no longer assigned to this link." }, { status: 403 });
  }
  if (!visit.assessmentReport) {
    return NextResponse.json({ ok: false, error: "Generate the assessment report before sending it to the customer." }, { status: 409 });
  }
  const notification = await dispatchSiteAssessmentReportPublished(visit, visit.assessmentReport, {
    resend: true,
    deliveryVersion: `manual-resend:${Date.now()}`,
  });
  return NextResponse.json({ ok: true, notification });
}
