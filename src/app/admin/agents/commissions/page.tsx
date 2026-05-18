import Link from "next/link";
import { redirect } from "next/navigation";
import AgentCommissionsAdminClient from "@/app/admin/agents/AgentCommissionsAdminClient";
import { auth } from "@/lib/auth";
import { getAdminAgentCommissionQueueData, getAdminAgentsData } from "@/lib/agents/service";

export const dynamic = "force-dynamic";

export default async function AdminAgentCommissionsPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string; queue?: string; agentId?: string; page?: string }>;
}) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role ?? "";
  if (!session) redirect("/admin/login");
  if (role !== "ADMIN" && role !== "SUPERVISOR") redirect("/not-authorized");

  const params = (await searchParams) || {};
  const queue = params.queue?.trim() || "all";
  const q = params.q?.trim() || "";
  const agentId = params.agentId?.trim() || "all";
  const page = Math.max(1, Number(params.page || "1"));

  const [result, agents] = await Promise.all([
    getAdminAgentCommissionQueueData({ q: q || undefined, queue, agentId }),
    getAdminAgentsData(undefined, "all", "all", "newest"),
  ]);

  const preparedRows = result.rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }));
  const queueCounts = {
    all: preparedRows.length,
    locked: preparedRows.filter((row) => row.queue === "locked").length,
    pending: preparedRows.filter((row) => row.queue === "pending").length,
    available: preparedRows.filter((row) => row.queue === "available").length,
    paid: preparedRows.filter((row) => row.queue === "paid").length,
  };
  const summaryCards = [
    { label: "Locked", value: result.summary.locked, tone: "text-rose-200" },
    { label: "Pending Review", value: result.summary.pending, tone: "text-amber-200" },
    { label: "Available For Withdrawal", value: result.summary.available, tone: "text-cyan-200" },
    { label: "Paid", value: result.summary.paid, tone: "text-emerald-200" },
  ];

  const pageSize = 25;
  const totalPages = Math.max(1, Math.ceil(preparedRows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedRows = preparedRows.slice((safePage - 1) * pageSize, safePage * pageSize);

  function buildHref(next: Record<string, string | number | undefined>) {
    const query = new URLSearchParams();
    const finalParams = { q, queue, agentId, page: safePage, ...next };
    for (const [key, value] of Object.entries(finalParams)) {
      if (!value || value === "all") continue;
      query.set(key, String(value));
    }
    const serialized = query.toString();
    return serialized ? `/admin/agents/commissions?${serialized}` : "/admin/agents/commissions";
  }

  const queueTabs = [
    { key: "all", label: "All", count: queueCounts.all },
    { key: "locked", label: "Locked", count: queueCounts.locked },
    { key: "pending", label: "Pending Review", count: queueCounts.pending },
    { key: "available", label: "Available", count: queueCounts.available },
    { key: "paid", label: "Paid", count: queueCounts.paid },
  ];
  const formatMoney = (value: number) =>
    new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(value || 0);

  return (
    <div className="space-y-8">
      <section className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,.95),rgba(2,6,23,.98))] p-8">
        <div className="space-y-3">
          <div className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-300">Agent commissions</div>
          <h1 className="text-4xl font-semibold tracking-tight text-white">Commission control console</h1>
          <p className="max-w-4xl text-sm text-slate-400">
            Track locked commissions, review unlocked earnings, and see what is already available for withdrawal or paid out.
          </p>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          {queueTabs.map((tab) => {
            const active = queue === tab.key || (queue === "all" && tab.key === "all");
            return (
              <Link
                key={tab.key}
                href={buildHref({ queue: tab.key === "all" ? undefined : tab.key, page: 1 })}
                className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-semibold transition ${
                  active
                    ? "border-amber-400/30 bg-amber-400/12 text-amber-100"
                    : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/20"
                }`}
              >
                <span>{tab.label}</span>
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px]">{tab.count}</span>
              </Link>
            );
          })}
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((card) => (
            <div key={card.label} className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
              <div className="text-xs uppercase tracking-[0.22em] text-slate-500">{card.label}</div>
              <div className={`mt-3 text-2xl font-semibold ${card.tone}`}>{formatMoney(card.value)}</div>
            </div>
          ))}
        </div>

        <form className="mt-6 grid gap-4 rounded-[26px] border border-white/10 bg-white/[0.03] p-5 md:grid-cols-[1.4fr_220px_160px]">
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Search customer, phone, agent, order, or referral code"
            className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-slate-100 outline-none transition focus:border-amber-400/60"
          />
          <select
            name="agentId"
            defaultValue={agentId}
            className="rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-slate-100 outline-none transition focus:border-amber-400/60"
          >
            <option value="all">All agents</option>
            {agents.map((agent) => (
              <option key={agent.profile.userId} value={agent.profile.userId}>
                {agent.displayName}
              </option>
            ))}
          </select>
          <button type="submit" className="rounded-2xl bg-amber-300 px-4 py-3 font-semibold text-slate-950 transition hover:brightness-95">
            Apply filters
          </button>
        </form>
      </section>

      <AgentCommissionsAdminClient rows={pagedRows} />

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,.9),rgba(2,6,23,.95))] px-5 py-4 text-sm text-slate-300">
        <div>Showing {(safePage - 1) * pageSize + 1}-{Math.min(safePage * pageSize, preparedRows.length)} of {preparedRows.length} commission rows</div>
        <div className="flex items-center gap-3">
          <Link href={buildHref({ page: Math.max(1, safePage - 1) })} className={`rounded-xl border px-4 py-2 font-semibold ${safePage <= 1 ? "pointer-events-none border-white/5 text-slate-600" : "border-white/10 text-slate-100 hover:border-white/20"}`}>
            Previous
          </Link>
          <span className="text-xs uppercase tracking-[0.18em] text-slate-500">Page {safePage} / {totalPages}</span>
          <Link href={buildHref({ page: Math.min(totalPages, safePage + 1) })} className={`rounded-xl border px-4 py-2 font-semibold ${safePage >= totalPages ? "pointer-events-none border-white/5 text-slate-600" : "border-white/10 text-slate-100 hover:border-white/20"}`}>
            Next
          </Link>
        </div>
      </div>
    </div>
  );
}
