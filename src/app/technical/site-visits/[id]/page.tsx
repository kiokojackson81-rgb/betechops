import { notFound } from "next/navigation";
import SiteVisitDetailClient from "@/app/admin/quotation-center/site-visits/SiteVisitDetailClient";
import { auth } from "@/lib/auth";
import { canAccessSiteVisit, getSiteVisitAccessActor } from "@/lib/siteVisitAccess";
import { getOrderedQuoteStaffUsers } from "@/lib/quoteRequests";
import { getSiteVisitById, listSiteVisitAttachments, listSiteVisitEvents } from "@/lib/siteVisits";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export default async function TechnicalSiteVisitDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth(); const actor = await getSiteVisitAccessActor(session?.user as never); const { id } = await params;
  const visit = actor ? await getSiteVisitById(id) : null;
  if (!actor || !visit || !canAccessSiteVisit(actor, visit)) notFound();
  const [events, attachments, staffOptions, externalTechnicians] = await Promise.all([listSiteVisitEvents(id), listSiteVisitAttachments(id), getOrderedQuoteStaffUsers(), prisma.projectExternalAgent.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, whatsappNumber: true } })]);
  return <SiteVisitDetailClient initialVisit={visit} initialEvents={events} initialAttachments={attachments} staffOptions={staffOptions} externalTechnicians={externalTechnicians} canManageCommercials={actor.canManageCommercials} canAssignTechnicians={actor.canAssignTechnicians} backPath="/technical/site-visits" />;
}
