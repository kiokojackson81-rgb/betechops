"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Loader2,
  RefreshCcw,
} from "lucide-react";
import type { SerializedWebsiteOrder } from "@/lib/websiteOrders";
import { getShopProductHref } from "@/app/shop/storefrontPaths";

type WebsiteOrderStatusFilter =
  | "ALL"
  | "PENDING"
  | "PROCESSING"
  | "RECEIPT_ISSUED"
  | "DISPATCHED"
  | "PAYMENT_CONFIRMED"
  | "DELIVERED"
  | "CANCELLED";

type Props = {
  initialOrders?: SerializedWebsiteOrder[];
  apiBasePath: string;
  apiQueryParams?: Record<string, string | null | undefined>;
  defaultStatusFilter?: WebsiteOrderStatusFilter;
  initialExpandedId?: string | null;
  emptyMessage?: string;
  orderListLabel?: string;
  orderListTitle?: string;
  orderListDescription?: string;
  filterStorageKey?: string;
  q?: string;
  start?: string;
  end?: string;
  compactMode?: boolean;
};

const STATUS_OPTIONS: WebsiteOrderStatusFilter[] = [
  "ALL",
  "PENDING",
  "PROCESSING",
  "RECEIPT_ISSUED",
  "DISPATCHED",
  "PAYMENT_CONFIRMED",
  "DELIVERED",
  "CANCELLED",
];

const WEBSITE_LIFECYCLE = [
  "PENDING",
  "PROCESSING",
  "RECEIPT_ISSUED",
  "DISPATCHED",
  "PAYMENT_CONFIRMED",
  "DELIVERED",
] as const;

const SHOP_BASE_URL = "https://www.betech.co.ke";

function formatCurrency(value: number) {
  return `Ksh ${value.toLocaleString("en-KE", { maximumFractionDigits: 0 })}`;
}

function formatDateTime(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("en-KE");
}

function isWithinRange(value: string | null | undefined, start?: string, end?: string) {
  if (!value) return false;
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return false;
  const min = start ? new Date(`${start}T00:00:00`).getTime() : -Infinity;
  const max = end ? new Date(`${end}T23:59:59.999`).getTime() : Infinity;
  return timestamp >= min && timestamp <= max;
}

function slugifyProductName(value: string) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildProductShopHref(productName: string, productId?: string | null) {
  const normalizedProductId = String(productId || "").trim();
  const slug = slugifyProductName(productName);
  if (!slug || !normalizedProductId) return null;
  return `${SHOP_BASE_URL}${getShopProductHref(slug, normalizedProductId)}`;
}

