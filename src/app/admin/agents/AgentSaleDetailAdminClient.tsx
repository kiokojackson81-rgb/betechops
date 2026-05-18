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

function isTerminalStatus(status: string) {
  const normalized = String(status || "").toLowerCase();
  return normalized === "completed" || normalized === "cancelled" || normalized === "rejected";
}

function canMoveTo(status: string, nextStatus: string) {
  const current = String(status || "").toLowerCase();
  const next = String(nextStatus || "").toLowerCase();
  if (current === next || isTerminalStatus(current)) return false;
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

const money = (value: number) =>
  new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(value || 0);

function riskTone(riskLevel: string) {
  if (riskLevel === "high") return "border-rose-400/30 bg-rose-400/10 text-rose-100";
  if (riskLevel === "medium") return "border-amber-400/30 bg-amber-400/10 text-amber-100";
  return "border-emerald-400/30 bg-emerald-400/10 text-emerald-100";
}

function detailValue(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return "Not set";
  return String(value);
}

function stageTone(status: string) {
  if (status === "completed") return "border-emerald-400/30 bg-emerald-400/10 text-emerald-100";
  if (status === "cancelled" || status === "rejected") return "border-rose-400/30 bg-rose-400/10 text-rose-100";
  if (status === "processing" || status === "dispatched") return "border-cyan-400/30 bg-cyan-400/10 text-cyan-100";
  if (status === "delivered_pending_balance") return "border-amber-400/30 bg-amber-400/10 text-amber-100";
  return "border-indigo-400/30 bg-indigo-400/10 text-indigo-100";
}

function DetailStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">{label}</div>
      <div className="mt-2 text-sm font-medium text-slate-100">{value}</div>
    </div>
  );
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
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DetailStat label="Order stage" value={sale.statusMeta.label} />
        <DetailStat label="Order value" value={money(sale.totalAmount)} />
        <DetailStat label="Amount paid" value={money(sale.amountPaid)} />
        <DetailStat label="Receipt" value={sale.receiptNumber || "Not linked"} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_360px]">
        <div className="space-y-6">
          <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">Order overview</div>
                <h2 className="mt-2 text-2xl font-semibold text-white">
                  {sale.customerName} · {sale.productName}
                </h2>
                <p className="mt-2 max-w-3xl text-sm text-slate-400">
                  Review the order, confirm payment and delivery, then complete the sale when it is ready for commission unlock.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <div className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${stageTone(sale.status)}`}>
                  {sale.statusMeta.label}
                </div>
                <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-200">
                  {sale.paymentType.replace(/_/g, " ")}
                </div>
                <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-200">
                  {sale.deliveryMethod || "delivery method pending"}
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <DetailStat label="Customer phone" value={sale.customerPhone} />
              <DetailStat label="Location" value={sale.customerLocation} />
              <DetailStat label="County" value={detailValue(sale.customerCounty)} />
              <DetailStat label="Last updated" value={new Date(sale.updatedAt).toLocaleString("en-KE")} />
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6">
              <h2 className="text-xl font-semibold text-white">Customer and product</h2>
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                <DetailStat label="Customer" value={sale.customerName} />
                <DetailStat label="Phone" value={sale.customerPhone} />
                <DetailStat label="Location" value={sale.customerLocation} />
                <DetailStat label="County" value={detailValue(sale.customerCounty)} />
                <DetailStat label="Product" value={sale.productName} />
                <DetailStat label="Category" value={detailValue(sale.productCategory)} />
                <DetailStat label="Quantity" value={String(sale.quantity)} />
                <DetailStat label="Unit price" value={money(sale.unitPrice)} />
              </div>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6">
              <h2 className="text-xl font-semibold text-white">Payment and delivery</h2>
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                <DetailStat label="Total amount" value={money(sale.totalAmount)} />
                <DetailStat label="Amount paid" value={money(sale.amountPaid)} />
                <DetailStat label="Balance" value={money(sale.balance)} />
                <DetailStat label="Payment type" value={sale.paymentType.replace(/_/g, " ")} />
                <DetailStat label="Delivery method" value={detailValue(sale.deliveryMethod)} />
                <DetailStat label="M-Pesa reference" value={detailValue(sale.mpesaReference)} />
                <DetailStat label="Order stage" value={sale.statusMeta.label} />
                <DetailStat label="Commission status" value={sale.commissionStatus} />
              </div>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6 lg:col-span-2">
              <h2 className="text-xl font-semibold text-white">Notes and handling context</h2>
              <div className="mt-5 grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                  <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Delivery notes</div>
                  <p className="mt-2 text-sm text-slate-300">{sale.deliveryNotes || "No delivery notes."}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                  <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Customer notes</div>
                  <p className="mt-2 text-sm text-slate-300">{sale.customerNotes || "No customer notes."}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                  <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Internal agent notes</div>
                  <p className="mt-2 text-sm text-slate-300">{sale.internalAgentNotes || "No internal notes."}</p>
                </div>
              </div>
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

        <div className="space-y-6 xl:sticky xl:top-24 xl:self-start">
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
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold text-white">Admin actions</h2>
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Follow the order journey</div>
            </div>
            <div className="mt-4 grid gap-2 rounded-2xl border border-white/10 bg-slate-950/70 p-4 text-xs uppercase tracking-[0.2em] text-slate-500">
              <div className="flex items-center justify-between gap-3">
                <span>1. Review and verify</span>
                <span className="text-slate-300">Payment / receipt</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>2. Move order</span>
                <span className="text-slate-300">Processing to delivery</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>3. Close sale</span>
                <span className="text-slate-300">Complete and unlock commission</span>
              </div>
            </div>
            <div className="mt-5 grid gap-3">
              {!isTerminalStatus(sale.status) ? (
                <button
                  onClick={confirmPayment}
                  disabled={busy !== null}
                  className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-sm font-semibold text-cyan-100 disabled:opacity-60"
                >
                  {busy === "payment" ? "Saving..." : "Verify payment"}
                </button>
              ) : null}
              <div className="grid gap-3 md:grid-cols-2">
                {canMoveTo(sale.status, "processing") ? (
                  <button
                    onClick={() => patchStatus("processing")}
                    disabled={busy !== null}
                    className="rounded-2xl border border-white/10 px-4 py-3 text-sm text-slate-200 transition hover:border-white/20 disabled:opacity-60"
                  >
                    {busy === "status:processing" ? "Saving..." : "Mark processing"}
                  </button>
                ) : null}
                {canMoveTo(sale.status, "dispatched") ? (
                  <button
                    onClick={() => patchStatus("dispatched")}
                    disabled={busy !== null}
                    className="rounded-2xl border border-white/10 px-4 py-3 text-sm text-slate-200 transition hover:border-white/20 disabled:opacity-60"
                  >
                    {busy === "status:dispatched" ? "Saving..." : "Mark dispatched"}
                  </button>
                ) : null}
                {canMoveTo(sale.status, "delivered_pending_balance") ? (
                  <button
                    onClick={() => patchStatus("delivered_pending_balance")}
                    disabled={busy !== null}
                    className="rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm font-semibold text-amber-100 disabled:opacity-60"
                  >
                    {busy === "status:delivered_pending_balance" ? "Saving..." : "Mark delivered / collected"}
                  </button>
                ) : null}
                {canMoveTo(sale.status, "rejected") ? (
                  <button
                    onClick={() => patchStatus("rejected")}
                    disabled={busy !== null}
                    className="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm font-semibold text-rose-100 disabled:opacity-60"
                  >
                    {busy === "status:rejected" ? "Saving..." : "Reject sale"}
                  </button>
                ) : null}
                {canMoveTo(sale.status, "cancelled") ? (
                  <button
                    onClick={() => patchStatus("cancelled")}
                    disabled={busy !== null}
                    className="rounded-2xl border border-white/10 px-4 py-3 text-sm text-slate-200 transition hover:border-white/20 disabled:opacity-60"
                  >
                    {busy === "status:cancelled" ? "Saving..." : "Cancel sale"}
                  </button>
                ) : null}
              </div>
              {sale.status === "delivered_pending_balance" && sale.balance <= 0 ? (
                <button
                  onClick={completeSale}
                  disabled={busy !== null}
                  className="rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-semibold text-slate-950 disabled:opacity-60"
                >
                  {busy === "complete" ? "Completing..." : "Mark completed"}
                </button>
              ) : null}
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
