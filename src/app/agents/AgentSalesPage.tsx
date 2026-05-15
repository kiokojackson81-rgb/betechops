import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, ReceiptText } from "lucide-react";
import { requireAgentSession } from "@/lib/agents/auth";
import { agentPath } from "@/lib/agents/host";
import { getAgentSalesDashboardSummary, getAgentSaleStatusMeta } from "@/lib/agents/sales";

const money = (value: number) =>
  new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(value || 0);

function statusBadge(status: string) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "completed") return "border-emerald-400/20 bg-emerald-400/10 text-emerald-200";
  if (normalized === "rejected" || normalized === "cancelled") return "border-rose-400/20 bg-rose-400/10 text-rose-200";
  if (normalized === "processing" || normalized === "dispatched") return "border-cyan-400/20 bg-cyan-400/10 text-cyan-200";
  if (normalized === "delivered_pending_balance") return "border-amber-400/20 bg-amber-400/10 text-amber-200";
  return "border-white/10 bg-white/[0.04] text-slate-200";
}

type AgentSalesPageProps = {
  useRootPaths?: boolean;
};

export default async function AgentSalesPage({ useRootPaths = false }: AgentSalesPageProps) {
  const agentSession = await requireAgentSession();
  if (!agentSession) redirect(agentPath("/login", useRootPaths));
  if (String(agentSession.agentStatus || "").toLowerCase() !== "approved") {
    redirect(agentPath("/dashboard", useRootPaths));
  }

  const { sales, summary } = await getAgentSalesDashboardSummary(agentSession.userId);
  const cards = [
    { label: "Total submitted sales", value: String(summary.totalSubmittedSales), note: "All sales you have submitted" },
    { label: "Pending sales", value: String(summary.pendingSales), note: "Under review or awaiting payment" },
    { label: "Processing / dispatched", value: String(summary.processingSales), note: "Already moving through operations" },
    { label: "Completed sales", value: String(summary.completedSales), note: "Fully paid and delivered or collected" },
    { label: "Potential commission", value: money(summary.potentialCommission), note: "Locked until completion" },
    { label: "Earned commission", value: money(summary.earnedCommission), note: "Unlocked but not yet paid" },
    { label: "Paid commission", value: money(summary.paidCommission), note: "Already settled to you" },
  ];

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(20,184,166,0.16),transparent_25%),linear-gradient(180deg,#020617_0%,#0f172a_60%,#020617_100%)] px-6 py-10 text-slate-100">
      <div className="mx-auto max-w-7xl space-y-8">
        <section className="rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,.96),rgba(2,6,23,.98))] p-8 shadow-[0_24px_80px_rgba(0,0,0,.35)]">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-300">Sales pipeline</p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white">Track submitted sales and locked commission</h1>
              <p className="mt-3 max-w-3xl text-sm text-slate-400">
                Every sale shows the potential commission immediately. It only unlocks after the customer pays fully and delivery or collection is confirmed.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href={agentPath("/sales/new", useRootPaths)}
                className="rounded-2xl bg-emerald-400 px-5 py-3 font-semibold text-slate-950 transition hover:brightness-95"
              >
                Submit new sale
              </Link>
              <Link
                href={agentPath("/dashboard", useRootPaths)}
                className="rounded-2xl border border-white/10 px-5 py-3 font-semibold text-white transition hover:border-white/20"
              >
                Back to dashboard
              </Link>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => (
            <div key={card.label} className="rounded-[28px] border border-white/10 bg-slate-950/75 p-5">
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">{card.label}</div>
              <div className="mt-3 text-3xl font-semibold text-white">{card.value}</div>
              <p className="mt-2 text-sm text-slate-400">{card.note}</p>
            </div>
          ))}
        </section>

        <section className="rounded-[32px] border border-white/10 bg-white/[0.04] p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold text-white">My submitted sales</h2>
              <p className="mt-2 text-sm text-slate-400">Open each sale to see status, receipt linking, and commission state.</p>
            </div>
            <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
              Potential commission stays locked until completion.
            </div>
          </div>

          <div className="mt-6 space-y-4">
            {sales.length ? sales.map((sale) => {
              const status = getAgentSaleStatusMeta(sale.status);
              const commissionTitle = sale.status === "completed" ? "Earned commission" : "Potential commission";
              return (
                <article key={sale.id} className="rounded-[28px] border border-white/10 bg-slate-950/70 p-5">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="text-xl font-semibold text-white">{sale.customerName}</h3>
                        <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${statusBadge(sale.status)}`}>
                          {status.label}
                        </span>
                        <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300">
                          {sale.paymentType.replace(/_/g, " ")}
                        </span>
                      </div>
                      <div className="grid gap-2 text-sm text-slate-400 md:grid-cols-2 xl:grid-cols-4">
                        <div>Phone: {sale.customerPhone}</div>
                        <div>Location: {sale.customerLocation}</div>
                        <div>Product: {sale.productName}</div>
                        <div>Delivery: {sale.deliveryMethod || "Not set"}</div>
                        <div>Total: {money(sale.totalAmount)}</div>
                        <div>Paid: {money(sale.amountPaid)}</div>
                        <div>Balance: {money(sale.balance)}</div>
                        <div>Receipt: {sale.receiptNumber || "Not linked"}</div>
                      </div>
                      <p className="text-sm text-slate-500">{status.note}</p>
                    </div>
                    <div className="min-w-[260px] rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">{commissionTitle}</div>
                      <div className="mt-3 text-3xl font-semibold text-white">{money(sale.commissionAmount)}</div>
                      <div className="mt-2 inline-flex rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-amber-100">
                        {sale.commissionBadge}
                      </div>
                      <p className="mt-3 text-sm text-slate-400">{sale.commissionExplanation}</p>
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-3">
                    <Link
                      href={agentPath(`/sales/${sale.id}`, useRootPaths)}
                      className="inline-flex items-center gap-2 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:border-cyan-300/30"
                    >
                      View sale <ArrowRight className="h-4 w-4" />
                    </Link>
                    {sale.receiptId ? (
                      <Link
                        href={`/receipts/${sale.receiptId}`}
                        className="inline-flex items-center gap-2 rounded-2xl border border-white/10 px-4 py-2 text-sm text-slate-200 transition hover:border-white/20"
                      >
                        <ReceiptText className="h-4 w-4" />
                        Open receipt
                      </Link>
                    ) : null}
                  </div>
                </article>
              );
            }) : (
              <div className="rounded-[28px] border border-dashed border-white/10 bg-slate-950/50 p-10 text-center text-slate-400">
                No submitted sales yet. Use “Submit new sale” to start tracking potential commission.
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
