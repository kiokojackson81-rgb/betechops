import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireAgentSession } from "@/lib/agents/auth";
import { agentPath } from "@/lib/agents/host";
import { getAgentSaleById, getAgentSaleStatusMeta } from "@/lib/agents/sales";

const money = (value: number) =>
  new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(value || 0);

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

  const sale = await getAgentSaleById(agentSession.userId, id);
  if (!sale) notFound();

  const status = getAgentSaleStatusMeta(sale.status);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.16),transparent_25%),linear-gradient(180deg,#020617_0%,#0f172a_60%,#020617_100%)] px-6 py-10 text-slate-100">
      <div className="mx-auto max-w-6xl space-y-8">
        <section className="rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,.96),rgba(2,6,23,.98))] p-8 shadow-[0_24px_80px_rgba(0,0,0,.35)]">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-300">Agent sale detail</p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white">{sale.customerName}</h1>
              <p className="mt-3 max-w-3xl text-sm text-slate-400">{status.note}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href={agentPath("/sales", useRootPaths)}
                className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:border-white/20"
              >
                Back to sales
              </Link>
              <Link
                href={agentPath("/sales/new", useRootPaths)}
                className="rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:brightness-95"
              >
                Submit another sale
              </Link>
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6">
              <h2 className="text-xl font-semibold text-white">Customer and product</h2>
              <div className="mt-5 grid gap-3 text-sm text-slate-300 md:grid-cols-2">
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

            <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6">
              <h2 className="text-xl font-semibold text-white">Payment and delivery</h2>
              <div className="mt-5 grid gap-3 text-sm text-slate-300 md:grid-cols-2">
                <div>Total amount: {money(sale.totalAmount)}</div>
                <div>Amount paid: {money(sale.amountPaid)}</div>
                <div>Balance: {money(sale.balance)}</div>
                <div>Payment type: {sale.paymentType.replace(/_/g, " ")}</div>
                <div>Delivery method: {sale.deliveryMethod || "Not set"}</div>
                <div>Receipt number: {sale.receiptNumber || "Not linked yet"}</div>
                <div>M-PESA reference: {sale.mpesaReference || "Not provided"}</div>
                <div>Status: {status.label}</div>
              </div>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                  <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Delivery notes</div>
                  <p className="mt-2 text-sm text-slate-300">{sale.deliveryNotes || "No delivery notes added."}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                  <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Customer notes</div>
                  <p className="mt-2 text-sm text-slate-300">{sale.customerNotes || "No customer notes added."}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-[28px] border border-amber-400/20 bg-amber-400/10 p-6">
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-100">
                {sale.status === "completed" ? "Earned commission" : "Potential commission"}
              </div>
              <div className="mt-3 text-4xl font-semibold text-white">{money(sale.commissionAmount)}</div>
              <div className="mt-3 inline-flex rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-amber-50">
                {sale.commissionBadge}
              </div>
              <p className="mt-4 text-sm text-amber-50/85">{sale.commissionExplanation}</p>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6">
              <h2 className="text-xl font-semibold text-white">Internal reference</h2>
              <div className="mt-5 space-y-3 text-sm text-slate-300">
                <div>Created: {new Date(sale.createdAt).toLocaleString()}</div>
                <div>Updated: {new Date(sale.updatedAt).toLocaleString()}</div>
                <div>Completed at: {sale.completedAt ? new Date(sale.completedAt).toLocaleString() : "Not completed"}</div>
                <div>Commission status: {sale.commissionStatus}</div>
              </div>
              <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Internal agent notes</div>
                <p className="mt-2 text-sm text-slate-300">{sale.internalAgentNotes || "No internal notes added."}</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
