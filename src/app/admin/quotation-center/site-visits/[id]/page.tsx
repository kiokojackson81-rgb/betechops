import { notFound } from "next/navigation";
import SiteVisitDetailClient from "@/app/admin/quotation-center/site-visits/SiteVisitDetailClient";
import { auth } from "@/lib/auth";
import { canAccessSiteVisit, getSiteVisitAccessActor } from "@/lib/siteVisitAccess";
import { getOrderedQuoteStaffUsers } from "@/lib/quoteRequests";
import { getSiteVisitById, listSiteVisitAttachments, listSiteVisitEvents } from "@/lib/siteVisits";

export const dynamic = "force-dynamic";
export default async function SiteVisitDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const actor = await getSiteVisitAccessActor(session?.user as never);
  const { id } = await params;
  const visit = actor ? await getSiteVisitById(id) : null;
  if (!actor || !visit || !canAccessSiteVisit(actor, visit)) notFound();
  const [events, attachments, staffOptions] = await Promise.all([listSiteVisitEvents(id), listSiteVisitAttachments(id), getOrderedQuoteStaffUsers()]);
  return <main className="min-h-screen bg-slate-950 px-4 py-4 lg:px-6"><div className="mx-auto max-w-[1600px]"><SiteVisitDetailClient initialVisit={visit} initialEvents={events} initialAttachments={attachments} staffOptions={staffOptions} canManageCommercials={actor.canManageCommercials} backPath="/admin/quotation-center/site-visits" /></div></main>;
}