export default function WebsiteOrdersDeskClient({
  initialOrders = [],
  apiBasePath,
  apiQueryParams,
  defaultStatusFilter = "PENDING",
  initialExpandedId = initialOrders[0]?.id ?? null,
  emptyMessage = "No website orders match the current filter.",
  orderListLabel = "Website orders",
  orderListTitle = "Assigned web orders",
  orderListDescription = "Process your assigned website orders through the same flow used in admin.",
  filterStorageKey,
  q = "",
  start,
  end,
  compactMode = false,
}: Props) {
  const [orders, setOrders] = useState(initialOrders);
  const [statusFilter, setStatusFilter] = useState<WebsiteOrderStatusFilter>(defaultStatusFilter);
  const [query, setQuery] = useState(q);
  const [expandedId, setExpandedId] = useState<string | null>(initialExpandedId);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<SerializedWebsiteOrder | null>(null);
  const [paymentTarget, setPaymentTarget] = useState<SerializedWebsiteOrder | null>(null);
  const [paymentMethod, setPaymentMethod] = useState("MPESA");
  const [paymentReference, setPaymentReference] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      if (statusFilter !== "ALL" && order.status !== statusFilter) return false;
      if (
        !isWithinRange(order.updatedAt || order.createdAt, start, end) &&
        !isWithinRange(order.createdAt, start, end)
      ) {
        return false;
      }
      if (!query.trim()) return true;
      const value = query.trim().toLowerCase();
      return [
        order.orderRef,
        order.customerName,
        order.customerPhone,
        order.customerLocation,
        order.paymentMethod,
        order.deliveryMethod,
        order.customerEmail || "",
      ].some((entry) => entry.toLowerCase().includes(value));
    });
  }, [end, orders, query, start, statusFilter]);

  useEffect(() => {
    setQuery(q);
  }, [q]);

  function buildApiUrl(pathSuffix = "", extraParams?: Record<string, string>) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(apiQueryParams ?? {})) {
      if (value) params.set(key, value);
    }
    for (const [key, value] of Object.entries(extraParams ?? {})) {
      if (value) params.set(key, value);
    }
    const suffix = pathSuffix ? `/${pathSuffix.replace(/^\/+/, "")}` : "";
    const queryString = params.toString();
    return `${apiBasePath}${suffix}${queryString ? `?${queryString}` : ""}`;
  }

  async function refreshOrders(nextStatus: WebsiteOrderStatusFilter = "ALL", nextQuery = query) {
    setIsLoading(true);
    setLoadError(null);
    try {
      const response = await fetch(
        buildApiUrl("", {
          ...(nextStatus ? { status: nextStatus } : {}),
          ...(nextQuery.trim() ? { q: nextQuery.trim() } : {}),
        }),
        { cache: "no-store" },
      );
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || "Failed to refresh website orders.");
      }
      setOrders(data.orders);
      if (
        data.orders?.length &&
        !data.orders.some((order: SerializedWebsiteOrder) => order.id === expandedId)
      ) {
        setExpandedId(data.orders[0]?.id ?? null);
      }
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (filterStorageKey && typeof window !== "undefined") {
      const saved = window.localStorage.getItem(filterStorageKey);
      if (saved && STATUS_OPTIONS.includes(saved as WebsiteOrderStatusFilter)) {
        setStatusFilter(saved as WebsiteOrderStatusFilter);
      }
    }
  }, [filterStorageKey]);

  useEffect(() => {
    if (filterStorageKey && typeof window !== "undefined") {
      window.localStorage.setItem(filterStorageKey, statusFilter);
    }
  }, [filterStorageKey, statusFilter]);

  useEffect(() => {
    refreshOrders(statusFilter, query)
      .catch((error: Error) => setLoadError(error.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleStatusUpdate(orderId: string, status: string) {
    setBusyAction(`${orderId}:${status}`);
    setMessage(null);
    try {
      const response = await fetch(buildApiUrl(`${orderId}/status`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || "Failed to update website order status.");
      }
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
      const response = await fetch(buildApiUrl(`${orderId}/status`), {
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
      const draftResponse = await fetch(buildApiUrl(`${orderId}/create-receipt-draft`), {
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
      {!compactMode ? (
      <div className="rounded-2xl border border-white/10 bg-[var(--panel,#121723)] p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
              {orderListLabel}
            </div>
            <h2 className="mt-2 text-lg font-semibold text-white">{orderListTitle}</h2>
            <p className="mt-1 text-sm text-slate-400">{orderListDescription}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as WebsiteOrderStatusFilter)}
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
            onClick={() =>
              refreshOrders().catch((error: Error) => {
                setLoadError(error.message);
                setMessage(null);
              })
            }
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm font-medium transition hover:bg-white/10"
          >
            <RefreshCcw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
        {message ? <div className="mt-3 text-sm text-emerald-300">{message}</div> : null}
        {loadError ? <div className="mt-3 text-sm text-rose-300">{loadError}</div> : null}
      </div>
      ) : (
        <>
          {message ? <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{message}</div> : null}
          {loadError ? <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{loadError}</div> : null}
        </>
      )}

      {compactMode ? (
        <div className="space-y-3">
          {filteredOrders.length ? (
            filteredOrders.map((order) => {
              const open = expandedId === order.id;
              return (
                <div key={order.id} className="rounded-[22px] border border-white/10 bg-white/[0.03]">
                  <div className="grid gap-3 p-4 lg:grid-cols-[140px_1.3fr_1fr_160px_140px_150px] lg:items-center">
                    <div className="flex items-center gap-2">
                      <span className="rounded-full border border-cyan-400/25 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100">
                        WEB ORDER
                      </span>
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-white">{order.customerName}</div>
                      <div className="mt-1 text-xs text-slate-400">{order.customerPhone}</div>
                      <div className="mt-1 text-xs text-slate-500">{order.orderRef}</div>
                    </div>
                    <div className="text-sm text-slate-300">
                      <div>{order.customerLocation}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {order.assignedAttendant?.name || "Unassigned"}
                      </div>
                    </div>
                    <div>
                      <div className="font-semibold text-white">{formatCurrency(order.total)}</div>
                      <div className="mt-1 text-xs text-slate-400">{order.paymentMethod}</div>
                    </div>
                    <div>
                      <span className="inline-flex rounded-full border border-emerald-400/15 bg-emerald-500/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] text-emerald-300">
                        {order.status.replace(/_/g, " ")}
                      </span>
                      <div className="mt-2 text-xs text-slate-500">{formatDateTime(order.updatedAt || order.createdAt)}</div>
                    </div>
                    <div className="flex justify-start lg:justify-end">
                      <button
                        type="button"
                        onClick={() => setExpandedId(open ? null : order.id)}
                        className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-100 transition hover:border-white/25 hover:bg-white/[0.06]"
                      >
                        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        {open ? "Close" : "Open order"}
                      </button>
                    </div>
                  </div>

                  {open ? (
                    <div className="border-t border-white/10 bg-[#0f1520] px-4 py-4">
                      <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
                        <div className="space-y-3">
                          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                            <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                              Customer & order
                            </div>
                            <div className="mt-3 grid gap-2 text-sm text-slate-200">
                              <div><span className="text-slate-500">Email:</span> {order.customerEmail || "-"}</div>
                              <div><span className="text-slate-500">Order type:</span> {order.orderType.replace(/_/g, " ")}</div>
                              <div><span className="text-slate-500">Payment confirmed:</span> {order.paymentConfirmationMethod ? `${order.paymentConfirmationMethod}${order.paymentConfirmationReference ? ` · ${order.paymentConfirmationReference}` : ""}` : "-"}</div>
                              <div><span className="text-slate-500">Notes:</span> {order.notes || "-"}</div>
                              <div><span className="text-slate-500">Confirmed by:</span> {order.confirmedBy?.name || "-"}</div>
                              <div><span className="text-slate-500">Assigned to:</span> {order.assignedAttendant?.name || "-"}</div>
                              <div><span className="text-slate-500">Referred by:</span> {order.referredByAgent?.name || "-"}</div>
                              <div><span className="text-slate-500">Referral code:</span> {order.attributionCodeUsed || order.referredByAgent?.referralCode || "-"}</div>
                              <div><span className="text-slate-500">Receipt:</span> {order.receipt?.receiptNumber || "-"}</div>
                            </div>
                          </div>
                          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                            <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Items</div>
                            <div className="mt-3 overflow-x-auto">
                              <table className="w-full min-w-[520px] text-sm">
                                <thead className="text-left text-xs uppercase tracking-[0.14em] text-slate-500">
                                  <tr><th className="pb-2">Product</th><th className="pb-2">Qty</th><th className="pb-2">Unit price</th><th className="pb-2">Total</th></tr>
                                </thead>
                                <tbody>
                                  {order.items.map((item) => {
                                    const productShopHref = buildProductShopHref(item.productName, item.productId);
                                    return (
                                      <tr key={item.id} className="border-t border-white/10">
                                        <td className="py-2.5 pr-3 text-slate-200">
                                          {productShopHref ? (
                                            <Link href={productShopHref} target="_blank" rel="noreferrer" className="font-medium text-white underline-offset-4 hover:text-emerald-200 hover:underline">
                                              {item.productName}
                                            </Link>
                                          ) : (
                                            <div className="font-medium text-white">{item.productName}</div>
                                          )}
                                          <div className="text-xs text-slate-500">{item.sku || item.category || ""}</div>
                                        </td>
                                        <td className="py-2.5 pr-3 text-slate-200">{item.quantity}</td>
                                        <td className="py-2.5 pr-3 text-slate-200">{formatCurrency(item.unitPrice)}</td>
                                        <td className="py-2.5 text-white">{formatCurrency(item.total)}</td>
                                      </tr>
                                    );
                                  })}
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
                                <span key={step} className={`inline-flex rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] ${step === order.status ? "bg-emerald-500/15 text-emerald-300" : "bg-white/8 text-slate-400"}`}>
                                  {step.replace(/_/g, " ")}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                            <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Order actions</div>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {(order.status === "PENDING" || order.status === "CONFIRMED") && (
                                <button type="button" onClick={() => setConfirmTarget(order)} disabled={busyAction?.startsWith(order.id)} className="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-slate-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60">Start Processing</button>
                              )}
                              {order.status === "PROCESSING" && (
                                <button type="button" onClick={() => handleStatusUpdate(order.id, "RECEIPT_ISSUED").catch((error: Error) => setMessage(error.message))} disabled={busyAction?.startsWith(order.id)} className="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-slate-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60">Issue Receipt Automatically</button>
                              )}
                              {order.status === "RECEIPT_ISSUED" && (
                                <button type="button" onClick={() => handleStatusUpdate(order.id, "DISPATCHED").catch((error: Error) => setMessage(error.message))} disabled={busyAction?.startsWith(order.id)} className="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-slate-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60">Mark Dispatch / Picked</button>
                              )}
                              {order.status === "DISPATCHED" && (
                                <button type="button" onClick={() => { setPaymentTarget(order); setPaymentMethod(order.paymentConfirmationMethod || "MPESA"); setPaymentReference(order.paymentConfirmationReference || ""); }} disabled={busyAction?.startsWith(order.id)} className="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-slate-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60">Confirm Payment</button>
                              )}
                              {order.status === "PAYMENT_CONFIRMED" && (
                                <button type="button" onClick={() => handleStatusUpdate(order.id, "DELIVERED").catch((error: Error) => setMessage(error.message))} disabled={busyAction?.startsWith(order.id)} className="rounded-lg border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/18 disabled:cursor-not-allowed disabled:opacity-60">Mark Delivered</button>
                              )}
                              {order.status === "DELIVERED" && !order.receiptId && (
                                <button type="button" onClick={() => handleRouteToReceipt(order, order.orderType === "POD" ? "pod" : "normal").catch((error: Error) => setMessage(error.message))} disabled={busyAction?.startsWith(order.id)} className="rounded-lg border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-300 transition hover:bg-amber-500/18 disabled:cursor-not-allowed disabled:opacity-60">Create Missing Receipt</button>
                              )}
                              {order.status !== "CANCELLED" && order.status !== "DELIVERED" && (
                                <button type="button" onClick={() => handleStatusUpdate(order.id, "CANCELLED").catch((error: Error) => setMessage(error.message))} disabled={busyAction?.startsWith(order.id)} className="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60">Cancel Order</button>
                              )}
                            </div>
                          </div>
                          {order.receiptId ? (
                            <Link href="/receipts" className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm font-medium text-slate-100 transition hover:bg-white/10">
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
            <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/40 px-5 py-8 text-center text-sm text-slate-400">{emptyMessage}</div>
          )}
        </div>
      ) : (
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
                    {open ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
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
                    {open ? "Order actions below" : "Open order"}
                  </div>
                </div>

                {open ? (
                  <div className="border-t border-white/10 bg-[#0f1520] px-4 py-4">
                    <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
                      <div className="space-y-3">
                        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                          <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                            Customer & order
                          </div>
                          <div className="mt-3 grid gap-2 text-sm text-slate-200">
                            <div>
                              <span className="text-slate-500">Email:</span> {order.customerEmail || "-"}
                            </div>
                            <div>
                              <span className="text-slate-500">Order type:</span>{" "}
                              {order.orderType.replace(/_/g, " ")}
                            </div>
                            <div>
                              <span className="text-slate-500">Payment confirmed:</span>{" "}
                              {order.paymentConfirmationMethod
                                ? `${order.paymentConfirmationMethod}${
                                    order.paymentConfirmationReference
                                      ? ` · ${order.paymentConfirmationReference}`
                                      : ""
                                  }`
                                : "-"}
                            </div>
                            <div>
                              <span className="text-slate-500">Notes:</span> {order.notes || "-"}
                            </div>
                            <div>
                              <span className="text-slate-500">Confirmed by:</span>{" "}
                              {order.confirmedBy?.name || "-"}
                            </div>
                            <div>
                              <span className="text-slate-500">Assigned to:</span>{" "}
                              {order.assignedAttendant?.name || "-"}
                            </div>
                            <div>
                              <span className="text-slate-500">Referred by:</span>{" "}
                              {order.referredByAgent?.name || "-"}
                            </div>
                            <div>
                              <span className="text-slate-500">Referral code:</span>{" "}
                              {order.attributionCodeUsed || order.referredByAgent?.referralCode || "-"}
                            </div>
                            <div>
                              <span className="text-slate-500">Receipt:</span>{" "}
                              {order.receipt?.receiptNumber || "-"}
                            </div>
                          </div>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                          <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                            Items
                          </div>
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
                                {order.items.map((item) => {
                                  const productShopHref = buildProductShopHref(item.productName, item.productId);

                                  return (
                                    <tr key={item.id} className="border-t border-white/10">
                                      <td className="py-2.5 pr-3 text-slate-200">
                                        {productShopHref ? (
                                          <Link
                                            href={productShopHref}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="font-medium text-white underline-offset-4 hover:text-emerald-200 hover:underline"
                                          >
                                            {item.productName}
                                          </Link>
                                        ) : (
                                          <div className="font-medium text-white">{item.productName}</div>
                                        )}
                                        <div className="text-xs text-slate-500">
                                          {item.sku || item.category || ""}
                                        </div>
                                      </td>
                                      <td className="py-2.5 pr-3 text-slate-200">{item.quantity}</td>
                                      <td className="py-2.5 pr-3 text-slate-200">
                                        {formatCurrency(item.unitPrice)}
                                      </td>
                                      <td className="py-2.5 text-white">{formatCurrency(item.total)}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                          <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                            Lifecycle
                          </div>
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
                          <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                            Order actions
                          </div>
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
                                onClick={() =>
                                  handleStatusUpdate(order.id, "RECEIPT_ISSUED").catch(
                                    (error: Error) => setMessage(error.message),
                                  )
                                }
                                disabled={busyAction?.startsWith(order.id)}
                                className="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-slate-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                Issue Receipt Automatically
                              </button>
                            )}
                            {order.status === "RECEIPT_ISSUED" && (
                              <button
                                type="button"
                                onClick={() =>
                                  handleStatusUpdate(order.id, "DISPATCHED").catch((error: Error) =>
                                    setMessage(error.message),
                                  )
                                }
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
                                onClick={() =>
                                  handleStatusUpdate(order.id, "DELIVERED").catch((error: Error) =>
                                    setMessage(error.message),
                                  )
                                }
                                disabled={busyAction?.startsWith(order.id)}
                                className="rounded-lg border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/18 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                Mark Delivered
                              </button>
                            )}
                            {order.status === "DELIVERED" && !order.receiptId && (
                              <button
                                type="button"
                                onClick={() =>
                                  handleRouteToReceipt(
                                    order,
                                    order.orderType === "POD" ? "pod" : "normal",
                                  ).catch((error: Error) => setMessage(error.message))
                                }
                                disabled={busyAction?.startsWith(order.id)}
                                className="rounded-lg border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-300 transition hover:bg-amber-500/18 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                Create Missing Receipt
                              </button>
                            )}
                            {order.status !== "CANCELLED" && order.status !== "DELIVERED" && (
                              <button
                                type="button"
                                onClick={() =>
                                  handleStatusUpdate(order.id, "CANCELLED").catch((error: Error) =>
                                    setMessage(error.message),
                                  )
                                }
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
                            href="/receipts"
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
          <div className="px-4 py-8 text-sm text-slate-400">{emptyMessage}</div>
        )}
      </div>
      )}

      {confirmTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#020617]/70 px-4">
          <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-[#111827] p-6 shadow-2xl">
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-300">
              Start Website Order Processing
            </div>
            <h2 className="mt-2 text-2xl font-bold text-white">{confirmTarget.orderRef}</h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Review this customer order and move it into processing. The next actions will unlock one
              by one, matching the admin website-order flow.
            </p>
            <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200">
              <div className="font-semibold text-white">{confirmTarget.customerName}</div>
              <div className="mt-1">{confirmTarget.customerPhone}</div>
              <div className="mt-1">
                {confirmTarget.deliveryMethod} · {confirmTarget.paymentMethod}
              </div>
              <div className="mt-2 font-semibold text-white">{formatCurrency(confirmTarget.total)}</div>
            </div>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={async () => {
                  setBusyAction(`${confirmTarget.id}:PROCESSING`);
                  setMessage(null);
                  try {
                    const confirmResponse = await fetch(buildApiUrl(`${confirmTarget.id}/confirm`), {
                      method: "POST",
                    });
                    const confirmData = await confirmResponse.json().catch(() => null);
                    if (!confirmResponse.ok || !confirmData?.ok) {
                      throw new Error(
                        confirmData?.error || "Failed to start website order processing.",
                      );
                    }
                    setOrders((current) =>
                      current.map((order) => (order.id === confirmTarget.id ? confirmData.order : order)),
                    );
                    setConfirmTarget(null);
                    setMessage("Website order moved to processing.");
                  } finally {
                    setBusyAction(null);
                  }
                }}
                disabled={Boolean(busyAction)}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busyAction === `${confirmTarget.id}:PROCESSING` ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}
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
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-300">
              Confirm Payment
            </div>
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
                {busyAction === `${paymentTarget.id}:PAYMENT_CONFIRMED` ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}
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
