import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { listReferralOwnershipLocks } from "@/lib/referralFraud";
import OwnershipLocksAdminClient from "./OwnershipLocksAdminClient";

export const dynamic = "force-dynamic";

export default async function AdminReferralOwnershipLocksPage() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role ?? "";
  if (!session) redirect("/admin/login");
  if (role !== "ADMIN" && role !== "SUPERVISOR") redirect("/not-authorized");

  const rows = await listReferralOwnershipLocks("all", 150);
  const preparedRows = rows.map((row) => ({
    ...row,
    lockExpiresAt: row.lockExpiresAt ? row.lockExpiresAt.toISOString() : null,
    releasedAt: row.releasedAt ? row.releasedAt.toISOString() : null,
    createdAt: row.createdAt ? row.createdAt.toISOString() : null,
    updatedAt: row.updatedAt ? row.updatedAt.toISOString() : null,
  }));

  return (
    <div className="space-y-8">
      <section className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,.95),rgba(2,6,23,.98))] p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-3">
            <div className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-300">Referral Ownership</div>
            <h1 className="text-4xl font-semibold tracking-tight text-white">Referral lock overrides</h1>
            <p className="max-w-3xl text-sm text-slate-400">
              Review active customer referral locks and release them when a verified admin override is required.
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

      <OwnershipLocksAdminClient initialRows={preparedRows} />
    </div>
  );
}
