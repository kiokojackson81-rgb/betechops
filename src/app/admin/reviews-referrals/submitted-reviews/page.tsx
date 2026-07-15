import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { getSubmittedReviewOperations } from "@/lib/reviewsReferrals";

export const dynamic = "force-dynamic";

function formatDate(value: string | null) {
  if (!value) return "Not available";
  return new Intl.DateTimeFormat("en-KE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default async function AdminSubmittedReviewsPage() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role ?? "";
  if (!session) redirect("/admin/login");
  if (role !== "ADMIN" && role !== "SUPERVISOR") redirect("/not-authorized");

  const rows = await getSubmittedReviewOperations(120);

  return (
    <div className="space-y-8">
      <section className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,.95),rgba(2,6,23,.98))] p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-3">
            <div className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-300">Submitted Reviews</div>
            <h1 className="text-4xl font-semibold tracking-tight text-white">Customer review submissions</h1>
            <p className="max-w-3xl text-sm text-slate-400">
              Review all submitted customer feedback from the post-purchase flow, including ratings, recommendation intent, and moderation status.
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
          <div className="text-lg font-semibold text-white">No submitted reviews yet.</div>
        </div>
      ) : null}

      {rows.map((row) => (
        <article key={row.id} className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,.96),rgba(2,6,23,.96))] p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-2xl font-semibold text-white">{row.customerName}</h2>
                <span className="inline-flex rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-200">
                  {row.moderationStatus}
                </span>
              </div>
              <div className="mt-3 grid gap-2 text-sm text-slate-400 sm:grid-cols-2 xl:grid-cols-4">
                <div>Product: {row.productName}</div>
                <div>Phone: {row.customerPhone}</div>
                <div>Order/receipt: {row.orderOrReceiptRef || "Not linked"}</div>
                <div>Submitted: {formatDate(row.createdAt)}</div>
              </div>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-white/[0.04] px-5 py-4 text-right">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Overall rating</div>
              <div className="mt-2 text-2xl font-black tracking-tight text-white">{row.overallRating}/5</div>
            </div>
          </div>

          <div className="mt-5 rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
            <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Review title</div>
            <div className="mt-2 text-lg font-semibold text-white">{row.reviewTitle || "Customer review submitted"}</div>
            <div className="mt-4 text-sm leading-7 text-slate-300">{row.reviewBody}</div>
          </div>

          <div className="mt-5 flex flex-wrap gap-3 text-sm text-slate-300">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">Recommend: {row.wouldRecommend || "Not specified"}</div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">Published: {row.published ? "Yes" : "No"}</div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">Customer town: {row.customerTown || "Not provided"}</div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">Problem reported: {row.hasProblem ? "Yes" : "No"}</div>
          </div>
        </article>
      ))}
    </div>
  );
}
