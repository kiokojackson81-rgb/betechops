import { redirect } from "next/navigation";
import Link from "next/link";
import AgentsAdminClient from "@/app/admin/agents/AgentsAdminClient";
import { auth } from "@/lib/auth";
import { getAdminAgentsData } from "@/lib/agents/service";

export const dynamic = "force-dynamic";

export default async function AdminAgentsPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string; status?: string; county?: string; sort?: string }>;
}) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role ?? "";
  if (!session) redirect("/admin/login");
  if (role !== "ADMIN" && role !== "SUPERVISOR") redirect("/not-authorized");

  const params = (await searchParams) || {};
  const q = params.q?.trim() || "";
  const status = params.status?.trim() || "all";
  const county = params.county?.trim() || "all";
  const sort = params.sort?.trim() || "newest";
  const agents = await getAdminAgentsData(q, status, county, sort);

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
  const counties = Array.from(
    new Set(
      prepared
        .map((row) => row.profile.county)
        .filter((value): value is string => Boolean(value)),
    ),
  ).sort((a, b) => a.localeCompare(b));
  const totals = prepared.reduce(
    (acc, agent) => {
      acc.totalAgents += 1;
      if (agent.profile.status === "approved") acc.approvedAgents += 1;
      if (agent.profile.status === "pending") acc.pendingAgents += 1;
      if (agent.profile.status === "suspended") acc.suspendedAgents += 1;
      acc.totalSales += agent.totalSales;
      acc.pendingCommission += agent.pendingCommission;
      acc.paidCommission += agent.paidCommission;
      return acc;
    },
    {
      totalAgents: 0,
      approvedAgents: 0,
      pendingAgents: 0,
      suspendedAgents: 0,
      totalSales: 0,
      pendingCommission: 0,
      paidCommission: 0,
    },
  );
  const summaryCards = [
    { label: "Total Agents", value: String(totals.totalAgents), tone: "text-white" },
    { label: "Approved Agents", value: String(totals.approvedAgents), tone: "text-emerald-200" },
    { label: "Pending Approval", value: String(totals.pendingAgents), tone: "text-amber-200" },
    { label: "Suspended Agents", value: String(totals.suspendedAgents), tone: "text-slate-300" },
    {
      label: "Total Sales",
      value: new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(totals.totalSales),
      tone: "text-white",
    },
    {
      label: "Pending Commissions",
      value: new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(totals.pendingCommission),
      tone: "text-amber-200",
    },
    {
      label: "Paid Commissions",
      value: new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(totals.paidCommission),
      tone: "text-emerald-200",
    },
  ];

  return (
    <div className="space-y-8">
      <section className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,.95),rgba(2,6,23,.98))] p-8">
        <div className="space-y-3">
          <div className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-300">Affiliate admin</div>
          <h1 className="text-4xl font-semibold tracking-tight text-white">Affiliate agents management</h1>
          <p className="max-w-3xl text-sm text-slate-400">
            Scan registered agents quickly, approve or suspend accounts, and open detailed profiles only when you need them.
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

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-7">
          {summaryCards.map((card) => (
            <div key={card.label} className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
              <div className="text-xs uppercase tracking-[0.22em] text-slate-500">{card.label}</div>
              <div className={`mt-3 text-2xl font-semibold ${card.tone}`}>{card.value}</div>
            </div>
          ))}
        </div>

        <form className="mt-6 grid gap-4 rounded-[26px] border border-white/10 bg-white/[0.03] p-5 md:grid-cols-[1.2fr_180px_180px_180px_160px]">
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Search by name, phone, email, or referral code"
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
          <select
            name="county"
            defaultValue={county}
            className="rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-slate-100 outline-none transition focus:border-cyan-400/60"
          >
            <option value="all">All counties</option>
            {counties.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <select
            name="sort"
            defaultValue={sort}
            className="rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-slate-100 outline-none transition focus:border-cyan-400/60"
          >
            <option value="newest">Sort by newest</option>
            <option value="highest_sales">Sort by highest sales</option>
            <option value="pending_commission">Sort by pending commission</option>
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
