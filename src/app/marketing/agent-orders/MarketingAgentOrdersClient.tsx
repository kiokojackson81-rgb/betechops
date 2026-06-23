"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { ChevronDown, ChevronRight, Phone } from "lucide-react";

type AgentOrderRow = {
  id: string;
  agentId: string;
  agentName: string;
  customerName: string;
  customerPhone: string;
  customerLocation: string;
  customerCounty?: string | null;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  amountPaid: number;
  balance: number;
  paymentType: string;
  mpesaReference: string | null;
  deliveryMethod: string | null;
  status: string;
  statusMeta: { label: string; note: string };
  commissionAmount: number;
  commissionBadge: string;
  receiptId: string | null;
  receiptNumber: string | null;
  duplicateRisk: "low" | "medium" | "high";
  duplicateCount: number;
  needsReview: boolean;
  ownershipOwnerAgentName: string | null;
  ownershipWindowEndsAt: string | null;
  duplicateNote: string;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

const money = (value: number) =>
  new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(value || 0);

function badgeTone(status: string) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "completed") return "border-emerald-400/20 bg-emerald-400/10 text-emerald-200";
  if (normalized === "cancelled" || normalized === "rejected") return "border-rose-400/20 bg-rose-400/10 text-rose-200";
  if (normalized === "delivered_pending_balance") return "border-amber-400/20 bg-amber-400/10 text-amber-200";
  if (normalized === "processing" || normalized === "dispatched") return "border-cyan-400/20 bg-cyan-400/10 text-cyan-200";
  return "border-sky-400/20 bg-sky-400/10 text-sky-200";
}

function paymentLabel(paymentType: string) {
  return String(paymentType || "").replace(/_/g, " ");
}

function isTerminal(status: string) {
  const normalized = String(status || "").toLowerCase();
  return normalized === "completed" || normalized === "cancelled" || normalized === "rejected";
}

function canMoveTo(status: string, nextStatus: string) {
  const current = String(status || "").toLowerCase();
  const next = String(nextStatus || "").toLowerCase();
  if (current === next || isTerminal(current)) return false;
  if (current === "pending_review" || current === "awaiting_payment" || current === "payment_confirmed") {
    return ["processing", "rejected", "cancelled"].includes(next);
  }
  if (current === "processing") {
    return ["dispatched", "rejected", "cancelled"].includes(next);
  }
  if (current === "dispatched") {
    return ["delivered_pending_balance", "rejected", "cancelled"].includes(next);
  }
  if (current === "delivered_pending_balance") {
    return ["rejected", "cancelled"].includes(next);
  }
  return false;
}

