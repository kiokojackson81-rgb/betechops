import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, ReceiptText } from "lucide-react";
import AgentPortalShell from "@/app/agents/_components/AgentPortalShell";
import { requireAgentSession } from "@/lib/agents/auth";
import { agentPath } from "@/lib/agents/host";
import { getAgentDashboardData } from "@/lib/agents/service";
import { getAgentSalesDashboardSummary, getAgentSaleStatusMeta } from "@/lib/agents/sales";

const money = (value: number) =>
  new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  }).format(value || 0);

function statusBadge(status: string) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "completed") return "bg-[#edf9f0] text-[#136233]";
  if (normalized === "rejected" || normalized === "cancelled") return "bg-[#fdecec] text-[#8d1f1f]";
  if (normalized === "processing" || normalized === "dispatched") return "bg-[#eef6ff] text-[#174c7a]";
  if (normalized === "delivered_pending_balance") return "bg-[#fff3cf] text-[#7a5300]";
  return "bg-[#fffaf5] text-slate-700";
}

type AgentSalesPageProps = {
  useRootPaths?: boolean;
};

export default async function AgentSalesPage({ useRootPaths = false }: AgentSalesPageProps) {
  const agentSession = await requireAgentSession();
  if (!agentSession) redirect(agentPath("/login"));
  if (String(agentSession.agentStatus || "").toLowerCase() !== "approved") {
    redirect(agentPath("/dashboard", useRootPaths));
  }

  const [dashboard, { sales, summary }] = await Promise.all([
    getAgentDashboardData(agentSession.userId),
    getAgentSalesDashboardSummary(agentSession.userId),
  ]);

  if (!dashboard) redirect(agentPath("/register"));

  const cards = [
    { label: "Total submitted sales", value: String(summary.totalSubmittedSales), note: "Every sale you have logged so far" },
    { label: "Pending sales", value: String(summary.pendingSales), note: "Review and payment stages" },
    { label: "Processing / dispatched", value: String(summary.processingSales), note: "Already moving through operations" },
    { label: "Completed sales", value: String(summary.completedSales), note: "Paid in full and delivered or collected" },
    { label: "Potential commission", value: money(summary.potentialCommission), note: "Locked until completed" },
    { label: "Earned commission", value: money(summary.earnedCommission), note: "Unlocked but not yet paid out" },
  ];

  return (
    <AgentPortalShell
      useRootPaths={useRootPaths}
      title="My Sales"
      description="Review every submitted customer, see what stage they are in, and understand which commissions are still locked versus already earned."
      agent={{
        displayName: dashboard.displayName,
        email: dashboard.profile.email || dashboard.profile.user.email,
        status: String(dashboard.profile.status || ""),
        referralCode: dashboard.profile.referralCode,
        payoutPhone: dashboard.profile.phone,
      }}
      stats={{
        potentialCommission: dashboard.salesSummary.potentialCommission,
        earnedCommission: dashboard.salesSummary.earnedCommission,
        paidCommission: dashboard.salesSummary.paidCommission,
      }}
    >
      <div className="space-y-5 sm:space-y-6">
        <section className="grid gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-3">
          {cards.map((card) => (
            <div key={card.label} className="rounded-[26px] border border-[#e4d4cb] bg-white p-4 shadow-[0_12px_40px_rgba(64,32,18,0.06)] sm:p-5">
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[#7a0000]">{card.label}</div>
              <div className="mt-3 text-2xl font-black tracking-tight text-[#210505] sm:text-3xl">{card.value}</div>
              <p className="mt-2 text-sm text-slate-600">{card.note}</p>
            </div>
          ))}
        </section>

        <section className="rounded-[28px] border border-[#e4d4cb] bg-white p-4 shadow-[0_12px_40px_rgba(64,32,18,0.08)] sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#7a0000]">Sales list</p>
              <h2 className="mt-2 text-xl font-black tracking-tight text-[#210505] sm:text-2xl">Every submitted customer</h2>
              <p className="mt-2 text-sm text-slate-600">Potential commission appears immediately but remains locked until the sale is fully complete.</p>
            </div>
            <Link
              href={agentPath("/sales/new", useRootPaths)}
              className="w-full rounded-2xl bg-[#7a0000] px-5 py-3 text-center text-sm font-semibold text-white transition hover:brightness-95 sm:w-auto"
            >
              Submit new sale
            </Link>
          </div>

          <div className="mt-6 space-y-4">
            {sales.length ? sales.map((sale) => {
              const status = getAgentSaleStatusMeta(sale.status);
              return (
                <article key={sale.id} className="rounded-[26px] border border-[#ece1d9] bg-[#fffaf5] p-4 sm:p-5">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="text-lg font-semibold text-[#210505] sm:text-xl">{sale.customerName}</h3>
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${statusBadge(sale.status)}`}>
                          {status.label}
                        </span>
                        <span className="rounded-full bg-white px-3 py-1 text-xs text-slate-600 shadow-sm">
                          {sale.paymentType.replace(/_/g, " ")}
                        </span>
                      </div>
                      <div className="grid gap-2 text-sm text-slate-600 sm:grid-cols-2 xl:grid-cols-4">
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
                    <div className="w-full rounded-[24px] border border-[#f1b81d]/25 bg-[#fff3cf] p-4 xl:min-w-[260px] xl:max-w-[320px]">
                      <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[#7a0000]">{sale.commissionLabel}</div>
                      <div className="mt-3 text-2xl font-black tracking-tight text-[#210505] sm:text-3xl">{money(sale.commissionAmount)}</div>
                      <div className="mt-2 inline-flex rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#7a0000]">
                        {sale.commissionBadge}
                      </div>
                      <p className="mt-3 text-sm text-[#6e5500]">{sale.commissionExplanation}</p>
                    </div>
                  </div>

                  <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                    <Link
                      href={agentPath(`/sales/${sale.id}`, useRootPaths)}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-[#d6c0b5] bg-white px-4 py-2 text-sm font-semibold text-[#7a0000] transition hover:-translate-y-0.5 sm:w-auto"
                    >
                      View sale <ArrowRight className="h-4 w-4" />
                    </Link>
                    {sale.receiptId ? (
                      <Link
                        href={`/receipts/${sale.receiptId}`}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-[#d6c0b5] bg-white px-4 py-2 text-sm text-slate-700 transition hover:-translate-y-0.5 sm:w-auto"
                      >
                        <ReceiptText className="h-4 w-4" />
                        Open receipt
                      </Link>
                    ) : null}
                  </div>
                </article>
              );
            }) : (
              <div className="rounded-[24px] border border-dashed border-[#d9c6ba] bg-[#fffaf5] p-10 text-center text-slate-500">
                No submitted sales yet. Use “Submit new sale” to start tracking potential commission.
              </div>
            )}
          </div>
        </section>
      </div>
    </AgentPortalShell>
  );
}
