import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import AgentPortalShell from "@/app/agents/_components/AgentPortalShell";
import { requireAgentSession } from "@/lib/agents/auth";
import { agentPath } from "@/lib/agents/host";
import { getAgentDashboardData } from "@/lib/agents/service";
import { getAgentSaleById, getAgentSaleStatusMeta } from "@/lib/agents/sales";

const money = (value: number) =>
  new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  }).format(value || 0);

type AgentSaleDetailPageProps = {
  id: string;
  useRootPaths?: boolean;
};

export default async function AgentSaleDetailPage({ id, useRootPaths = false }: AgentSaleDetailPageProps) {
  const agentSession = await requireAgentSession();
  if (!agentSession) redirect(agentPath("/login", useRootPaths));
  if (String(agentSession.agentStatus || "").toLowerCase() !== "approved") {
    redirect(agentPath("/dashboard", useRootPaths));
  }

  const [dashboard, sale] = await Promise.all([
    getAgentDashboardData(agentSession.userId),
    getAgentSaleById(agentSession.userId, id),
  ]);

  if (!dashboard) redirect(agentPath("/register", useRootPaths));
  if (!sale) notFound();

  const status = getAgentSaleStatusMeta(sale.status);

  return (
    <AgentPortalShell
      useRootPaths={useRootPaths}
      title="Sale Detail"
      description="Review the exact customer, payment, delivery, and commission state for this submitted sale."
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
      <div className="space-y-6">
        <section className="rounded-[28px] border border-[#e4d4cb] bg-white p-6 shadow-[0_12px_40px_rgba(64,32,18,0.08)]">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#7a0000]">Customer record</p>
              <h2 className="mt-2 text-3xl font-black tracking-tight text-[#210505]">{sale.customerName}</h2>
              <p className="mt-2 text-sm text-slate-600">{status.note}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href={agentPath("/sales", useRootPaths)}
                className="rounded-2xl border border-[#d9c6ba] bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-[#7a0000]/25"
              >
                Back to sales
              </Link>
              <Link
                href={agentPath("/sales/new", useRootPaths)}
                className="rounded-2xl bg-[#7a0000] px-4 py-3 text-sm font-semibold text-white transition hover:brightness-95"
              >
                Submit another sale
              </Link>
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            <div className="rounded-[28px] border border-[#e4d4cb] bg-white p-6 shadow-[0_12px_40px_rgba(64,32,18,0.08)]">
              <h3 className="text-2xl font-black tracking-tight text-[#210505]">Customer and product</h3>
              <div className="mt-5 grid gap-3 text-sm text-slate-700 md:grid-cols-2">
                <div>Customer: {sale.customerName}</div>
                <div>Phone: {sale.customerPhone}</div>
                <div>Location: {sale.customerLocation}</div>
                <div>County: {sale.customerCounty || "Not set"}</div>
                <div>Product: {sale.productName}</div>
                <div>Category: {sale.productCategory || "Not set"}</div>
                <div>Quantity: {sale.quantity}</div>
                <div>Unit price: {money(sale.unitPrice)}</div>
              </div>
            </div>

            <div className="rounded-[28px] border border-[#e4d4cb] bg-white p-6 shadow-[0_12px_40px_rgba(64,32,18,0.08)]">
              <h3 className="text-2xl font-black tracking-tight text-[#210505]">Payment and delivery</h3>
              <div className="mt-5 grid gap-3 text-sm text-slate-700 md:grid-cols-2">
                <div>Total amount: {money(sale.totalAmount)}</div>
                <div>Amount paid: {money(sale.amountPaid)}</div>
                <div>Balance: {money(sale.balance)}</div>
                <div>Payment type: {sale.paymentType.replace(/_/g, " ")}</div>
                <div>Delivery method: {sale.deliveryMethod || "Not set"}</div>
                <div>Receipt number: {sale.receiptNumber || "Not linked yet"}</div>
                <div>M-Pesa reference: {sale.mpesaReference || "Not provided"}</div>
                <div>Status: {status.label}</div>
              </div>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div className="rounded-[24px] border border-[#ece1d9] bg-[#fffaf5] p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Delivery notes</div>
                  <p className="mt-2 text-sm text-slate-700">{sale.deliveryNotes || "No delivery notes added."}</p>
                </div>
                <div className="rounded-[24px] border border-[#ece1d9] bg-[#fffaf5] p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Customer notes</div>
                  <p className="mt-2 text-sm text-slate-700">{sale.customerNotes || "No customer notes added."}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-[28px] border border-[#f1b81d]/30 bg-[#fff3cf] p-6 shadow-[0_12px_40px_rgba(64,32,18,0.08)]">
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-[#7a0000]">
                {sale.commissionLabel}
              </div>
              <div className="mt-3 text-4xl font-black tracking-tight text-[#210505]">{money(sale.commissionAmount)}</div>
              <div className="mt-3 inline-flex rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#7a0000]">
                {sale.commissionBadge}
              </div>
              <p className="mt-4 text-sm text-[#6e5500]">{sale.commissionExplanation}</p>
            </div>

            <div className="rounded-[28px] border border-[#e4d4cb] bg-white p-6 shadow-[0_12px_40px_rgba(64,32,18,0.08)]">
              <h3 className="text-2xl font-black tracking-tight text-[#210505]">Internal reference</h3>
              <div className="mt-5 space-y-3 text-sm text-slate-700">
                <div>Created: {new Date(sale.createdAt).toLocaleString()}</div>
                <div>Updated: {new Date(sale.updatedAt).toLocaleString()}</div>
                <div>Completed at: {sale.completedAt ? new Date(sale.completedAt).toLocaleString() : "Not completed"}</div>
                <div>Commission status: {sale.commissionStatus}</div>
              </div>
              <div className="mt-5 rounded-[24px] border border-[#ece1d9] bg-[#fffaf5] p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Internal agent notes</div>
                <p className="mt-2 text-sm text-slate-700">{sale.internalAgentNotes || "No internal notes added."}</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </AgentPortalShell>
  );
}
