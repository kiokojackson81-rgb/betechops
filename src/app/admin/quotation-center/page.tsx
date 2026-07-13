import QuotationRequestsDeskClient from "@/components/QuotationRequestsDeskClient";
import Link from "next/link";
import { getOrderedQuoteStaffUsers } from "@/lib/quoteRequests";

export const dynamic = "force-dynamic";

export default async function AdminQuotationCenterPage({
  searchParams,
}: {
  searchParams?: Promise<{ quoteId?: string }>;
}) {
  const staffOptions = await getOrderedQuoteStaffUsers();
  const params = (await searchParams) || {};

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-4 text-slate-100 lg:px-6">
      <div className="mx-auto max-w-[1600px]">
        <div className="mb-4 flex flex-wrap gap-2">
          <Link
            href="/admin/quotation-center/site-visits"
            className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-cyan-100 transition hover:border-cyan-400"
          >
            Site Visits
          </Link>
        </div>
        <QuotationRequestsDeskClient
          apiBasePath="/api/admin/quotation-center"
          createApiPath="/api/admin/quotation-center/create"
          templateApiPath="/api/admin/quotation-center/templates"
          defaultStatusFilter="ALL"
          initialExpandedId={params.quoteId?.trim() || null}
          filterStorageKey="admin:quotation-center:status:v2"
          deskTitle="Admin Quotation Monitoring Center"
          deskDescription="Review every quotation activity company-wide, including website requests, manual quotations, quoted work, conversions, ownership, templates, and customer follow-up from one admin desk."
          emptyMessage="No quotations found across the current filters."
          allowTemplateManager
          allowDelete
          templateOwnerOptions={staffOptions}
          assigneeOptions={staffOptions}
          assigneeLabel="Assign quotation to staff"
          showMonitoringSummary
          enableAdminFilters
        />
      </div>
    </main>
  );
}
