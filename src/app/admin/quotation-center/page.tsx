import QuotationRequestsDeskClient from "@/components/QuotationRequestsDeskClient";
import { getOrderedQuoteStaffUsers } from "@/lib/quoteRequests";

export const dynamic = "force-dynamic";

export default async function AdminQuotationCenterPage() {
  const templateOwnerOptions = await getOrderedQuoteStaffUsers();

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-4 text-slate-100 lg:px-6">
      <div className="mx-auto max-w-7xl">
        <QuotationRequestsDeskClient
          apiBasePath="/api/attendant/quote-requests"
          defaultStatusFilter="PENDING"
          filterStorageKey="admin:quotation-center:status:v2"
          deskTitle="Admin Quotation Center"
          deskDescription="Create, review, edit, delete, and convert quotations company-wide from one admin desk. Admin also controls all template upload, edit, delete, and ownership assignment."
          emptyMessage="No quotations found right now."
          compactMode
          allowTemplateManager
          allowDelete
          templateOwnerOptions={templateOwnerOptions}
        />
      </div>
    </main>
  );
}
