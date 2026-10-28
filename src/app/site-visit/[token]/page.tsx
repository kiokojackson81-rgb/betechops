import { notFound } from "next/navigation";
import { getSiteVisitById } from "@/lib/siteVisits";
import { verifySiteAssessmentToken } from "@/lib/siteAssessmentLink";
import SiteAssessmentPublicClient from "@/app/site-assessment/SiteAssessmentPublicClient";

export const dynamic = "force-dynamic";

export default async function CustomerSiteVisitBriefing({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const payload = verifySiteAssessmentToken(token);
  const visit = payload?.audience === "CUSTOMER" ? await getSiteVisitById(payload.visitId) : null;
  if (!payload || !visit) notFound();

  return <SiteAssessmentPublicClient key={visit.id} visit={visit} assessmentToken={token} customerMode />;
}
