"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type AdminSaleRow = {
  id: string;
  agentId: string;
  agentName: string;
  customerName: string;
  customerPhone: string;
  customerLocation: string;
  productName: string;
  quantity: number;
  totalAmount: number;
  amountPaid: number;
  balance: number;
  paymentType: string;
  deliveryMethod: string | null;
  status: string;
  statusMeta: { label: string; note: string };
  commissionAmount: number;
  commissionBadge: string;
  receiptId: string | null;
  receiptNumber: string | null;
  createdAt: string;
};

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

export default function AgentSalesAdminClient({ sales }: { sales: AdminSaleRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function patchStatus(saleId: string, status: string) {
    setBusy(`${saleId}:${status}`);
    const res = await fetch(`/api/admin/agents/sales/${saleId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setBusy(null);
    if (!res.ok) {
      const payload = await res.json().catch(() => ({ error: "Unable to update sale status." }));
      window.alert(payload.error || "Unable to update sale status.");
      return;
    }
    startTransition(() => router.refresh());
  }

  async function completeSale(saleId: string) {
    setBusy(`${saleId}:complete`);
    const res = await fetch(`/api/admin/agents/sales/${saleId}/complete`, { method: "POST" });
    setBusy(null);
    if (!res.ok) {
      const payload = await res.json().catch(() => ({ error: "Unable to complete sale." }));
      window.alert(payload.error || "Unable to complete sale.");
      return;
    }
    startTransition(() => router.refresh());
  }

  if (!sales.length) {
    return (
      <div className="rounded-[28px] border border-white/10 bg-slate-950/70 p-8 text-slate-300">
        No agent sales matched the current filters.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {sales.map((sale) => (
        <article
          key={sale.id}
          className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,.96),rgba(2,6,23,.96))] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.35)]"
        >
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-2xl font-semibold text-white">{sale.customerName}</h2>
                <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${statusBadge(sale.status)}`}>
                  {sale.statusMeta.label}
                </span>
                <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300">
                  {sale.paymentType.replace(/_/g, " ")}
                </span>
              </div>
              <div className="grid gap-2 text-sm text-slate-400 md:grid-cols-2 xl:grid-cols-4">
                <div>Agent: {sale.agentName}</div>
                <div>Phone: {sale.customerPhone}</div>
                <div>Location: {sale.customerLocation}</div>
                <div>Product: {sale.productName}</div>
                <div>Total: {money(sale.totalAmount)}</div>
                <div>Paid: {money(sale.amountPaid)}</div>
                <div>Balance: {money(sale.balance)}</div>
                <div>Receipt: {sale.receiptNumber || "Not linked"}</div>
              </div>
              <p className="text-sm text-slate-500">{sale.statusMeta.note}</p>
            </div>

            <div className="min-w-[260px] rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Commission preview</div>
              <div className="mt-3 text-3xl font-semibold text-white">{money(sale.commissionAmount)}</div>
              <div className="mt-2 text-xs text-amber-200">{sale.commissionBadge}</div>
              <div className="mt-3 text-xs text-slate-500">Submitted {new Date(sale.createdAt).toLocaleString()}</div>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href={`/admin/agents/sales/${sale.id}`}
              className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:border-cyan-300/30"
            >
              Review sale
            </Link>
            <button
              onClick={() => patchStatus(sale.id, "payment_confirmed")}
              disabled={busy !== null}
              className="rounded-2xl border border-white/10 px-4 py-2 text-sm text-slate-200 transition hover:border-white/20 disabled:opacity-60"
            >
              {busy === `${sale.id}:payment_confirmed` ? "Saving..." : "Confirm payment"}
            </button>
            <button
              onClick={() => patchStatus(sale.id, "processing")}
              disabled={busy !== null}
              className="rounded-2xl border border-white/10 px-4 py-2 text-sm text-slate-200 transition hover:border-white/20 disabled:opacity-60"
            >
              {busy === `${sale.id}:processing` ? "Saving..." : "Mark processing"}
            </button>
            <button
              onClick={() => patchStatus(sale.id, "dispatched")}
              disabled={busy !== null}
              className="rounded-2xl border border-white/10 px-4 py-2 text-sm text-slate-200 transition hover:border-white/20 disabled:opacity-60"
            >
              {busy === `${sale.id}:dispatched` ? "Saving..." : "Mark dispatched"}
            </button>
            <button
              onClick={() => patchStatus(sale.id, "delivered_pending_balance")}
              disabled={busy !== null}
              className="rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-2 text-sm font-semibold text-amber-100 disabled:opacity-60"
            >
              {busy === `${sale.id}:delivered_pending_balance` ? "Saving..." : "Delivered pending balance"}
            </button>
            <button
              onClick={() => completeSale(sale.id)}
              disabled={busy !== null}
              className="rounded-2xl bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-60"
            >
              {busy === `${sale.id}:complete` ? "Completing..." : "Mark completed"}
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}
