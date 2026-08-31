import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getSiteVisitAccessActor } from "@/lib/siteVisitAccess";
import { getSiteVisitById } from "@/lib/siteVisits";
import { createSiteAssessmentToken } from "@/lib/siteAssessmentLink";

export async function POST(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await auth().catch(() => null);
  const actor = await getSiteVisitAccessActor(session?.user as never);
  if (!actor?.canAssignTechnicians) return NextResponse.json({ error: "Only an administrator can open an external assessment link." }, { status: 403 });
  const { id } = await context.params;
  const visit = await getSiteVisitById(id);
  if (!visit?.assignedTechnicianId) return NextResponse.json({ error: "Assign a technician before opening the assessment form." }, { status: 400 });
  const token = createSiteAssessmentToken({ visitId: visit.id, technicianId: visit.assignedTechnicianId });
  return NextResponse.json({ ok: true, url: `/site-assessment/${token}` });
}
