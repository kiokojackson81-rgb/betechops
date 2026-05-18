"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

type AdminSaleRow = {
  id: string;
  agentId: string;
  agentName: string;
  customerName: string;
  customerPhone: string;
  customerLocation: string;
  customerCounty?: string | null;
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
  duplicateRisk: "low" | "medium" | "high";
  duplicateCount: number;
  needsReview: boolean;
  ownershipOwnerAgentName: string | null;
  ownershipWindowEndsAt: string | null;
  duplicateNote: string;
  createdAt: string;
};

const money = (value: number) =>
  new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(value || 0);

function statusBadge(status: string) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "completed") return "border-emerald-400/20 bg-emerald-400/10 text-emerald-200";
  if (normalized === "rejected" || normalized === "cancelled") return "border-rose-400/20 bg-rose-400/10 text-rose-200";
  if (normalized === "processing" || normalized === "dispatched") return "border-cyan-400/20 bg-cyan-400/10 text-cyan-200";
  if (normalized === "delivered_pending_balance" || normalized === "payment_confirmed") return "border-amber-400/20 bg-amber-400/10 text-amber-200";
  return "border-white/10 bg-white/[0.04] text-slate-200";
}

function duplicateBadge(level: AdminSaleRow["duplicateRisk"]) {
  if (level === "high") return "border-rose-400/20 bg-rose-400/10 text-rose-200";
  if (level === "medium") return "border-amber-400/20 bg-amber-400/10 text-amber-200";
  return "border-emerald-400/20 bg-emerald-400/10 text-emerald-200";
}

function paymentLabel(paymentType: string) {
  return paymentType.replace(/_/g, " ");
}

const journeySteps = [
  { key: "pending_review", label: "Submitted" },
  { key: "processing", label: "Processed" },
  { key: "dispatched", label: "Dispatched" },
  { key: "delivered_pending_balance", label: "Delivered / collected" },
  { key: "completed", label: "Commission unlocked" },
] as const;

