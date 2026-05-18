import { redirect } from "next/navigation";
import Link from "next/link";
import AgentSalesAdminClient from "@/app/admin/agents/AgentSalesAdminClient";
import AgentOpsSectionNav from "@/app/admin/agents/_components/AgentOpsSectionNav";
import { auth } from "@/lib/auth";
import { getAdminAgentSales } from "@/lib/agents/sales";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminAgentPendingSalesPage({
  searchParams,
}: {
  searchParams?: Promise<{
    q?: string;
    status?: string;
    agentId?: string;
    paymentType?: string;
    start?: string;
    end?: string;
    queue?: string;
    page?: string;
  }>;
}) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role ?? "";
  if (!session) redirect("/admin/login");
  if (role !== "ADMIN") redirect("/not-authorized");

  const params = (await searchParams) || {};
  const queue = params.queue?.trim() || "all";
  const page = Math.max(1, Number(params.page || "1"));
  const queueStatuses =
    queue === "new"
      ? ["pending_review"]
      : queue === "under_review"
        ? ["awaiting_payment"]
        : queue === "payment_verified"
          ? ["payment_confirmed"]
          : queue === "processing"
            ? ["processing", "dispatched"]
            : queue === "delivered"
              ? ["delivered_pending_balance"]
              : queue === "completed"
                ? ["completed"]
                : queue === "cancelled"
                  ? ["cancelled", "rejected"]
                  : undefined;
  const [sales, baseSales, agents] = await Promise.all([
    getAdminAgentSales({
      q: params.q?.trim() || undefined,
      status: params.status?.trim() || undefined,
      statuses: queueStatuses,
      agentId: params.agentId?.trim() || undefined,
      paymentType: params.paymentType?.trim() || undefined,
      start: params.start?.trim() || undefined,
      end: params.end?.trim() || undefined,
    }),
    getAdminAgentSales({
      q: params.q?.trim() || undefined,
      agentId: params.agentId?.trim() || undefined,
      paymentType: params.paymentType?.trim() || undefined,
      start: params.start?.trim() || undefined,
      end: params.end?.trim() || undefined,
    }),
    prisma.agentProfile.findMany({
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const preparedSales = sales.map((sale) => ({
    ...sale,
    createdAt: sale.createdAt.toISOString(),
    updatedAt: sale.updatedAt.toISOString(),
    completedAt: sale.completedAt ? sale.completedAt.toISOString() : null,
    ownershipWindowEndsAt: sale.ownershipWindowEndsAt ? sale.ownershipWindowEndsAt.toISOString() : null,
  }));
  const preparedBaseSales = baseSales.map((sale) => ({
    ...sale,
    createdAt: sale.createdAt.toISOString(),
    updatedAt: sale.updatedAt.toISOString(),
    completedAt: sale.completedAt ? sale.completedAt.toISOString() : null,
    ownershipWindowEndsAt: sale.ownershipWindowEndsAt ? sale.ownershipWindowEndsAt.toISOString() : null,
  }));
  const queueCounts = {
    all: preparedBaseSales.length,
    new: preparedBaseSales.filter((sale) => sale.status === "pending_review").length,
    under_review: preparedBaseSales.filter((sale) => sale.status === "awaiting_payment").length,
    payment_verified: preparedBaseSales.filter((sale) => sale.status === "payment_confirmed").length,
    processing: preparedBaseSales.filter((sale) => ["processing", "dispatched"].includes(sale.status)).length,
    delivered: preparedBaseSales.filter((sale) => sale.status === "delivered_pending_balance").length,
    completed: preparedBaseSales.filter((sale) => sale.status === "completed").length,
    cancelled: preparedBaseSales.filter((sale) => ["cancelled", "rejected"].includes(sale.status)).length,
  };

  const summaryCards = [
    { label: "Total Sales", value: preparedSales.length, tone: "text-white" },
    {
      label: "Processing",
      value: preparedSales.filter((sale) => sale.status === "processing").length,
      tone: "text-cyan-200",
    },
    {
      label: "Delivered / Collected",
      value: preparedSales.filter((sale) => sale.status === "delivered_pending_balance").length,
      tone: "text-amber-200",
    },
    {
      label: "Completed",
      value: preparedSales.filter((sale) => sale.status === "completed").length,
      tone: "text-emerald-200",
    },
    {
      label: "Order Value",
      value: new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(
        preparedSales.reduce((sum, sale) => sum + sale.totalAmount, 0),
      ),
      tone: "text-white",
    },
    {
      label: "Pending Commissions",
      value: new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(
        preparedSales.filter((sale) => sale.status !== "completed").reduce((sum, sale) => sum + sale.commissionAmount, 0),
      ),
      tone: "text-amber-200",
    },
  ];
  const pageSize = 25;
  const totalPages = Math.max(1, Math.ceil(preparedSales.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedSales = preparedSales.slice((safePage - 1) * pageSize, safePage * pageSize);

  function buildHref(next: Record<string, string | number | undefined>) {
    const query = new URLSearchParams();
    const finalParams = {
      q: params.q?.trim() || "",
      status: params.status?.trim() || "all",
      agentId: params.agentId?.trim() || "all",
      paymentType: params.paymentType?.trim() || "all",
      start: params.start?.trim() || "",
      end: params.end?.trim() || "",
      queue,
      page: safePage,
      ...next,
    };
    for (const [key, value] of Object.entries(finalParams)) {
      if (value === undefined || value === "" || value === "all") continue;
      query.set(key, String(value));
    }
    const serialized = query.toString();
    return serialized ? `/admin/agents/pending-sales?${serialized}` : "/admin/agents/pending-sales";
  }

  const queueTabs = [
    { key: "all", label: "All Sales", count: queueCounts.all },
    { key: "new", label: "New", count: queueCounts.new },
    { key: "under_review", label: "Under Review", count: queueCounts.under_review },
    { key: "payment_verified", label: "Payment Verified", count: queueCounts.payment_verified },
    { key: "processing", label: "Processing", count: queueCounts.processing },
    { key: "delivered", label: "Delivered", count: queueCounts.delivered },
    { key: "completed", label: "Completed", count: queueCounts.completed },
    { key: "cancelled", label: "Cancelled / Rejected", count: queueCounts.cancelled },
  ];
  const activeQueueHref = buildHref({ queue: queue === "all" ? undefined : queue, page: 1 });
  const secondaryItems = queueTabs.map((tab) => ({
    href: buildHref({ queue: tab.key === "all" ? undefined : tab.key, page: 1 }),
    label: tab.label,
    count: tab.count,
  }));

  return (
    <div className="space-y-8">
      <section className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,.95),rgba(2,6,23,.98))] p-8">
        <div className="space-y-3">
          <div className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-300">Agent sales admin</div>
          <h1 className="text-4xl font-semibold tracking-tight text-white">Pending sales management</h1>
          <p className="max-w-4xl text-sm text-slate-400">
            Scan submitted customer orders quickly, move them through payment and delivery, and unlock commission only when completed.
          </p>
        </div>

        <div className="mt-6">
          <AgentOpsSectionNav activeHref={activeQueueHref} secondaryItems={secondaryItems} />
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
          {summaryCards.map((card) => (
            <div
              key={card.label}
              className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4 shadow-[0_18px_40px_rgba(0,0,0,0.18)]"
            >
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">{card.label}</div>
              <div className={`mt-3 text-2xl font-semibold ${card.tone}`}>{card.value}</div>
            </div>
          ))}
        </div>

        <form className="mt-6 grid gap-4 rounded-[26px] border border-white/10 bg-white/[0.03] p-5 md:grid-cols-3 xl:grid-cols-6">
          <input
            type="text"
            name="q"
            defaultValue={params.q || ""}
            placeholder="Search customer, phone, product, or agent"
            className="rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-slate-100 outline-none focus:border-emerald-400/60 xl:col-span-2"
          />
          <select
            name="status"
            defaultValue={params.status || "all"}
            className="rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-slate-100 outline-none focus:border-emerald-400/60"
          >
            <option value="all">All statuses</option>
            <option value="pending_review">Pending review</option>
            <option value="awaiting_payment">Awaiting payment</option>
            <option value="payment_confirmed">Payment confirmed</option>
            <option value="processing">Processing</option>
            <option value="dispatched">Dispatched</option>
            <option value="delivered_pending_balance">Delivered pending balance</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="rejected">Rejected</option>
          </select>
          <select
            name="agentId"
            defaultValue={params.agentId || "all"}
            className="rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-slate-100 outline-none focus:border-emerald-400/60"
          >
            <option value="all">All agents</option>
            {agents.map((agent) => (
              <option key={agent.userId} value={agent.userId}>
                {agent.firstName || agent.user.name || agent.user.email || agent.referralCode}
              </option>
            ))}
          </select>
          <select
            name="paymentType"
            defaultValue={params.paymentType || "all"}
            className="rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-slate-100 outline-none focus:border-emerald-400/60"
          >
            <option value="all">All payment types</option>
            <option value="transport_fee">Transport fee</option>
            <option value="deposit">Deposit</option>
            <option value="full_payment">Full payment</option>
          </select>
          <button type="submit" className="rounded-2xl bg-emerald-400 px-4 py-3 font-semibold text-slate-950 transition hover:brightness-95">
            Apply filters
          </button>
          <input
            type="date"
            name="start"
            defaultValue={params.start || ""}
            className="rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-slate-100 outline-none focus:border-emerald-400/60"
          />
          <input
            type="date"
            name="end"
            defaultValue={params.end || ""}
            className="rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-slate-100 outline-none focus:border-emerald-400/60"
          />
        </form>
      </section>

      <AgentSalesAdminClient sales={pagedSales} />

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,.9),rgba(2,6,23,.95))] px-5 py-4 text-sm text-slate-300">
        <div>
          Showing {(safePage - 1) * pageSize + 1}-{Math.min(safePage * pageSize, preparedSales.length)} of {preparedSales.length} sales
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
