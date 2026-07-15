import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { getOpenReviewSupportOperations } from "@/lib/reviewsReferrals";

export const dynamic = "force-dynamic";

function formatDate(value: string | null) {
  if (!value) return "Not available";
  return new Intl.DateTimeFormat("en-KE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default async function AdminReviewSupportAlertsPage() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role ?? "";
  if (!session) redirect("/admin/login");
  if (role !== "ADMIN" && role !== "SUPERVISOR") redirect("/not-authorized");

  const rows = await getOpenReviewSupportOperations(120);

  return (
    <div className="space-y-8">
      <section className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,.95),rgba(2,6,23,.98))] p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-3">
            <div className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-300">Support Alerts</div>
            <h1 className="text-4xl font-semibold tracking-tight text-white">Open review support alerts</h1>
            <p className="max-w-3xl text-sm text-slate-400">
              Inspect customers who reported a problem during review submission and follow up using their preferred contact details.
            </p>
          </div>
          <Link
            href="/admin/reviews-referrals"
            className="inline-flex rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm font-semibold text-white transition hover:border-white/20"
          >
            Back to reviews and referrals
          </Link>
        </div>
      </section>

      {!rows.length ? (
        <div className="rounded-[28px] border border-white/10 bg-slate-950/70 p-8 text-slate-300">
          <div className="text-lg font-semibold text-white">No open support alerts.</div>
        </div>
      ) : null}

      {rows.map((row) => (
        <article key={row.id} className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,.96),rgba(2,6,23,.96))] p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-2xl font-semibold text-white">{row.customerName}</h2>
                <span className="inline-flex rounded-full border border-rose-400/20 bg-rose-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-rose-200">
                  Open
                </span>
              </div>
              <div className="mt-3 grid gap-2 text-sm text-slate-400 sm:grid-cols-2 xl:grid-cols-4">
                <div>Product: {row.productName}</div>
                <div>Phone: {row.customerPhone}</div>
                <div>Preferred contact: {row.preferredContactNumber || "Use customer phone"}</div>
                <div>Raised: {formatDate(row.createdAt)}</div>
              </div>
            </div>
          </div>

          <div className="mt-5 rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
            <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Issue description</div>
            <div className="mt-4 text-sm leading-7 text-slate-300">{row.issueDescription}</div>
          </div>

          <div className="mt-5 flex flex-wrap gap-3 text-sm text-slate-300">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">Best time to contact: {row.bestTimeToContact || "Not provided"}</div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">Status: {row.status}</div>
          </div>
        </article>
      ))}
    </div>
  );
}