export default function AgentSalesAdminClient({ sales }: { sales: AdminSaleRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [, startTransition] = useTransition();

  const selectedSale = useMemo(
    () => sales.find((sale) => sale.id === selectedId) ?? null,
    [sales, selectedId],
  );

  async function patchStatus(
    saleId: string,
    status: string,
    extras?: { amountPaid?: number; mpesaReference?: string },
    busyKey?: string,
  ) {
    const nextBusyKey = busyKey || `${saleId}:${status}`;
    setBusy(nextBusyKey);
    const res = await fetch(`/api/admin/agents/sales/${saleId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, ...extras }),
    });
    setBusy(null);
    if (!res.ok) {
      const payload = await res.json().catch(() => ({ error: "Unable to update sale status." }));
      window.alert(payload.error || "Unable to update sale status.");
      return;
    }
    startTransition(() => router.refresh());
  }

  async function confirmPayment(sale: AdminSaleRow) {
    const paidInput = window.prompt("Enter total amount paid by the customer", String(sale.totalAmount || sale.amountPaid || 0));
    if (paidInput === null) return;
    const amountPaid = Number(paidInput);
    if (!Number.isFinite(amountPaid) || amountPaid < 0) {
      window.alert("Enter a valid paid amount.");
      return;
    }
    const mpesaReference = window.prompt("Enter M-Pesa reference if available", "") ?? "";
    await patchStatus(sale.id, sale.status, { amountPaid, mpesaReference }, `${sale.id}:payment`);
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

  async function bulkStage(status: "processing" | "dispatched" | "delivered_pending_balance") {
    if (!selectedIds.length) return;
    setBusy(`bulk:${status}`);
    for (const saleId of selectedIds) {
      const res = await fetch(`/api/admin/agents/sales/${saleId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        setBusy(null);
        const payload = await res.json().catch(() => ({ error: "Unable to update selected sales." }));
        window.alert(payload.error || "Unable to update selected sales.");
        return;
      }
    }
    setBusy(null);
    setSelectedIds([]);
    startTransition(() => router.refresh());
  }

  function toggleSelected(saleId: string) {
    setSelectedIds((current) =>
      current.includes(saleId) ? current.filter((id) => id !== saleId) : [...current, saleId],
    );
  }

  function toggleSelectAll() {
    if (selectedIds.length === sales.length) {
      setSelectedIds([]);
      return;
    }
    setSelectedIds(sales.map((sale) => sale.id));
  }

  function renderActions(sale: AdminSaleRow, compact = false) {
    const base = compact ? "px-3 py-2 text-[11px]" : "px-3 py-2 text-xs";
    return (
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setSelectedId(sale.id)}
          className={`rounded-xl border border-white/10 font-semibold text-slate-100 transition hover:border-white/20 ${base}`}
        >
          View Details
        </button>
        <button
          onClick={() => patchStatus(sale.id, "processing")}
          disabled={busy !== null}
          className={`rounded-xl border border-white/10 font-semibold text-slate-200 transition hover:border-white/20 disabled:opacity-60 ${base}`}
        >
          {busy === `${sale.id}:processing` ? "..." : "Process"}
        </button>
        <button
          onClick={() => confirmPayment(sale)}
          disabled={busy !== null}
          className={`rounded-xl border border-white/10 font-semibold text-slate-200 transition hover:border-white/20 disabled:opacity-60 ${base}`}
        >
          {busy === `${sale.id}:payment` ? "..." : "Mark Paid"}
        </button>
        <button
          onClick={() => patchStatus(sale.id, "delivered_pending_balance")}
          disabled={busy !== null}
          className={`rounded-xl border border-amber-400/20 bg-amber-400/10 font-semibold text-amber-100 disabled:opacity-60 ${base}`}
        >
          {busy === `${sale.id}:delivered_pending_balance` ? "..." : "Mark Delivered"}
        </button>
      </div>
    );
  }

  if (!sales.length) {
    return (
      <div className="rounded-[28px] border border-white/10 bg-slate-950/70 p-8 text-slate-300">
        <div className="text-lg font-semibold text-white">No sales found.</div>
        <div className="mt-2 text-sm text-slate-400">Try changing your search or filters.</div>
      </div>
    );
  }

  return (
    <>
      {selectedIds.length ? (
        <div className="sticky top-4 z-20 flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-emerald-400/20 bg-slate-950/95 px-5 py-4 shadow-[0_18px_50px_rgba(0,0,0,0.25)] backdrop-blur">
          <div className="text-sm text-slate-200">{selectedIds.length} sale{selectedIds.length === 1 ? "" : "s"} selected</div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => bulkStage("processing")}
              disabled={busy !== null}
              className="rounded-xl border border-white/10 px-4 py-2 text-xs font-semibold text-slate-100 disabled:opacity-60"
            >
              {busy === "bulk:processing" ? "..." : "Bulk Process"}
            </button>
            <button
              onClick={() => bulkStage("dispatched")}
              disabled={busy !== null}
              className="rounded-xl border border-white/10 px-4 py-2 text-xs font-semibold text-slate-100 disabled:opacity-60"
            >
              {busy === "bulk:dispatched" ? "..." : "Bulk Dispatch"}
            </button>
            <button
              onClick={() => bulkStage("delivered_pending_balance")}
              disabled={busy !== null}
              className="rounded-xl border border-amber-400/20 bg-amber-400/10 px-4 py-2 text-xs font-semibold text-amber-100 disabled:opacity-60"
            >
              {busy === "bulk:delivered_pending_balance" ? "..." : "Bulk Delivered"}
            </button>
          </div>
        </div>
      ) : null}

      <div className="hidden overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,.96),rgba(2,6,23,.96))] shadow-[0_24px_70px_rgba(0,0,0,0.35)] lg:block">
        <div className="max-h-[72vh] overflow-auto">
          <table className="min-w-full text-left text-sm text-slate-300">
            <thead className="sticky top-0 z-10 bg-slate-950/95 backdrop-blur">
              <tr className="border-b border-white/10 text-[11px] uppercase tracking-[0.18em] text-slate-500">
                <th className="px-4 py-4">
                  <input type="checkbox" checked={selectedIds.length === sales.length && sales.length > 0} onChange={toggleSelectAll} />
                </th>
                <th className="px-4 py-4">Customer</th>
                <th className="px-4 py-4">Phone</th>
                <th className="px-4 py-4">Product</th>
                <th className="px-4 py-4">Agent</th>
                <th className="px-4 py-4">County</th>
                <th className="px-4 py-4">Payment</th>
                <th className="px-4 py-4">Paid</th>
                <th className="px-4 py-4">Balance</th>
                <th className="px-4 py-4">Order Value</th>
                <th className="px-4 py-4">Commission</th>
                <th className="px-4 py-4">Stage</th>
                <th className="px-4 py-4">Submitted</th>
                <th className="px-4 py-4">Duplicate Risk</th>
                <th className="px-4 py-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((sale) => (
                <tr key={sale.id} className="border-b border-white/5 align-top transition hover:bg-white/[0.03]">
                  <td className="px-4 py-4">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(sale.id)}
                      onChange={() => toggleSelected(sale.id)}
                    />
                  </td>
                  <td className="px-4 py-4">
                    <div className="font-semibold text-white">{sale.customerName}</div>
                    <div className="mt-1 text-xs text-slate-500">{sale.quantity} x {sale.productName}</div>
                  </td>
                  <td className="px-4 py-4">{sale.customerPhone}</td>
                  <td className="px-4 py-4">{sale.productName}</td>
                  <td className="px-4 py-4">{sale.agentName}</td>
                  <td className="px-4 py-4">{sale.customerCounty || sale.customerLocation}</td>
                  <td className="px-4 py-4">{paymentLabel(sale.paymentType)}</td>
                  <td className="px-4 py-4 text-cyan-100">{money(sale.amountPaid)}</td>
                  <td className="px-4 py-4">{money(sale.balance)}</td>
                  <td className="px-4 py-4">{money(sale.totalAmount)}</td>
                  <td className="px-4 py-4 text-amber-200">{money(sale.commissionAmount)}</td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${statusBadge(sale.status)}`}>
                      {sale.statusMeta.label}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-slate-400">{new Date(sale.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-4">
                    <div className="space-y-1">
                      <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${duplicateBadge(sale.duplicateRisk)}`}>
                        {sale.duplicateRisk} risk
                      </span>
                      {sale.needsReview ? <div className="text-xs text-slate-500">Needs review</div> : null}
                    </div>
                  </td>
                  <td className="px-4 py-4">{renderActions(sale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-4 lg:hidden">
        {sales.map((sale) => (
          <article
            key={sale.id}
            className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,.96),rgba(2,6,23,.96))] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.28)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-lg font-semibold text-white">{sale.customerName}</div>
                <div className="mt-1 text-sm text-slate-400">{sale.customerPhone}</div>
                <div className="mt-1 text-sm text-slate-500">{sale.customerLocation}</div>
                {sale.needsReview ? <div className="mt-2 text-xs text-amber-200">Needs admin duplicate review</div> : null}
              </div>
              <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${statusBadge(sale.status)}`}>
                {sale.statusMeta.label}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-xs">
              <div>
                <div className="uppercase tracking-[0.16em] text-slate-500">Order</div>
                <div className="mt-1 font-semibold text-white">{money(sale.totalAmount)}</div>
              </div>
              <div>
                <div className="uppercase tracking-[0.16em] text-slate-500">Paid</div>
                <div className="mt-1 font-semibold text-cyan-100">{money(sale.amountPaid)}</div>
              </div>
              <div>
                <div className="uppercase tracking-[0.16em] text-slate-500">Potential</div>
                <div className="mt-1 font-semibold text-amber-200">{money(sale.commissionAmount)}</div>
              </div>
            </div>

            <div className="mt-4 text-sm text-slate-300">
              <div>Product: {sale.productName}</div>
              <div className="mt-1">Agent: {sale.agentName}</div>
            </div>

            <div className="mt-3">
              <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${duplicateBadge(sale.duplicateRisk)}`}>
                {sale.duplicateRisk} duplicate risk
              </span>
            </div>

            <div className="mt-4">{renderActions(sale, true)}</div>
          </article>
        ))}
      </div>

      {selectedSale ? (
        <div className="fixed inset-0 z-40 flex justify-end bg-slate-950/70 backdrop-blur-sm">
          <button className="absolute inset-0 cursor-default" onClick={() => setSelectedId(null)} aria-label="Close details" />
          <aside className="relative h-full w-full max-w-2xl overflow-y-auto border-l border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,.99),rgba(2,6,23,.99))] p-6 shadow-[-24px_0_60px_rgba(0,0,0,0.35)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-[0.22em] text-cyan-300">Sale Details</div>
                <h2 className="mt-2 text-3xl font-semibold text-white">{selectedSale.customerName}</h2>
                <div className="mt-2 text-sm text-slate-400">{selectedSale.customerPhone} · {selectedSale.customerLocation}</div>
              </div>
              <button
                onClick={() => setSelectedId(null)}
                className="rounded-2xl border border-white/10 px-4 py-2 text-sm text-slate-200 transition hover:border-white/20"
              >
                Close
              </button>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Order Value</div>
                <div className="mt-3 text-2xl font-semibold text-white">{money(selectedSale.totalAmount)}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Amount Paid</div>
                <div className="mt-3 text-2xl font-semibold text-cyan-100">{money(selectedSale.amountPaid)}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Potential Commission</div>
                <div className="mt-3 text-2xl font-semibold text-amber-200">{money(selectedSale.commissionAmount)}</div>
              </div>
            </div>

            <div className="mt-6 grid gap-6 xl:grid-cols-2">
              <section className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
                <h3 className="text-lg font-semibold text-white">Customer Info</h3>
                <div className="mt-4 space-y-2 text-sm text-slate-300">
                  <div>Name: {selectedSale.customerName}</div>
                  <div>Phone: {selectedSale.customerPhone}</div>
                  <div>County: {selectedSale.customerCounty || "Not captured"}</div>
                  <div>Location: {selectedSale.customerLocation}</div>
                </div>
              </section>

              <section className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
                <h3 className="text-lg font-semibold text-white">Product Info</h3>
                <div className="mt-4 space-y-2 text-sm text-slate-300">
                  <div>Product: {selectedSale.productName}</div>
                  <div>Quantity: {selectedSale.quantity}</div>
                  <div>Unit estimate: {money(selectedSale.quantity ? selectedSale.totalAmount / selectedSale.quantity : selectedSale.totalAmount)}</div>
                  <div>Total amount: {money(selectedSale.totalAmount)}</div>
                </div>
              </section>

              <section className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
                <h3 className="text-lg font-semibold text-white">Payment Info</h3>
                <div className="mt-4 space-y-2 text-sm text-slate-300">
                  <div>Payment option: {paymentLabel(selectedSale.paymentType)}</div>
                  <div>Amount paid: {money(selectedSale.amountPaid)}</div>
                  <div>Balance: {money(selectedSale.balance)}</div>
                  <div>Receipt: {selectedSale.receiptNumber || "Not linked yet"}</div>
                </div>
              </section>

              <section className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
                <h3 className="text-lg font-semibold text-white">Agent Info</h3>
                <div className="mt-4 space-y-2 text-sm text-slate-300">
                  <div>Agent name: {selectedSale.agentName}</div>
                  <div>Potential commission: {money(selectedSale.commissionAmount)}</div>
                  <div>Commission status: {selectedSale.commissionBadge}</div>
                </div>
              </section>
            </div>

            <section className="mt-6 rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
              <h3 className="text-lg font-semibold text-white">Duplicate & Ownership Check</h3>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${duplicateBadge(selectedSale.duplicateRisk)}`}>
                  {selectedSale.duplicateRisk} risk
                </span>
                {selectedSale.needsReview ? (
                  <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-200">
                    Needs admin review
                  </span>
                ) : null}
              </div>
              <div className="mt-4 space-y-2 text-sm text-slate-300">
                <div>{selectedSale.duplicateNote}</div>
                {selectedSale.ownershipOwnerAgentName ? <div>Lead owner: {selectedSale.ownershipOwnerAgentName}</div> : null}
                {selectedSale.ownershipWindowEndsAt ? <div>Ownership window ends: {new Date(selectedSale.ownershipWindowEndsAt).toLocaleString()}</div> : null}
              </div>
            </section>

            <section className="mt-6 rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
              <h3 className="text-lg font-semibold text-white">Order Journey</h3>
              <div className="mt-4 grid gap-3 md:grid-cols-5">
                {journeySteps.map((step, index) => {
                  const active =
                    step.key === selectedSale.status ||
                    (step.key === "pending_review" && selectedSale.status !== "rejected" && selectedSale.status !== "cancelled") ||
                    (step.key === "processing" && ["processing", "dispatched", "delivered_pending_balance", "completed"].includes(selectedSale.status)) ||
                    (step.key === "dispatched" && ["dispatched", "delivered_pending_balance", "completed"].includes(selectedSale.status)) ||
                    (step.key === "delivered_pending_balance" && ["delivered_pending_balance", "completed"].includes(selectedSale.status)) ||
                    (step.key === "completed" && selectedSale.status === "completed");

                  return (
                    <div
                      key={step.key}
                      className={`rounded-2xl border p-3 text-sm ${active ? "border-cyan-400/20 bg-cyan-400/10 text-cyan-100" : "border-white/10 bg-slate-950/60 text-slate-400"}`}
                    >
                      <div className="text-xs uppercase tracking-[0.18em]">{String(index + 1).padStart(2, "0")}</div>
                      <div className="mt-2 font-semibold">{step.label}</div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="mt-6 rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
              <h3 className="text-lg font-semibold text-white">Admin Actions</h3>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  onClick={() => patchStatus(selectedSale.id, "processing")}
                  disabled={busy !== null}
                  className="rounded-2xl border border-white/10 px-4 py-2 text-sm text-slate-200 transition hover:border-white/20 disabled:opacity-60"
                >
                  {busy === `${selectedSale.id}:processing` ? "Saving..." : "Process order"}
                </button>
                <button
                  onClick={() => patchStatus(selectedSale.id, "dispatched")}
                  disabled={busy !== null}
                  className="rounded-2xl border border-white/10 px-4 py-2 text-sm text-slate-200 transition hover:border-white/20 disabled:opacity-60"
                >
                  {busy === `${selectedSale.id}:dispatched` ? "Saving..." : "Mark dispatched"}
                </button>
                <button
                  onClick={() => patchStatus(selectedSale.id, "delivered_pending_balance")}
                  disabled={busy !== null}
                  className="rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-2 text-sm font-semibold text-amber-100 disabled:opacity-60"
                >
                  {busy === `${selectedSale.id}:delivered_pending_balance` ? "Saving..." : "Mark delivered"}
                </button>
                <button
                  onClick={() => confirmPayment(selectedSale)}
                  disabled={busy !== null}
                  className="rounded-2xl border border-white/10 px-4 py-2 text-sm text-slate-200 transition hover:border-white/20 disabled:opacity-60"
                >
                  {busy === `${selectedSale.id}:payment` ? "Saving..." : "Update payment"}
                </button>
                <button
                  onClick={() => completeSale(selectedSale.id)}
                  disabled={busy !== null}
                  className="rounded-2xl bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-60"
                >
                  {busy === `${selectedSale.id}:complete` ? "Completing..." : "Unlock commission"}
                </button>
                <Link
                  href={`/admin/agents/sales/${selectedSale.id}`}
                  className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100"
                >
                  Open full details
                </Link>
              </div>
            </section>
          </aside>
        </div>
      ) : null}
    </>
  );
}
