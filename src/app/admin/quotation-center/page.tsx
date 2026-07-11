import QuotationRequestsDeskClient from "@/components/QuotationRequestsDeskClient";
import { getOrderedQuoteStaffUsers } from "@/lib/quoteRequests";

export const dynamic = "force-dynamic";

export default async function AdminQuotationCenterPage() {
  const staffOptions = await getOrderedQuoteStaffUsers();

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-4 text-slate-100 lg:px-6">
      <div className="mx-auto max-w-[1600px]">
        <QuotationRequestsDeskClient
          apiBasePath="/api/admin/quotation-center"
          createApiPath="/api/admin/quotation-center/create"
          templateApiPath="/api/admin/quotation-center/templates"
          defaultStatusFilter="ALL"
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
