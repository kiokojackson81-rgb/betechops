import SiteVisitsAdminClient from "@/app/admin/quotation-center/site-visits/SiteVisitsAdminClient";
import { getOrderedQuoteStaffUsers } from "@/lib/quoteRequests";

export const dynamic = "force-dynamic";

export default async function TechnicalSiteVisitsPage() {
  const staffOptions = await getOrderedQuoteStaffUsers();

  return (
    <div className="space-y-4">
      <div className="rounded-[28px] border border-white/10 bg-white/5 p-6">
        <div className="text-xs uppercase tracking-[0.24em] text-emerald-300/80">Field operations</div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white">Site Visits</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-300">
          Schedule surveys, installation assessments, and service visits while keeping them tied to quotations and customer follow-up.
        </p>
      </div>

      <SiteVisitsAdminClient staffOptions={staffOptions} />
    </div>
  );
}
