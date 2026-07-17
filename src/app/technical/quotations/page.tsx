import QuotationRequestsDeskClient from "@/components/QuotationRequestsDeskClient";
import { getOrderedQuoteStaffUsers } from "@/lib/quoteRequests";

export const dynamic = "force-dynamic";

export default async function TechnicalQuotationsPage() {
  const staffOptions = await getOrderedQuoteStaffUsers();

  return (
    <div className="space-y-4">
      <div className="rounded-[28px] border border-white/10 bg-white/5 p-6">
        <div className="text-xs uppercase tracking-[0.24em] text-emerald-300/80">Technical quotations</div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white">Quotation Center</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-300">
          Prepare technical quotations, review customer requirements, and move approved work into the project pipeline without leaving the technical workspace.
        </p>
      </div>

      <QuotationRequestsDeskClient
        apiBasePath="/api/attendant/quote-requests"
        createApiPath="/api/attendant/quotation-center/create"
        templateApiPath="/api/attendant/quotation-center/templates"
        defaultStatusFilter="ALL"
        filterStorageKey="technical:quotation-center:status:v1"
        deskTitle="Technical Team Quotation Center"
        deskDescription="Create, review, and follow up quotations assigned to technical team members."
        emptyMessage="No quotations match the current filters."
        assigneeOptions={staffOptions}
        assigneeLabel="Assign quotation to technical staff"
        allowTemplateSelection
        showMonitoringSummary
      />
    </div>
  );
}