export default function MarketingAgentOrdersClient({ sales }: { sales: AgentOrderRow[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const openCount = useMemo(
    () => sales.filter((sale) => !["completed", "cancelled", "rejected"].includes(String(sale.status || "").toLowerCase())).length,
    [sales],
  );

  async function patchStatus(
    saleId: string,
    status: string,
    extras?: { amountPaid?: number; mpesaReference?: string },
    customBusyKey?: string,
  ) {
    const nextBusyKey = customBusyKey || `${saleId}:${status}`;
    setBusyKey(nextBusyKey);
    const response = await fetch(`/api/marketing/agent-orders/${saleId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, ...extras }),
    });
    setBusyKey(null);

    if (!response.ok) {
      const payload = await response.json().catch(() => ({ error: "Unable to update agent order." }));
      window.alert(payload.error || "Unable to update agent order.");
      return;
    }

    startTransition(() => router.refresh());
  }

  async function confirmPayment(sale: AgentOrderRow) {
    const paidInput = window.prompt("Enter amount paid by the customer", String(sale.totalAmount || sale.amountPaid || 0));
    if (paidInput === null) return;
    const amountPaid = Number(paidInput);
    if (!Number.isFinite(amountPaid) || amountPaid < 0) {
      window.alert("Enter a valid paid amount.");
      return;
    }
    const mpesaReference = window.prompt("Enter M-Pesa reference if available", sale.mpesaReference || "") ?? "";
    await patchStatus(sale.id, sale.status, { amountPaid, mpesaReference }, `${sale.id}:payment`);
  }

  async function completeSale(saleId: string) {
    setBusyKey(`${saleId}:complete`);
    const response = await fetch(`/api/marketing/agent-orders/${saleId}/complete`, { method: "POST" });
    setBusyKey(null);

    if (!response.ok) {
      const payload = await response.json().catch(() => ({ error: "Unable to complete agent order." }));
      window.alert(payload.error || "Unable to complete agent order.");
      return;
    }

    startTransition(() => router.refresh());
  }

  function quickAction(sale: AgentOrderRow) {
    if (sale.status === "pending_review" || sale.status === "awaiting_payment" || sale.status === "payment_confirmed") {
      return {
        label: busyKey === `${sale.id}:processing` ? "Saving..." : "Confirm & process",
        onClick: () => patchStatus(sale.id, "processing"),
      };
    }
    if (sale.status === "processing") {
      return {
        label: busyKey === `${sale.id}:dispatched` ? "Saving..." : "Mark dispatched",
        onClick: () => patchStatus(sale.id, "dispatched"),
      };
    }
    if (sale.status === "dispatched") {
      return {
        label: busyKey === `${sale.id}:delivered_pending_balance` ? "Saving..." : "Mark delivered",
        onClick: () => patchStatus(sale.id, "delivered_pending_balance"),
      };
    }
    if (sale.status === "delivered_pending_balance" && sale.balance <= 0) {
      return {
        label: busyKey === `${sale.id}:complete` ? "Saving..." : "Complete order",
        onClick: () => completeSale(sale.id),
      };
    }
    if (sale.status === "delivered_pending_balance") {
      return {
        label: busyKey === `${sale.id}:payment` ? "Saving..." : "Record final payment",
        onClick: () => confirmPayment(sale),
      };
    }
    return {
      label: "View details",
      onClick: () => setExpandedId((current) => (current === sale.id ? null : sale.id)),
    };
  }

  if (!sales.length) {
    return (
      <div className="rounded-[28px] border border-slate-800 bg-slate-950/70 p-8 text-slate-300">
        <div className="text-lg font-semibold text-white">No agent-submitted orders found.</div>
        <div className="mt-2 text-sm text-slate-400">New orders from agents will appear here automatically.</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3">
          <p className="text-[11px] uppercase tracking-wide text-slate-400">Visible orders</p>
          <p className="text-2xl font-semibold text-emerald-300">{sales.length}</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3">
          <p className="text-[11px] uppercase tracking-wide text-slate-400">Still open</p>
          <p className="text-2xl font-semibold text-cyan-300">{openCount}</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3">
          <p className="text-[11px] uppercase tracking-wide text-slate-400">Order value</p>
          <p className="text-2xl font-semibold text-emerald-300">
            {money(sales.reduce((sum, sale) => sum + sale.totalAmount, 0))}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {sales.map((sale) => {
          const expanded = expandedId === sale.id;
          const action = quickAction(sale);
          return (
            <article
              key={sale.id}
              className="overflow-hidden rounded-[28px] border border-slate-800 bg-[linear-gradient(180deg,rgba(15,23,42,.95),rgba(2,6,23,.98))] shadow-xl shadow-black/30"
            >
              <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex min-w-0 flex-1 gap-3">
                  <button
                    type="button"
                    onClick={() => setExpandedId((current) => (current === sale.id ? null : sale.id))}
                    className="mt-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-slate-200"
                    aria-label={expanded ? "Collapse order details" : "Expand order details"}
                  >
                    {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-xl font-semibold text-white">{sale.customerName}</h3>
                      <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${badgeTone(sale.status)}`}>
                        {sale.statusMeta.label}
                      </span>
                    </div>
                    <div className="mt-2 text-sm text-slate-300">{sale.productName}</div>
                    <div className="mt-3 grid gap-2 text-sm text-slate-400 sm:grid-cols-2 xl:grid-cols-5">
                      <div>
                        <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Phone</div>
                        <div className="mt-1 text-slate-200">{sale.customerPhone}</div>
                      </div>
                      <div>
                        <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Location</div>
                        <div className="mt-1 text-slate-200">{sale.customerCounty || sale.customerLocation}</div>
                      </div>
                      <div>
                        <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Payment</div>
                        <div className="mt-1 text-slate-200">{paymentLabel(sale.paymentType)}</div>
                      </div>
                      <div>
                        <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Agent</div>
                        <div className="mt-1 text-slate-200">{sale.agentName}</div>
                      </div>
                      <div>
                        <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Submitted</div>
                        <div className="mt-1 text-slate-200">{new Date(sale.createdAt).toLocaleString("en-KE")}</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex w-full flex-col gap-3 lg:w-[260px] lg:items-end">
                  <div className="text-right">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Total</div>
                    <div className="mt-1 text-3xl font-semibold text-emerald-300">{money(sale.totalAmount)}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      Paid {money(sale.amountPaid)} · Balance {money(sale.balance)}
                    </div>
                  </div>
                  <div className="flex w-full flex-col gap-2">
                    <a
                      href={`tel:${sale.customerPhone}`}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100"
                    >
                      <Phone className="h-4 w-4" />
                      Call customer
                    </a>
                    <button
                      type="button"
                      onClick={action.onClick}
                      disabled={busyKey !== null}
                      className="rounded-xl bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-60"
                    >
                      {action.label}
                    </button>
                    {canMoveTo(sale.status, "rejected") ? (
                      <button
                        type="button"
                        onClick={() => patchStatus(sale.id, "rejected")}
                        disabled={busyKey !== null}
                        className="rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 py-2 text-sm font-semibold text-rose-100 disabled:opacity-60"
                      >
                        {busyKey === `${sale.id}:rejected` ? "Saving..." : "Reject order"}
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>

              {expanded ? (
                <div className="border-t border-white/10 bg-slate-950/55 px-5 py-5">
                  <div className="grid gap-4 lg:grid-cols-3">
                    <section className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Customer & order</div>
                      <div className="mt-3 space-y-2 text-sm text-slate-300">
                        <div><span className="text-slate-500">Customer:</span> {sale.customerName}</div>
                        <div><span className="text-slate-500">Phone:</span> {sale.customerPhone}</div>
                        <div><span className="text-slate-500">County:</span> {sale.customerCounty || "Not set"}</div>
                        <div><span className="text-slate-500">Town / area:</span> {sale.customerLocation}</div>
                        <div><span className="text-slate-500">Quantity:</span> {sale.quantity}</div>
                      </div>
                    </section>

                    <section className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Payment & receipt</div>
                      <div className="mt-3 space-y-2 text-sm text-slate-300">
                        <div><span className="text-slate-500">Payment option:</span> {paymentLabel(sale.paymentType)}</div>
                        <div><span className="text-slate-500">Amount paid:</span> {money(sale.amountPaid)}</div>
                        <div><span className="text-slate-500">Balance:</span> {money(sale.balance)}</div>
                        <div><span className="text-slate-500">M-Pesa ref:</span> {sale.mpesaReference || "Not recorded"}</div>
                        <div><span className="text-slate-500">Receipt:</span> {sale.receiptNumber || "Not linked yet"}</div>
                      </div>
                    </section>

                    <section className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Agent & support notes</div>
                      <div className="mt-3 space-y-2 text-sm text-slate-300">
                        <div><span className="text-slate-500">Agent:</span> {sale.agentName}</div>
                        <div><span className="text-slate-500">Commission:</span> {money(sale.commissionAmount)}</div>
                        <div><span className="text-slate-500">Status note:</span> {sale.statusMeta.note}</div>
                        {sale.duplicateNote ? <div><span className="text-slate-500">Review:</span> {sale.duplicateNote}</div> : null}
                      </div>
                    </section>
                  </div>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </div>
  );
}
