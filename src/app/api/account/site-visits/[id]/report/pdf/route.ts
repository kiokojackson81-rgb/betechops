import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { findSafeCustomerProfileByUserId } from "@/lib/customerProfile";
import { buildCustomerAccountIdentity } from "@/lib/shopCustomerOrders";
import { customerOwnsSiteVisit } from "@/lib/siteVisits";
import { generateSiteAssessmentReportPdf } from "@/lib/siteAssessmentReport";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth().catch(() => null);
  const sessionUser = session?.user as { id?: string | null; phone?: string | null; email?: string | null } | undefined;
  if (!sessionUser?.id) return NextResponse.json({ ok: false, error: "Please sign in to download this report." }, { status: 401 });
  const profile = await findSafeCustomerProfileByUserId(sessionUser.id);
  const identity = buildCustomerAccountIdentity({ id: sessionUser.id, phone: sessionUser.phone || null, email: sessionUser.email || null }, profile);
  const { id } = await context.params;
  const visit = await customerOwnsSiteVisit({ visitId: id, ...identity });
  if (!visit?.assessmentReport) return NextResponse.json({ ok: false, error: "Assessment report not found." }, { status: 404 });
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
