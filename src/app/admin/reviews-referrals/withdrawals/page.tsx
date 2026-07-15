import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { getReferralWithdrawalQueue } from "@/lib/reviewsReferrals";
import ReferralWithdrawalsAdminClient from "./ReferralWithdrawalsAdminClient";

export const dynamic = "force-dynamic";

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

export default async function AdminReferralWithdrawalsPage() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role ?? "";
  if (!session) redirect("/admin/login");
  if (role !== "ADMIN" && role !== "SUPERVISOR") redirect("/not-authorized");

  const rows = await getReferralWithdrawalQueue();
  const pendingAmount = rows
    .filter((row) => ["pending", "approved", "held"].includes(row.status.toLowerCase()))
    .reduce((sum, row) => sum + row.amount, 0);
  const paidAmount = rows
    .filter((row) => row.status.toLowerCase() === "paid")
    .reduce((sum, row) => sum + row.amount, 0);

  return (
    <div className="space-y-8">
      <section className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,.95),rgba(2,6,23,.98))] p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-3">
            <div className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-300">Referral Withdrawals</div>
            <h1 className="text-4xl font-semibold tracking-tight text-white">Customer commission withdrawal queue</h1>
            <p className="max-w-3xl text-sm text-slate-400">
              Approve, hold, reject, and mark paid for customer referral withdrawals linked to the post-purchase review flow.
            </p>
          </div>
          <Link
            href="/admin/reviews-referrals"
            className="inline-flex rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm font-semibold text-white transition hover:border-white/20"
          >
            Back to reviews and referrals
          </Link>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
            <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Requests</div>
            <div className="mt-3 text-2xl font-semibold text-white">{rows.length}</div>
          </div>
          <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
            <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Open amount</div>
            <div className="mt-3 text-2xl font-semibold text-amber-200">{formatMoney(pendingAmount)}</div>
          </div>
          <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
            <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Paid amount</div>
            <div className="mt-3 text-2xl font-semibold text-emerald-200">{formatMoney(paidAmount)}</div>
          </div>
        </div>
      </section>

      <ReferralWithdrawalsAdminClient rows={rows} />
    </div>
  );
}
