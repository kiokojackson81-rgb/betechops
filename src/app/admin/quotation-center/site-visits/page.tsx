import SiteVisitsWorkspaceClient from "@/app/admin/quotation-center/site-visits/SiteVisitsWorkspaceClient";
import { getOrderedQuoteStaffUsers } from "@/lib/quoteRequests";

export const dynamic = "force-dynamic";

export default async function AdminQuotationCenterSiteVisitsPage({
  searchParams,
}: {
  searchParams?: Promise<{ quoteRef?: string }>;
}) {
  const staffOptions = await getOrderedQuoteStaffUsers();
  const params = (await searchParams) || {};

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-4 text-slate-100 lg:px-6">
      <div className="mx-auto max-w-[1800px]">
        <SiteVisitsWorkspaceClient
          staffOptions={staffOptions}
          initialQuoteRef={params.quoteRef?.trim() || null}
        />
      </div>
    </main>
  );
}
