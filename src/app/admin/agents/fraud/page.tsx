import Link from "next/link";
import { redirect } from "next/navigation";
import AgentFraudAdminClient from "@/app/admin/agents/AgentFraudAdminClient";
import AgentOpsSectionNav from "@/app/admin/agents/_components/AgentOpsSectionNav";
import { auth } from "@/lib/auth";
import { getAdminAgentFraudQueueData, getAdminAgentsData } from "@/lib/agents/service";

export const dynamic = "force-dynamic";

export default async function AdminAgentFraudPage({
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
    getAdminAgentFraudQueueData({ q: q || undefined, queue, agentId }),
    getAdminAgentsData(undefined, "all", "all", "newest"),
  ]);

  const preparedRows = result.rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }));
  const queueCounts = {
    all: preparedRows.length,
    duplicate_customers: preparedRows.filter((row) => row.queue === "duplicate_customers").length,
    phone_reuse: preparedRows.filter((row) => row.queue === "phone_reuse").length,
    suspicious_agents: preparedRows.filter((row) => row.queue === "suspicious_agents").length,
    disputes: preparedRows.filter((row) => row.queue === "disputes").length,
  };

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
    return serialized ? `/admin/agents/fraud?${serialized}` : "/admin/agents/fraud";
  }

  const queueTabs = [
    { key: "all", label: "All Alerts", count: queueCounts.all },
    { key: "duplicate_customers", label: "Duplicate Customers", count: queueCounts.duplicate_customers },
    { key: "phone_reuse", label: "Phone Reuse", count: queueCounts.phone_reuse },
    { key: "suspicious_agents", label: "Suspicious Agents", count: queueCounts.suspicious_agents },
    { key: "disputes", label: "Disputes", count: queueCounts.disputes },
  ];
  const activeQueueHref = buildHref({ queue: queue === "all" ? undefined : queue, page: 1 });
  const secondaryItems = queueTabs.map((tab) => ({
    href: buildHref({ queue: tab.key === "all" ? undefined : tab.key, page: 1 }),
    label: tab.label,
    count: tab.count,
  }));
  const summaryCards = [
    { label: "Total Alerts", value: result.summary.total, tone: "text-white" },
    { label: "High Risk", value: result.summary.high, tone: "text-rose-200" },
    { label: "Medium Risk", value: result.summary.medium, tone: "text-amber-200" },
    { label: "Ownership Disputes", value: result.summary.disputes, tone: "text-cyan-200" },
  ];

  return (
    <div className="space-y-8">
      <section className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,.95),rgba(2,6,23,.98))] p-8">
        <div className="space-y-3">
          <div className="text-xs font-semibold uppercase tracking-[0.28em] text-rose-300">Fraud & duplicates</div>
          <h1 className="text-4xl font-semibold tracking-tight text-white">Lead protection console</h1>
          <p className="max-w-4xl text-sm text-slate-400">
            Detect duplicate customers, repeated phone reuse, suspicious agents, and ownership disputes before they turn into payout errors.
          </p>
        </div>

        <div className="mt-6">
          <AgentOpsSectionNav activeHref={activeQueueHref} secondaryItems={secondaryItems} />
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((card) => (
            <div key={card.label} className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
              <div className="text-xs uppercase tracking-[0.22em] text-slate-500">{card.label}</div>
              <div className={`mt-3 text-2xl font-semibold ${card.tone}`}>{card.value}</div>
            </div>
          ))}
        </div>

        <form className="mt-6 grid gap-4 rounded-[26px] border border-white/10 bg-white/[0.03] p-5 md:grid-cols-[1.4fr_220px_160px]">
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Search customer, phone, agent, county, or note"
            className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-slate-100 outline-none transition focus:border-rose-400/60"
          />
          <select
            name="agentId"
            defaultValue={agentId}
            className="rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-slate-100 outline-none transition focus:border-rose-400/60"
          >
            <option value="all">All agents</option>
            {agents.map((agent) => (
              <option key={agent.profile.userId} value={agent.profile.userId}>
                {agent.displayName}
              </option>
            ))}
          </select>
          <button type="submit" className="rounded-2xl bg-rose-400 px-4 py-3 font-semibold text-slate-950 transition hover:brightness-95">
            Apply filters
          </button>
        </form>
      </section>

      <AgentFraudAdminClient rows={pagedRows} />

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,.9),rgba(2,6,23,.95))] px-5 py-4 text-sm text-slate-300">
        <div>Showing {(safePage - 1) * pageSize + 1}-{Math.min(safePage * pageSize, preparedRows.length)} of {preparedRows.length} alerts</div>
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
