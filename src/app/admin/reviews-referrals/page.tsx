import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { getReviewsReferralsAdminSummary } from "@/lib/reviewsReferrals";
import TestReviewLinkCard from "./TestReviewLinkCard";

export const dynamic = "force-dynamic";

function StatCard({ label, value, tone, href }: { label: string; value: string; tone?: string; href?: string }) {
  const content = (
    <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4 transition hover:border-white/20 hover:bg-white/[0.06]">
      <div className="text-xs uppercase tracking-[0.22em] text-slate-500">{label}</div>
      <div className={`mt-3 text-2xl font-semibold ${tone || "text-white"}`}>{value}</div>
    </div>
  );

  if (href) return <Link href={href}>{content}</Link>;
  return content;
}

export default async function AdminReviewsReferralsPage() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role ?? "";
  if (!session) redirect("/admin/login");
  if (role !== "ADMIN" && role !== "SUPERVISOR") redirect("/not-authorized");

  const summary = await getReviewsReferralsAdminSummary();
  const money = new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  });

  return (
    <div className="space-y-8">
      <TestReviewLinkCard />

      <section className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,.95),rgba(2,6,23,.98))] p-8">
        <div className="space-y-3">
          <div className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-300">Reviews & Referrals</div>
          <h1 className="text-4xl font-semibold tracking-tight text-white">Customer review and referral operations</h1>
          <p className="max-w-3xl text-sm text-slate-400">
            Track invitation throughput, submitted reviews, support alerts, and referral momentum from the post-purchase journey.
          </p>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <StatCard label="Pending invitations" value={String(summary.reviews.pendingInvitations)} href="/admin/reviews-referrals/invitations?status=due" />
          <StatCard label="Submitted reviews" value={String(summary.reviews.submittedReviews)} tone="text-amber-200" href="/admin/reviews-referrals/submitted-reviews" />
          <StatCard label="Published reviews" value={String(summary.reviews.publishedReviews)} tone="text-emerald-200" />
          <StatCard label="Open support alerts" value={String(summary.support.openSupportRequests)} tone="text-rose-200" />
          <StatCard label="Referral links" value={String(summary.referrals.totalReferrals)} tone="text-sky-200" />
          <StatCard label="Potential commissions" value={money.format(summary.referrals.potentialCommission)} tone="text-cyan-200" />
          <StatCard label="Pending withdrawals" value={String(summary.withdrawals.pendingWithdrawals)} tone="text-amber-200" />
          <StatCard label="Paid withdrawals" value={money.format(summary.withdrawals.paidWithdrawalAmount)} tone="text-emerald-200" />
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/admin/agents"
            className="inline-flex rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm font-semibold text-white transition hover:border-white/20"
          >
            Open agents operations
          </Link>
          <Link
            href="/admin/orders/website"
            className="inline-flex rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-sm font-semibold text-cyan-100 transition hover:border-cyan-300/30"
          >
            Open website orders
          </Link>
          <Link
            href="/admin/reviews-referrals/withdrawals"
            className="inline-flex rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm font-semibold text-emerald-100 transition hover:border-emerald-300/30"
          >
            Review withdrawal queue
          </Link>
          <Link
            href="/admin/reviews-referrals/invitations"
            className="inline-flex rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm font-semibold text-amber-100 transition hover:border-amber-300/30"
          >
            Open invitation queue
          </Link>
        </div>
      </section>
    </div>
  );
}
