"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type SaleDetail = {
  id: string;
  agentId: string;
  agentName: string;
  customerName: string;
  customerPhone: string;
  customerLocation: string;
  customerCounty: string | null;
  productName: string;
  productCategory: string | null;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  amountPaid: number;
  balance: number;
  paymentType: string;
  mpesaReference: string | null;
  deliveryMethod: string | null;
  deliveryNotes: string | null;
  customerNotes: string | null;
  internalAgentNotes: string | null;
  status: string;
  statusMeta: { label: string; note: string };
  commissionAmount: number;
  commissionStatus: string;
  commissionBadge: string;
  receiptId: string | null;
  receiptNumber: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

type ActivityRow = {
  id: string;
  action: string;
  description: string | null;
  createdAt: string;
};

type TimelineRow = {
  id: string;
  stage: string;
  note: string | null;
  createdAt: string;
  actorUserId: string | null;
  actor: {
    id: string;
    name: string | null;
    email: string;
  } | null;
};

type AuditRow = {
  id: string;
  eventType: string;
  summary: string;
  createdAt: string;
  actorUserId: string | null;
  actor: {
    id: string;
    name: string | null;
    email: string;
  } | null;
};

type FraudSignalRow = {
  id: string;
  signalType: string;
  riskLevel: string;
  title: string;
  description: string | null;
  status: string;
  createdAt: string;
  resolvedAt: string | null;
};

type DuplicateReviewRow = {
  id: string;
  status: string;
  normalizedPhone: string;
  primarySaleId: string;
  duplicateSaleId: string;
  resolutionNote: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  primaryAgent: {
    id: string;
    name: string | null;
    email: string;
  };
  duplicateAgent: {
    id: string;
    name: string | null;
    email: string;
  };
};

type OwnershipRow = {
  id: string;
  status: string;
  customerName: string | null;
  customerCounty: string | null;
  customerLocation: string | null;
  productName: string | null;
  ownedUntil: string;
  releasedAt: string | null;
  createdAt: string;
  updatedAt: string;
  overrideNote: string | null;
  agent: {
    id: string;
    name: string | null;
    email: string;
  };
  firstSale: {
    id: string;
    createdAt: string;
  };
};

const statuses = [
  "pending_review",
  "awaiting_payment",
  "processing",
  "dispatched",
  "delivered_pending_balance",
  "rejected",
  "cancelled",
];

const money = (value: number) =>
  new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(value || 0);

function riskTone(riskLevel: string) {
  if (riskLevel === "high") return "border-rose-400/30 bg-rose-400/10 text-rose-100";
  if (riskLevel === "medium") return "border-amber-400/30 bg-amber-400/10 text-amber-100";
  return "border-emerald-400/30 bg-emerald-400/10 text-emerald-100";
}

