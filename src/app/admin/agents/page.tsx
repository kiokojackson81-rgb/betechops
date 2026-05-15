import { redirect } from "next/navigation";
import Link from "next/link";
import AgentsAdminClient from "@/app/admin/agents/AgentsAdminClient";
import { auth } from "@/lib/auth";
import { getAdminAgentsData } from "@/lib/agents/service";

export const dynamic = "force-dynamic";

export default async function AdminAgentsPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string; status?: string }>;
}) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role ?? "";
  if (!session) redirect("/admin/login");
  if (role !== "ADMIN" && role !== "SUPERVISOR") redirect("/not-authorized");

  const params = (await searchParams) || {};
  const q = params.q?.trim() || "";
  const status = params.status?.trim() || "all";
  const agents = await getAdminAgentsData(q, status);

  const prepared = agents.map((row) => ({
    ...row,
    profile: {
      ...row.profile,
      createdAt: row.profile.createdAt.toISOString(),
      updatedAt: row.profile.updatedAt.toISOString(),
      user: {
        ...row.profile.user,
        createdAt: row.profile.user.createdAt.toISOString(),
      },
    },
    lastCommissionAt: row.lastCommissionAt ? row.lastCommissionAt.toISOString() : null,
    commissions: row.commissions.map((item) => ({ ...item, createdAt: item.createdAt.toISOString() })),
    payouts: row.payouts.map((item) => ({ ...item, createdAt: item.createdAt.toISOString() })),
  }));

  return (
    <div className="space-y-8">
      <section className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,.95),rgba(2,6,23,.98))] p-8">
        <div className="space-y-3">
          <div className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-300">Affiliate admin</div>
          <h1 className="text-4xl font-semibold tracking-tight text-white">Agents, KYC, commissions, and payouts</h1>
          <p className="max-w-3xl text-sm text-slate-400">
            Review all registered agents, approve or reject applications, inspect KYC fields, and compare affiliate
            performance without leaving the main BETECHOPS admin shell.
          </p>
        </div>
        <div className="mt-5">
          <Link
            href="/admin/agents/pending-sales"
            className="inline-flex rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm font-semibold text-emerald-100 transition hover:border-emerald-300/30"
          >
            Open pending sales queue
          </Link>
        </div>

        <form className="mt-6 grid gap-4 rounded-[26px] border border-white/10 bg-white/[0.03] p-5 md:grid-cols-[1fr_220px_160px]">
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Search by code, name, email, or phone"
            className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-slate-100 outline-none transition focus:border-cyan-400/60"
          />
          <select
            name="status"
            defaultValue={status}
            className="rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-slate-100 outline-none transition focus:border-cyan-400/60"
          >
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="suspended">Suspended</option>
          </select>
          <button type="submit" className="rounded-2xl bg-cyan-300 px-4 py-3 font-semibold text-slate-950 transition hover:brightness-95">
            Apply filters
          </button>
        </form>
      </section>

      <AgentsAdminClient agents={prepared} />
    </div>
  );
}
