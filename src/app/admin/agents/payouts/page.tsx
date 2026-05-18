import Link from "next/link";
import { redirect } from "next/navigation";
import AgentPayoutsAdminClient from "@/app/admin/agents/AgentPayoutsAdminClient";
import AgentOpsSectionNav from "@/app/admin/agents/_components/AgentOpsSectionNav";
import { auth } from "@/lib/auth";
import { getAdminAgentPayoutQueueData, getAdminAgentsData } from "@/lib/agents/service";

export const dynamic = "force-dynamic";

export default async function AdminAgentPayoutsPage({
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
    getAdminAgentPayoutQueueData({ q: q || undefined, queue, agentId }),
    getAdminAgentsData(undefined, "all", "all", "newest"),
  ]);

  const preparedRows = result.rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }));
  const queueCounts = {
    all: preparedRows.length,
    requests: preparedRows.filter((row) => row.queue === "requests").length,
    approved: preparedRows.filter((row) => row.queue === "approved").length,
    paid: preparedRows.filter((row) => row.queue === "paid").length,
    rejected: preparedRows.filter((row) => row.queue === "rejected").length,
    held: preparedRows.filter((row) => row.queue === "held").length,
  };
  const summaryCards = [
    { label: "Requests", value: result.summary.requests, tone: "text-white" },
    { label: "Approved", value: result.summary.approved, tone: "text-cyan-200" },
    { label: "Paid", value: result.summary.paid, tone: "text-emerald-200" },
    { label: "Held", value: result.summary.held, tone: "text-amber-200" },
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
    return serialized ? `/admin/agents/payouts?${serialized}` : "/admin/agents/payouts";
  }

  const queueTabs = [
    { key: "all", label: "All", count: queueCounts.all },
    { key: "requests", label: "Requests", count: queueCounts.requests },
    { key: "approved", label: "Approved", count: queueCounts.approved },
    { key: "paid", label: "Paid", count: queueCounts.paid },
    { key: "rejected", label: "Rejected", count: queueCounts.rejected },
    { key: "held", label: "Held", count: queueCounts.held },
  ];
  const activeQueueHref = buildHref({ queue: queue === "all" ? undefined : queue, page: 1 });
  const secondaryItems = queueTabs.map((tab) => ({
    href: buildHref({ queue: tab.key === "all" ? undefined : tab.key, page: 1 }),
    label: tab.label,
    count: tab.count,
  }));
  const formatMoney = (value: number) =>
    new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(value || 0);

  return (
    <div className="space-y-8">
      <section className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,.95),rgba(2,6,23,.98))] p-8">
        <div className="space-y-3">
          <div className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-300">Agent payouts</div>
          <h1 className="text-4xl font-semibold tracking-tight text-white">Withdrawal approval console</h1>
          <p className="max-w-4xl text-sm text-slate-400">
            Review withdrawal requests, hold risky cases, and safely move approved payouts to paid once finance completes M-Pesa release.
          </p>
        </div>

        <div className="mt-6">
          <AgentOpsSectionNav activeHref={activeQueueHref} secondaryItems={secondaryItems} />
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
            placeholder="Search agent, phone, reference, or referral code"
            className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-slate-100 outline-none transition focus:border-emerald-400/60"
          />
          <select
            name="agentId"
            defaultValue={agentId}
            className="rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-slate-100 outline-none transition focus:border-emerald-400/60"
          >
            <option value="all">All agents</option>
            {agents.map((agent) => (
              <option key={agent.profile.userId} value={agent.profile.userId}>
                {agent.displayName}
              </option>
            ))}
          </select>
          <button type="submit" className="rounded-2xl bg-emerald-400 px-4 py-3 font-semibold text-slate-950 transition hover:brightness-95">
            Apply filters
          </button>
        </form>
      </section>

      <AgentPayoutsAdminClient rows={pagedRows} />

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,.9),rgba(2,6,23,.95))] px-5 py-4 text-sm text-slate-300">
        <div>Showing {(safePage - 1) * pageSize + 1}-{Math.min(safePage * pageSize, preparedRows.length)} of {preparedRows.length} payout rows</div>
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
