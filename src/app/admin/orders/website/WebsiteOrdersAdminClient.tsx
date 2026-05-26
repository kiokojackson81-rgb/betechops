"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, ExternalLink, Loader2, RefreshCcw } from "lucide-react";
import type { SerializedWebsiteOrder } from "@/lib/websiteOrders";

type Props = {
  initialOrders: SerializedWebsiteOrder[];
};

const STATUS_OPTIONS = ["ALL", "PENDING", "PROCESSING", "RECEIPT_ISSUED", "DISPATCHED", "PAYMENT_CONFIRMED", "DELIVERED", "CANCELLED"] as const;
const WEBSITE_LIFECYCLE = ["PENDING", "PROCESSING", "RECEIPT_ISSUED", "DISPATCHED", "PAYMENT_CONFIRMED", "DELIVERED"] as const;

function formatCurrency(value: number) {
  return `Ksh ${value.toLocaleString("en-KE", { maximumFractionDigits: 0 })}`;
}

function formatDateTime(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("en-KE");
}

export default function WebsiteOrdersAdminClient({ initialOrders }: Props) {
  const [orders, setOrders] = useState(initialOrders);
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_OPTIONS)[number]>("PENDING");
  const [query, setQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(initialOrders[0]?.id ?? null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<SerializedWebsiteOrder | null>(null);
  const [paymentTarget, setPaymentTarget] = useState<SerializedWebsiteOrder | null>(null);
  const [paymentMethod, setPaymentMethod] = useState("MPESA");
  const [paymentReference, setPaymentReference] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      if (statusFilter !== "ALL" && order.status !== statusFilter) return false;
      if (!query.trim()) return true;
      const value = query.trim().toLowerCase();
      return [
        order.orderRef,
        order.customerName,
        order.customerPhone,
        order.customerLocation,
        order.paymentMethod,
        order.deliveryMethod,
      ].some((entry) => entry.toLowerCase().includes(value));
    });
  }, [orders, query, statusFilter]);

  async function refreshOrders(nextStatus = statusFilter, nextQuery = query) {
    const params = new URLSearchParams();
    if (nextStatus) params.set("status", nextStatus);
    if (nextQuery.trim()) params.set("q", nextQuery.trim());
    const response = await fetch(`/api/admin/website-orders?${params.toString()}`, { cache: "no-store" });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.ok) {
      throw new Error(data?.error || "Failed to refresh website orders.");
    }
    setOrders(data.orders);
  }

  async function handleStatusUpdate(orderId: string, status: string) {
    setBusyAction(`${orderId}:${status}`);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/website-orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) throw new Error(data?.error || "Failed to update website order status.");
      setOrders((current) => current.map((order) => (order.id === orderId ? data.order : order)));
      setMessage(`Updated website order to ${status.replace(/_/g, " ")}.`);
    } finally {
      setBusyAction(null);
    }
  }

  async function handlePaymentConfirm() {
    if (!paymentTarget) return;
    const orderId = paymentTarget.id;
    setBusyAction(`${orderId}:PAYMENT_CONFIRMED`);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/website-orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "PAYMENT_CONFIRMED",
          paymentConfirmationMethod: paymentMethod,
          paymentConfirmationReference: paymentReference,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) throw new Error(data?.error || "Failed to confirm payment.");
      setOrders((current) => current.map((order) => (order.id === orderId ? data.order : order)));
      setPaymentTarget(null);
      setPaymentMethod("MPESA");
      setPaymentReference("");
      setMessage("Payment confirmation saved.");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleRouteToReceipt(order: SerializedWebsiteOrder, mode: "pod" | "normal") {
    const orderId = order.id;
    setBusyAction(`${orderId}:${mode}`);
    setMessage(null);
    try {
      const draftResponse = await fetch(`/api/admin/website-orders/${orderId}/create-receipt-draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      const draftData = await draftResponse.json().catch(() => null);
      if (!draftResponse.ok || !draftData?.ok) {
        throw new Error(draftData?.error || "Failed to create receipt draft.");
      }

      window.location.href = draftData.url;
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-[var(--panel,#121723)] p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="grid gap-3 sm:grid-cols-3">
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as (typeof STATUS_OPTIONS)[number])}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm"
            >
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status === "ALL" ? "All statuses" : status.replace(/_/g, " ")}
                </option>
              ))}
            </select>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search ref, customer, phone, location"
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm sm:col-span-2"
            />
          </div>
          <button
            type="button"
            onClick={() => refreshOrders().catch((error: Error) => setMessage(error.message))}
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm font-medium transition hover:bg-white/10"
          >
            <RefreshCcw className="h-4 w-4" />
            Refresh
          </button>
        </div>
        {message ? <div className="mt-3 text-sm text-emerald-300">{message}</div> : null}
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-[var(--panel,#121723)]">
        <div className="grid grid-cols-[56px_minmax(220px,1.5fr)_minmax(120px,0.8fr)_minmax(150px,1fr)_minmax(130px,0.9fr)_minmax(120px,0.8fr)_minmax(120px,0.8fr)_minmax(120px,0.8fr)] gap-3 border-b border-white/10 px-4 py-3 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
          <div>Open</div>
          <div>Customer</div>
          <div>Phone</div>
          <div>Location</div>
          <div>Delivery</div>
          <div>Payment</div>
          <div>Total</div>
          <div>Status</div>
        </div>

        {filteredOrders.length ? (
          filteredOrders.map((order) => {
            const open = expandedId === order.id;
            return (
              <div key={order.id} className="border-b border-white/10 last:border-b-0">
                <div className="grid grid-cols-[56px_minmax(220px,1.5fr)_minmax(120px,0.8fr)_minmax(150px,1fr)_minmax(130px,0.9fr)_minmax(120px,0.8fr)_minmax(120px,0.8fr)_minmax(120px,0.8fr)] gap-3 px-4 py-4 text-sm">
                  <button
                    type="button"
                    onClick={() => setExpandedId(open ? null : order.id)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 transition hover:bg-white/10"
                  >
                    {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </button>
                  <div>
                    <div className="font-semibold text-white">{order.customerName}</div>
                    <div className="mt-1 text-xs text-slate-400">{order.orderRef}</div>
                    <div className="mt-1 text-xs text-slate-500">{formatDateTime(order.createdAt)}</div>
                  </div>
                  <div className="text-slate-200">{order.customerPhone}</div>
                  <div className="text-slate-300">{order.customerLocation}</div>
                  <div className="text-slate-300">{order.deliveryMethod}</div>
                  <div className="text-slate-300">{order.paymentMethod}</div>
                  <div className="font-semibold text-white">{formatCurrency(order.total)}</div>
                  <div>
                    <span className="inline-flex rounded-full border border-emerald-400/15 bg-emerald-500/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] text-emerald-300">
                      {order.status.replace(/_/g, " ")}
                    </span>
                  </div>
                  <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                    {open ? "Admin actions below" : "Open order"}
                  </div>
                </div>

                {open ? (
                  <div className="border-t border-white/10 bg-[#0f1520] px-4 py-4">
                    <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
                      <div className="space-y-3">
                        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                          <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Customer & order</div>
                          <div className="mt-3 grid gap-2 text-sm text-slate-200">
                            <div><span className="text-slate-500">Email:</span> {order.customerEmail || "-"}</div>
                            <div><span className="text-slate-500">Order type:</span> {order.orderType.replace(/_/g, " ")}</div>
                            <div><span className="text-slate-500">Payment confirmed:</span> {order.paymentConfirmationMethod ? `${order.paymentConfirmationMethod}${order.paymentConfirmationReference ? ` · ${order.paymentConfirmationReference}` : ""}` : "-"}</div>
                            <div><span className="text-slate-500">Notes:</span> {order.notes || "-"}</div>
                            <div><span className="text-slate-500">Confirmed by:</span> {order.confirmedBy?.name || "-"}</div>
                            <div><span className="text-slate-500">Receipt:</span> {order.receipt?.receiptNumber || "-"}</div>
                          </div>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                          <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Items</div>
                          <div className="mt-3 overflow-x-auto">
                            <table className="w-full min-w-[520px] text-sm">
                              <thead className="text-left text-xs uppercase tracking-[0.14em] text-slate-500">
                                <tr>
                                  <th className="pb-2">Product</th>
                                  <th className="pb-2">Qty</th>
                                  <th className="pb-2">Unit price</th>
                                  <th className="pb-2">Total</th>
                                </tr>
                              </thead>
                              <tbody>
                                {order.items.map((item) => (
                                  <tr key={item.id} className="border-t border-white/10">
                                    <td className="py-2.5 pr-3 text-slate-200">
                                      <div className="font-medium text-white">{item.productName}</div>
                                      <div className="text-xs text-slate-500">{item.sku || item.category || ""}</div>
                                    </td>
                                    <td className="py-2.5 pr-3 text-slate-200">{item.quantity}</td>
                                    <td className="py-2.5 pr-3 text-slate-200">{formatCurrency(item.unitPrice)}</td>
                                    <td className="py-2.5 text-white">{formatCurrency(item.total)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                          <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Lifecycle</div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {WEBSITE_LIFECYCLE.map((step) => (
                              <span
                                key={step}
                                className={`inline-flex rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] ${
                                  step === order.status
                                    ? "bg-emerald-500/15 text-emerald-300"
                                    : "bg-white/8 text-slate-400"
                                }`}
                              >
                                {step.replace(/_/g, " ")}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                          <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Admin actions</div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {(order.status === "PENDING" || order.status === "CONFIRMED") && (
                              <button
                                type="button"
                                onClick={() => setConfirmTarget(order)}
                                disabled={busyAction?.startsWith(order.id)}
                                className="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-slate-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                Start Processing
                              </button>
                            )}
                            {order.status === "PROCESSING" && (
                              <button
                                type="button"
                                onClick={() => handleStatusUpdate(order.id, "RECEIPT_ISSUED").catch((error: Error) => setMessage(error.message))}
                                disabled={busyAction?.startsWith(order.id)}
                                className="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-slate-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                Issue Receipt Automatically
                              </button>
                            )}
                            {order.status === "RECEIPT_ISSUED" && (
                              <button
                                type="button"
                                onClick={() => handleStatusUpdate(order.id, "DISPATCHED").catch((error: Error) => setMessage(error.message))}
                                disabled={busyAction?.startsWith(order.id)}
                                className="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-slate-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                Mark Dispatch / Picked
                              </button>
                            )}
                            {order.status === "DISPATCHED" && (
                              <button
                                type="button"
                                onClick={() => {
                                  setPaymentTarget(order);
                                  setPaymentMethod(order.paymentConfirmationMethod || "MPESA");
                                  setPaymentReference(order.paymentConfirmationReference || "");
                                }}
                                disabled={busyAction?.startsWith(order.id)}
                                className="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-slate-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                Confirm Payment
                              </button>
                            )}
                            {order.status === "PAYMENT_CONFIRMED" && (
                              <button
                                type="button"
                                onClick={() => handleStatusUpdate(order.id, "DELIVERED").catch((error: Error) => setMessage(error.message))}
                                disabled={busyAction?.startsWith(order.id)}
                                className="rounded-lg border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/18 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                Mark Delivered
                              </button>
                            )}
                            {order.status === "DELIVERED" && !order.receiptId && (
                              <button
                                type="button"
                                onClick={() => handleRouteToReceipt(order, order.orderType === "POD" ? "pod" : "normal").catch((error: Error) => setMessage(error.message))}
                                disabled={busyAction?.startsWith(order.id)}
                                className="rounded-lg border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-300 transition hover:bg-amber-500/18 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                Create Missing Receipt
                              </button>
                            )}
                            {order.status !== "CANCELLED" && order.status !== "DELIVERED" && (
                              <button
                                type="button"
                                onClick={() => handleStatusUpdate(order.id, "CANCELLED").catch((error: Error) => setMessage(error.message))}
                                disabled={busyAction?.startsWith(order.id)}
                                className="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                Cancel Order
                              </button>
                            )}
                          </div>
                        </div>

                        {order.receiptId ? (
                          <Link
                            href={`/receipts`}
                            className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm font-medium text-slate-100 transition hover:bg-white/10"
                          >
                            Open receipts desk
                            <ExternalLink className="h-4 w-4" />
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })
        ) : (
          <div className="px-4 py-8 text-sm text-slate-400">No website orders match the current filter.</div>
        )}
      </div>

      {confirmTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#020617]/70 px-4">
          <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-[#111827] p-6 shadow-2xl">
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-300">Start Website Order Processing</div>
            <h2 className="mt-2 text-2xl font-bold text-white">{confirmTarget.orderRef}</h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Review this customer order and move it into processing. The system will only allow each next action once, and receipt issuance will be handled from the admin action flow.
            </p>
            <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200">
              <div className="font-semibold text-white">{confirmTarget.customerName}</div>
              <div className="mt-1">{confirmTarget.customerPhone}</div>
              <div className="mt-1">{confirmTarget.deliveryMethod} · {confirmTarget.paymentMethod}</div>
              <div className="mt-2 font-semibold text-white">{formatCurrency(confirmTarget.total)}</div>
            </div>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={async () => {
                  setBusyAction(`${confirmTarget.id}:PROCESSING`);
                  setMessage(null);
                  try {
                    const confirmResponse = await fetch(`/api/admin/website-orders/${confirmTarget.id}/confirm`, {
                      method: "POST",
                    });
                    const confirmData = await confirmResponse.json().catch(() => null);
                    if (!confirmResponse.ok || !confirmData?.ok) {
                      throw new Error(confirmData?.error || "Failed to start website order processing.");
                    }
                    setOrders((current) => current.map((order) => (order.id === confirmTarget.id ? confirmData.order : order)));
                    setConfirmTarget(null);
                    setMessage("Website order moved to processing.");
                  } finally {
                    setBusyAction(null);
                  }
                }}
                disabled={Boolean(busyAction)}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busyAction === `${confirmTarget.id}:PROCESSING` ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Start Processing
              </button>
              <button
                type="button"
                onClick={() => setConfirmTarget(null)}
                disabled={Boolean(busyAction)}
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {paymentTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#020617]/70 px-4">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#111827] p-6 shadow-2xl">
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-300">Confirm Payment</div>
            <h2 className="mt-2 text-2xl font-bold text-white">{paymentTarget.orderRef}</h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Enter the payment confirmation details before moving this website order to delivered.
            </p>
            <div className="mt-4 grid gap-3">
              <label className="grid gap-2 text-sm font-semibold text-slate-200">
                Payment method
                <select
                  value={paymentMethod}
                  onChange={(event) => setPaymentMethod(event.target.value)}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-white"
                >
                  <option value="MPESA">MPESA</option>
                  <option value="CASH">CASH</option>
                  <option value="BANK">BANK</option>
                  <option value="CARD">CARD</option>
                </select>
              </label>
              <label className="grid gap-2 text-sm font-semibold text-slate-200">
                Payment reference
                <input
                  value={paymentReference}
                  onChange={(event) => setPaymentReference(event.target.value)}
                  placeholder="Optional MPESA code / transaction ref"
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-white outline-none"
                />
              </label>
            </div>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => handlePaymentConfirm().catch((error: Error) => setMessage(error.message))}
                disabled={Boolean(busyAction)}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busyAction === `${paymentTarget.id}:PAYMENT_CONFIRMED` ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Save Payment Confirmation
              </button>
              <button
                type="button"
                onClick={() => {
                  setPaymentTarget(null);
                  setPaymentMethod("MPESA");
                  setPaymentReference("");
                }}
                disabled={Boolean(busyAction)}
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
