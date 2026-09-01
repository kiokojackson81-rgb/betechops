import { notFound } from "next/navigation";
import SiteAssessmentPublicClient from "@/app/site-assessment/SiteAssessmentPublicClient";
import { getSiteVisitById } from "@/lib/siteVisits";
import { verifySiteAssessmentToken } from "@/lib/siteAssessmentLink";

export const dynamic = "force-dynamic";

export default async function PublicSiteAssessmentPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const payload = verifySiteAssessmentToken(token);
  const visit = payload ? await getSiteVisitById(payload.visitId) : null;
  if (!payload || !visit || visit.assignedTechnicianId !== payload.technicianId)
    notFound();
  return <SiteAssessmentPublicClient visit={visit} assessmentToken={token} />;
}