export default function AgentSaleDetailAdminClient({
  sale,
  activity,
  timeline,
  audit,
  fraudSignals,
  duplicateReviews,
  activeOwnership,
  receiptPrefillUrl,
}: {
  sale: SaleDetail;
  activity: ActivityRow[];
  timeline: TimelineRow[];
  audit: AuditRow[];
  fraudSignals: FraudSignalRow[];
  duplicateReviews: DuplicateReviewRow[];
  activeOwnership: OwnershipRow | null;
  receiptPrefillUrl: string;
}) {
  const router = useRouter();
  const [receiptId, setReceiptId] = useState(sale.receiptId || "");
  const [receiptNumber, setReceiptNumber] = useState(sale.receiptNumber || "");
  const [busy, setBusy] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function patchStatus(
    status: string,
    extras?: { amountPaid?: number; mpesaReference?: string },
    busyKey?: string,
  ) {
    setBusy(busyKey || `status:${status}`);
    const res = await fetch(`/api/admin/agents/sales/${sale.id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, ...extras }),
    });
    setBusy(null);
    if (!res.ok) {
      const payload = await res.json().catch(() => ({ error: "Unable to update status." }));
      window.alert(payload.error || "Unable to update status.");
      return;
    }
    startTransition(() => router.refresh());
  }

  async function confirmPayment() {
    const paidInput = window.prompt("Enter total amount paid by the customer", String(sale.totalAmount || sale.amountPaid || 0));
    if (paidInput === null) return;
    const amountPaid = Number(paidInput);
    if (!Number.isFinite(amountPaid) || amountPaid < 0) {
      window.alert("Enter a valid paid amount.");
      return;
    }
    const mpesaReference = window.prompt("Enter M-Pesa reference if available", sale.mpesaReference || "") ?? "";
    await patchStatus(sale.status, { amountPaid, mpesaReference }, "payment");
  }

  async function linkReceipt() {
    setBusy("receipt");
    const res = await fetch(`/api/admin/agents/sales/${sale.id}/receipt`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ receiptId, receiptNumber }),
    });
    setBusy(null);
    if (!res.ok) {
      const payload = await res.json().catch(() => ({ error: "Unable to link receipt." }));
      window.alert(payload.error || "Unable to link receipt.");
      return;
    }
    startTransition(() => router.refresh());
  }

  async function completeSale() {
    setBusy("complete");
    const res = await fetch(`/api/admin/agents/sales/${sale.id}/complete`, { method: "POST" });
    setBusy(null);
    if (!res.ok) {
      const payload = await res.json().catch(() => ({ error: "Unable to complete sale." }));
      window.alert(payload.error || "Unable to complete sale.");
      return;
    }
    startTransition(() => router.refresh());
  }

  const riskSummaryClass =
    fraudSignals.some((item) => item.riskLevel === "high")
      ? riskTone("high")
      : fraudSignals.some((item) => item.riskLevel === "medium")
        ? riskTone("medium")
        : riskTone("low");

  return (
    <div className="space-y-6">
      <section className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
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
              <div>M-PESA reference: {sale.mpesaReference || "Not provided"}</div>
              <div>Status: {sale.statusMeta.label}</div>
              <div>Commission status: {sale.commissionStatus}</div>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Delivery notes</div>
                <p className="mt-2 text-sm text-slate-300">{sale.deliveryNotes || "No delivery notes."}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Customer notes</div>
                <p className="mt-2 text-sm text-slate-300">{sale.customerNotes || "No customer notes."}</p>
              </div>
            </div>
            <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/70 p-4">
              <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Internal agent notes</div>
              <p className="mt-2 text-sm text-slate-300">{sale.internalAgentNotes || "No internal notes."}</p>
            </div>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-semibold text-white">Receipt linking</h2>
              <Link
                href={receiptPrefillUrl}
                className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:border-cyan-300/30"
              >
                Create receipt from sale
              </Link>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm text-slate-300">Receipt ID</span>
                <input
                  value={receiptId}
                  onChange={(event) => setReceiptId(event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-slate-100 outline-none focus:border-cyan-400/60"
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm text-slate-300">Receipt number</span>
                <input
                  value={receiptNumber}
                  onChange={(event) => setReceiptNumber(event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-slate-100 outline-none focus:border-cyan-400/60"
                />
              </label>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                onClick={linkReceipt}
                disabled={busy !== null}
                className="rounded-2xl bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950 disabled:opacity-60"
              >
                {busy === "receipt" ? "Linking..." : "Link receipt"}
              </button>
              {sale.receiptId ? (
                <Link
                  href={`/receipts/${sale.receiptId}`}
                  className="rounded-2xl border border-white/10 px-4 py-3 text-sm text-slate-200 transition hover:border-white/20"
                >
                  Open linked receipt
                </Link>
              ) : null}
            </div>
            {sale.receiptNumber ? (
              <div className="mt-4 text-sm text-emerald-200">Receipt created automatically: {sale.receiptNumber}</div>
            ) : null}
          </div>

          <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-semibold text-white">Enterprise checks</h2>
              <div className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${riskSummaryClass}`}>
                {fraudSignals.length ? `${fraudSignals.length} active signals` : "low risk"}
              </div>
            </div>

            {activeOwnership ? (
              <div className="mt-4 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-4 text-sm text-cyan-50">
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-100">Lead ownership</div>
                <p className="mt-2">
                  Owned by {activeOwnership.agent.name || activeOwnership.agent.email} until{" "}
                  {new Date(activeOwnership.ownedUntil).toLocaleString("en-KE")}.
                </p>
                <p className="mt-1 text-cyan-100/80">
                  First sale {activeOwnership.firstSale.id.slice(0, 10)} · Created{" "}
                  {new Date(activeOwnership.firstSale.createdAt).toLocaleString("en-KE")}
                </p>
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/70 p-4 text-sm text-slate-400">
                No active lead ownership record found for this customer phone.
              </div>
            )}

            <div className="mt-4 grid gap-4 xl:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Duplicate reviews</div>
                <div className="mt-3 space-y-3">
                  {duplicateReviews.length ? (
                    duplicateReviews.map((review) => (
                      <div key={review.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-sm text-slate-300">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="font-semibold text-white">{review.status.replace(/_/g, " ")}</div>
                          <div className="text-xs text-slate-500">{new Date(review.createdAt).toLocaleString("en-KE")}</div>
                        </div>
                        <p className="mt-2">
                          {review.primaryAgent.name || review.primaryAgent.email} vs{" "}
                          {review.duplicateAgent.name || review.duplicateAgent.email}
                        </p>
                        {review.resolutionNote ? <p className="mt-2 text-xs text-slate-400">{review.resolutionNote}</p> : null}
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate-400">No duplicate review records on this sale.</p>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Fraud signals</div>
                <div className="mt-3 space-y-3">
                  {fraudSignals.length ? (
                    fraudSignals.map((signal) => (
                      <div key={signal.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-sm text-slate-300">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="font-semibold text-white">{signal.title}</div>
                          <div className={`rounded-full border px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${riskTone(signal.riskLevel)}`}>
                            {signal.riskLevel}
                          </div>
                        </div>
                        <p className="mt-2 text-slate-300">{signal.description || signal.signalType.replace(/_/g, " ")}</p>
                        <p className="mt-2 text-xs text-slate-500">
                          {signal.status} · {new Date(signal.createdAt).toLocaleString("en-KE")}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate-400">No active fraud signals recorded.</p>
                  )}
                </div>
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
            <p className="mt-4 text-sm text-amber-50/85">
              Commission remains locked until the sale is fully paid, delivered or collected, and marked completed by admin.
            </p>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6">
            <h2 className="text-xl font-semibold text-white">Admin actions</h2>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <button
                onClick={confirmPayment}
                disabled={busy !== null}
                className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-sm font-semibold text-cyan-100 disabled:opacity-60"
              >
                {busy === "payment" ? "Saving..." : "Confirm payment"}
              </button>
              {statuses.map((status) => (
                <button
                  key={status}
                  onClick={() => patchStatus(status)}
                  disabled={busy !== null}
                  className="rounded-2xl border border-white/10 px-4 py-3 text-sm text-slate-200 transition hover:border-white/20 disabled:opacity-60"
                >
                  {busy === `status:${status}`
                    ? "Saving..."
                    : status === "delivered_pending_balance"
                      ? "Delivered / collected"
                      : status.replace(/_/g, " ")}
                </button>
              ))}
              <button
                onClick={completeSale}
                disabled={busy !== null}
                className="rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-semibold text-slate-950 disabled:opacity-60"
              >
                {busy === "complete" ? "Completing..." : "Mark completed"}
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6">
          <h2 className="text-xl font-semibold text-white">Sale timeline</h2>
          <div className="mt-5 space-y-4">
            {timeline.length ? (
              timeline.map((entry) => (
                <div key={entry.id} className="flex gap-3">
                  <div className="mt-1 h-3 w-3 rounded-full bg-cyan-300 shadow-[0_0_18px_rgba(103,232,249,0.6)]" />
                  <div className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-200">{entry.stage.replace(/_/g, " ")}</div>
                      <div className="text-xs text-slate-500">{new Date(entry.createdAt).toLocaleString("en-KE")}</div>
                    </div>
                    <p className="mt-2 text-sm text-slate-300">{entry.note || "No note recorded."}</p>
                    <div className="mt-2 text-xs text-slate-500">{entry.actor?.name || entry.actor?.email || "System"}</div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-400">No timeline entries recorded yet.</p>
            )}
          </div>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6">
          <h2 className="text-xl font-semibold text-white">Audit trail</h2>
          <div className="mt-5 space-y-4">
            {audit.length ? (
              audit.map((entry) => (
                <div key={entry.id} className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-200">{entry.eventType.replace(/_/g, " ")}</div>
                    <div className="text-xs text-slate-500">{new Date(entry.createdAt).toLocaleString("en-KE")}</div>
                  </div>
                  <p className="mt-2 text-sm text-slate-300">{entry.summary}</p>
                  <div className="mt-2 text-xs text-slate-500">{entry.actor?.name || entry.actor?.email || "System"}</div>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-400">No audit events recorded yet.</p>
            )}
          </div>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6">
          <h2 className="text-xl font-semibold text-white">Activity log</h2>
          <div className="mt-5 space-y-4">
            {activity.length ? (
              activity.map((item) => (
                <div key={item.id} className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-200">{item.action.replace(/_/g, " ")}</div>
                    <div className="text-xs text-slate-500">{new Date(item.createdAt).toLocaleString("en-KE")}</div>
                  </div>
                  <p className="mt-2 text-sm text-slate-300">{item.description || "No extra details provided."}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-400">No activity recorded for this sale yet.</p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
