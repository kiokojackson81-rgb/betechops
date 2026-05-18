import { redirect } from "next/navigation";
import Link from "next/link";
import AgentsAdminClient from "@/app/admin/agents/AgentsAdminClient";
import { auth } from "@/lib/auth";
import { getAdminAgentsData } from "@/lib/agents/service";

export const dynamic = "force-dynamic";

export default async function AdminAgentsPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string; status?: string; county?: string; sort?: string; page?: string; view?: string }>;
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
  const page = Math.max(1, Number(params.page || "1"));
  const view = params.view?.trim() || "all";
  const agents = await getAdminAgentsData(q, status, county, sort);

  const preparedAll = agents.map((row) => ({
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
    activities: row.activities.map((item) => ({ ...item, createdAt: item.createdAt.toISOString() })),
    lastActiveAt: row.lastActiveAt.toISOString(),
  }));
  const prepared = preparedAll.filter((row) => {
    if (view === "pending") return row.profile.status === "pending";
    if (view === "suspended") return row.profile.status === "suspended";
    if (view === "top") return row.performanceLabel === "Top Performer";
    if (view === "fraud") return row.riskLevel !== "low";
    return true;
  });
  const counties = Array.from(
    new Set(
      preparedAll
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
  const viewCounts = {
    all: preparedAll.length,
    pending: preparedAll.filter((agent) => agent.profile.status === "pending").length,
    suspended: preparedAll.filter((agent) => agent.profile.status === "suspended").length,
    top: preparedAll.filter((agent) => agent.performanceLabel === "Top Performer").length,
    fraud: preparedAll.filter((agent) => agent.riskLevel !== "low").length,
  };
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
  const pageSize = 25;
  const totalPages = Math.max(1, Math.ceil(prepared.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedAgents = prepared.slice((safePage - 1) * pageSize, safePage * pageSize);

  function buildHref(next: Record<string, string | number | undefined>) {
    const query = new URLSearchParams();
    const finalParams = {
      q,
      status,
      county,
      sort,
      view,
      page: safePage,
      ...next,
    };
    for (const [key, value] of Object.entries(finalParams)) {
      if (value === undefined || value === "" || value === "all") continue;
      query.set(key, String(value));
    }
    const serialized = query.toString();
    return serialized ? `/admin/agents?${serialized}` : "/admin/agents";
  }

  const viewTabs = [
    { key: "all", label: "All Agents", count: viewCounts.all },
    { key: "pending", label: "Pending Approval", count: viewCounts.pending },
    { key: "suspended", label: "Suspended", count: viewCounts.suspended },
    { key: "top", label: "Top Performers", count: viewCounts.top },
    { key: "fraud", label: "Fraud Alerts", count: viewCounts.fraud },
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

        <div className="mt-6 flex flex-wrap gap-3">
          {viewTabs.map((tab) => {
            const active = view === tab.key || (view === "all" && tab.key === "all");
            return (
              <Link
                key={tab.key}
                href={buildHref({ view: tab.key === "all" ? undefined : tab.key, page: 1 })}
                className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-semibold transition ${
                  active
                    ? "border-cyan-400/30 bg-cyan-400/12 text-cyan-100"
                    : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/20"
                }`}
              >
                <span>{tab.label}</span>
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px]">{tab.count}</span>
              </Link>
            );
          })}
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

      <AgentsAdminClient agents={pagedAgents} />

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,.9),rgba(2,6,23,.95))] px-5 py-4 text-sm text-slate-300">
        <div>
          Showing {(safePage - 1) * pageSize + 1}-{Math.min(safePage * pageSize, prepared.length)} of {prepared.length} agents
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={buildHref({ page: Math.max(1, safePage - 1) })}
            className={`rounded-xl border px-4 py-2 font-semibold ${safePage <= 1 ? "pointer-events-none border-white/5 text-slate-600" : "border-white/10 text-slate-100 hover:border-white/20"}`}
          >
            Previous
          </Link>
          <span className="text-xs uppercase tracking-[0.18em] text-slate-500">Page {safePage} / {totalPages}</span>
          <Link
            href={buildHref({ page: Math.min(totalPages, safePage + 1) })}
            className={`rounded-xl border px-4 py-2 font-semibold ${safePage >= totalPages ? "pointer-events-none border-white/5 text-slate-600" : "border-white/10 text-slate-100 hover:border-white/20"}`}
          >
            Next
          </Link>
        </div>
      </div>
    </div>
  );
}
