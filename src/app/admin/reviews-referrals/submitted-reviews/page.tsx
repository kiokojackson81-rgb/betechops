import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { getSubmittedReviewOperations } from "@/lib/reviewsReferrals";
import ReviewsAdminListClient from "@/app/admin/reviews-referrals/ReviewsAdminListClient";

export const dynamic = "force-dynamic";

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

      <ReviewsAdminListClient initialRows={rows} />
    </div>
  );
}
