import { notFound } from "next/navigation";
import SiteVisitsWorkspaceClient from "@/app/admin/quotation-center/site-visits/SiteVisitsWorkspaceClient";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOrderedQuoteStaffUsers } from "@/lib/quoteRequests";
import { getSiteVisitAccessActor } from "@/lib/siteVisitAccess";

export const dynamic = "force-dynamic";

export default async function AdminQuotationCenterSiteVisitsPage({
  searchParams,
}: {
  searchParams?: Promise<{ quoteRef?: string }>;
}) {
  const session = await auth();
  const actor = await getSiteVisitAccessActor(session?.user as never);
  if (!actor) notFound();

  const [staffOptions, externalTechnicians] = await Promise.all([
    getOrderedQuoteStaffUsers(),
    prisma.projectExternalAgent.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, whatsappNumber: true },
    }),
  ]);
  const params = (await searchParams) || {};

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-4 text-slate-100 lg:px-6">
      <div className="mx-auto max-w-[1800px]">
        <SiteVisitsWorkspaceClient
          staffOptions={staffOptions}
          externalTechnicians={externalTechnicians}
          canAssignTechnicians={actor.canAssignTechnicians}
          canDeleteVisits={actor.canManageCommercials}
          initialQuoteRef={params.quoteRef?.trim() || null}
        />
      </div>
    </main>
  );
}
