import type { Metadata } from "next";
import { CalendarCheck2, MapPin } from "lucide-react";
import { getCustomerAccountContext } from "@/app/account/_lib/accountData";
import { shopStyles } from "@/app/shop/_components/shopStyles";
import { buildShopMetadata } from "@/app/shop/shopMetadata";
import { listCustomerSiteVisits } from "@/lib/siteVisits";

export const metadata: Metadata = buildShopMetadata({
  title: "Site Visits",
  description: "Review scheduled Betech Solar site visits.",
});
const formatDate = (value: string) =>
  new Intl.DateTimeFormat("en-KE", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
const label = (value: string | null | undefined, fallback = "Pending") =>
  (value || fallback)
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

export default async function AccountSiteVisitsPage() {
  const { identity } = await getCustomerAccountContext();
  const visits = await listCustomerSiteVisits({ ...identity, take: 50 });
  return (
    <section className={`${shopStyles.lightCard} w-full min-w-0 p-5 sm:p-7`}>
      <div className="flex items-center gap-3">
        <CalendarCheck2 className="h-7 w-7 text-[#7a0000]" />
        <div>
          <div className={shopStyles.sectionEyebrow}>Site visits</div>
          <h1 className="mt-3 text-2xl font-black sm:text-3xl">
            Assessments and installations
          </h1>
        </div>
      </div>
      <div className="mt-6 grid w-full gap-4 2xl:grid-cols-2">
        {visits.length ? (
          visits.map((visit) => (
            <article
              key={visit.id}
              className="min-w-0 rounded-[22px] border border-[#7a0000]/10 bg-[#fcfaf7] p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-black">{visit.visitRef}</div>
                  <div className="mt-1 text-sm text-slate-500">
                    {label(visit.projectType, "Solar project")} ·{" "}
                    {formatDate(visit.scheduledAt || visit.createdAt)}
                  </div>
                </div>
                <span className="rounded-full bg-[#fff3d8] px-3 py-1 text-[11px] font-black uppercase tracking-wider text-[#7a0000]">
                  {label(visit.status)}
                </span>
              </div>
              <div className="mt-4 flex gap-2 text-sm text-slate-600">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#7a0000]" />
                <span>
                  {[visit.location, visit.town, visit.county]
                    .filter(Boolean)
                    .join(", ") || "Location pending"}
                </span>
              </div>
              <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <span className="font-bold">Assigned:</span>{" "}
                  {visit.assignedTechnicianName ||
                    visit.assignedStaffName ||
                    "Betech team pending"}
                </div>
                <div>
                  <span className="font-bold">Outcome:</span>{" "}
                  {label(visit.outcome, "Visit in progress")}
                </div>
                {visit.quoteRef ? (
                  <div className="sm:col-span-2">
                    <span className="font-bold">Linked quotation:</span>{" "}
                    {visit.quoteRef}
                  </div>
                ) : null}
              </div>
            </article>
          ))
        ) : (
          <div className="rounded-[22px] border border-dashed border-[#7a0000]/15 p-8 text-sm text-slate-500 2xl:col-span-2">
            No site visits are linked to this account yet.
          </div>
        )}
      </div>
    </section>
  );
}
