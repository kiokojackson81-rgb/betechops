"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, Mail, Phone, Receipt, ShoppingBag, Store, UserRound } from "lucide-react";
import type { AdminCustomerRow } from "@/lib/adminCustomers";

type CustomerRow = Omit<AdminCustomerRow, "firstPurchaseAt" | "lastPurchaseAt" | "orders"> & {
  firstPurchaseAt: string | null;
  lastPurchaseAt: string | null;
  orders: Array<Omit<AdminCustomerRow["orders"][number], "createdAt" | "receiptGeneratedAt"> & {
    createdAt: string;
    receiptGeneratedAt: string | null;
  }>;
};

const money = (value: number) =>
  new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(value || 0);

const dateTime = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat("en-KE", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    : "—";

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
      <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{label}</div>
      <div className="mt-2 text-lg font-semibold text-white">{value}</div>
    </div>
  );
}

export default function CustomersAdminClient({ customers }: { customers: CustomerRow[] }) {
  const [expandedIds, setExpandedIds] = useState<string[]>([]);

  const totals = useMemo(
    () =>
      customers.reduce(
        (acc, customer) => {
          acc.totalOrders += customer.totalOrders;
          acc.totalReceipts += customer.totalReceipts;
          acc.totalSpend += customer.totalSpend;
          acc.knownPhones += customer.primaryPhone ? 1 : 0;
          acc.knownEmails += customer.primaryEmail ? 1 : 0;
          return acc;
        },
        { totalOrders: 0, totalReceipts: 0, totalSpend: 0, knownPhones: 0, knownEmails: 0 },
      ),
    [customers],
  );

  function toggleExpanded(customerId: string) {
    setExpandedIds((current) =>
      current.includes(customerId) ? current.filter((id) => id !== customerId) : [...current, customerId],
    );
  }

  if (!customers.length) {
    return (
      <div className="rounded-[28px] border border-white/10 bg-slate-950/70 p-8 text-slate-300">
        <div className="text-lg font-semibold text-white">No customers found.</div>
        <div className="mt-2 text-sm text-slate-400">Try changing your search or the sort order.</div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Customers" value={String(customers.length)} />
        <MetricCard label="Orders" value={String(totals.totalOrders)} />
        <MetricCard label="Receipts" value={String(totals.totalReceipts)} />
        <MetricCard label="Total purchase" value={money(totals.totalSpend)} />
        <MetricCard label="Known contacts" value={`${totals.knownPhones} phones · ${totals.knownEmails} emails`} />
      </div>

      <div className="hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,.96),rgba(2,6,23,.96))] lg:block">
        <div className="grid grid-cols-[56px_minmax(260px,1.8fr)_180px_120px_120px_160px_160px_150px] items-center gap-3 border-b border-white/10 bg-slate-950/95 px-4 py-4 text-[11px] uppercase tracking-[0.18em] text-slate-500">
          <div />
          <div>Customer</div>
          <div>Contact</div>
          <div>Orders</div>
          <div>Receipts</div>
          <div>Total purchase</div>
          <div>Last activity</div>
          <div>Highlights</div>
        </div>
        <div className="divide-y divide-white/5">
          {customers.map((customer) => {
            const expanded = expandedIds.includes(customer.id);
            return (
              <div key={customer.id} className="transition hover:bg-white/[0.02]">
                <div className="grid grid-cols-[56px_minmax(260px,1.8fr)_180px_120px_120px_160px_160px_150px] items-center gap-3 px-4 py-4">
                  <div>
                    <button
                      onClick={() => toggleExpanded(customer.id)}
                      className="rounded-xl border border-white/10 p-2 text-slate-200 transition hover:border-white/20"
                      aria-label={expanded ? "Collapse customer row" : "Expand customer row"}
                    >
                      {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-white">{customer.displayName}</div>
                    <div className="mt-1 truncate text-xs text-slate-500">
                      {customer.shops.slice(0, 2).join(" · ") || "No linked shop"}{customer.shops.length > 2 ? ` +${customer.shops.length - 2} more` : ""}
                    </div>
                  </div>
                  <div className="min-w-0 text-sm text-slate-300">
                    <div className="truncate">{customer.primaryPhone || "No phone"}</div>
                    <div className="truncate text-xs text-slate-500">{customer.primaryEmail || "No email"}</div>
                  </div>
                  <div className="text-white">{customer.totalOrders}</div>
                  <div className="text-white">{customer.totalReceipts}</div>
                  <div className="font-semibold text-emerald-300">{money(customer.totalSpend)}</div>
                  <div className="text-sm text-slate-300">{dateTime(customer.lastPurchaseAt)}</div>
                  <div className="text-xs text-slate-400">{customer.recentProductNames.slice(0, 2).join(" · ") || "No item summary"}</div>
                </div>

                {expanded ? (
                  <div className="border-t border-white/5 bg-slate-950/45 px-4 py-5">
                    <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
                      <div className="space-y-4">
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                          <MetricCard label="Average order value" value={money(customer.averageOrderValue)} />
                          <MetricCard label="Outstanding balance" value={money(customer.outstandingBalance)} />
                          <MetricCard label="First purchase" value={dateTime(customer.firstPurchaseAt)} />
                          <MetricCard label="Last shop" value={customer.lastShopName || "—"} />
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Contact details</div>
                          <div className="mt-3 space-y-3 text-sm text-slate-200">
                            <div className="flex items-start gap-2">
                              <Phone className="mt-0.5 h-4 w-4 text-emerald-300" />
                              <div>{customer.phones.join(", ") || "No phone recorded"}</div>
                            </div>
                            <div className="flex items-start gap-2">
                              <Mail className="mt-0.5 h-4 w-4 text-cyan-300" />
                              <div>{customer.emails.join(", ") || "No email recorded"}</div>
                            </div>
                            <div className="flex items-start gap-2">
                              <Store className="mt-0.5 h-4 w-4 text-amber-300" />
                              <div>{customer.shops.join(", ") || "No shop history"}</div>
                            </div>
                            <div className="flex items-start gap-2">
                              <UserRound className="mt-0.5 h-4 w-4 text-rose-300" />
                              <div>{customer.attendants.join(", ") || "No assigned attendant"}</div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="grid gap-4 xl:grid-cols-2">
                          <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Top purchased items</div>
                            <div className="mt-3 space-y-3">
                              {customer.topProducts.map((item) => (
                                <div key={`${customer.id}-${item.name}-${item.sku ?? "no-sku"}`} className="rounded-xl border border-white/5 bg-white/[0.03] px-3 py-3">
                                  <div className="flex items-start justify-between gap-3">
                                    <div>
                                      <div className="font-medium text-white">{item.name}</div>
                                      <div className="mt-1 text-xs text-slate-500">
                                        {item.category || "No category"}{item.sku ? ` · ${item.sku}` : ""}
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <div className="text-sm font-semibold text-emerald-300">{money(item.spend)}</div>
                                      <div className="text-xs text-slate-500">{item.quantity} pcs</div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Customer activity</div>
                            <div className="mt-3 space-y-3">
                              {customer.activities.map((activity) => (
                                <div key={`${customer.id}-${activity}`} className="rounded-xl border border-white/5 bg-white/[0.03] px-3 py-3 text-sm text-slate-200">
                                  {activity}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Purchase history</div>
                            <div className="text-xs text-slate-500">{customer.orders.length} orders linked</div>
                          </div>
                          <div className="mt-4 space-y-3">
                            {customer.orders.slice(0, 8).map((order) => (
                              <div key={order.id} className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
                                <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                                  <div>
                                    <div className="flex flex-wrap items-center gap-2">
                                      <div className="font-semibold text-white">{order.orderNumber}</div>
                                      {order.receiptNumber ? (
                                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-200">
                                          <Receipt className="h-3 w-3" />
                                          {order.receiptNumber}
                                        </span>
                                      ) : null}
                                    </div>
                                    <div className="mt-1 text-xs text-slate-500">
                                      {dateTime(order.createdAt)} · {order.shopName || "No shop"} · {order.attendantName || order.attendantEmail || "No attendant"}
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <div className="font-semibold text-emerald-300">{money(order.totalAmount)}</div>
                                    <div className="text-xs text-slate-500">
                                      {order.paymentStatus} · {order.status}
                                    </div>
                                  </div>
                                </div>
                                <div className="mt-3 flex flex-wrap gap-2">
                                  {order.items.map((item, index) => (
                                    <span
                                      key={`${order.id}-${item.productName}-${index}`}
                                      className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-slate-900/80 px-3 py-1.5 text-xs text-slate-200"
                                    >
                                      <ShoppingBag className="h-3 w-3 text-cyan-300" />
                                      {item.productName} x{item.quantity}
                                    </span>
                                  ))}
                                </div>
                                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                                  <Link
                                    href={`/admin/orders?q=${encodeURIComponent(order.orderNumber)}`}
                                    className="rounded-full border border-white/10 px-3 py-1.5 text-slate-300 transition hover:border-white/20 hover:text-white"
                                  >
                                    Open in orders
                                  </Link>
                                  {order.receiptNumber ? (
                                    <Link
                                      href={`/admin/receipts?q=${encodeURIComponent(order.receiptNumber)}`}
                                      className="rounded-full border border-white/10 px-3 py-1.5 text-slate-300 transition hover:border-white/20 hover:text-white"
                                    >
                                      Search receipt
                                    </Link>
                                  ) : null}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-3 lg:hidden">
        {customers.map((customer) => {
          const expanded = expandedIds.includes(customer.id);
          return (
            <div key={customer.id} className="rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,.96),rgba(2,6,23,.96))] p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold text-white">{customer.displayName}</div>
                  <div className="mt-1 text-sm text-slate-400">{customer.primaryPhone || customer.primaryEmail || "No contact details"}</div>
                </div>
                <button
                  onClick={() => toggleExpanded(customer.id)}
                  className="rounded-xl border border-white/10 p-2 text-slate-200"
                  aria-label={expanded ? "Collapse customer row" : "Expand customer row"}
                >
                  {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </button>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <MetricCard label="Orders" value={String(customer.totalOrders)} />
                <MetricCard label="Receipts" value={String(customer.totalReceipts)} />
                <MetricCard label="Spend" value={money(customer.totalSpend)} />
                <MetricCard label="Last activity" value={dateTime(customer.lastPurchaseAt)} />
              </div>

              {expanded ? (
                <div className="mt-4 space-y-4 border-t border-white/10 pt-4">
                  <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4 text-sm text-slate-200">
                    <div className="font-medium text-white">Purchased items</div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {customer.topProducts.map((item) => (
                        <span key={`${customer.id}-${item.name}-${item.sku ?? "no-sku"}`} className="rounded-full border border-white/10 px-3 py-1.5 text-xs">
                          {item.name} x{item.quantity}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-3">
                    {customer.orders.slice(0, 5).map((order) => (
                      <div key={order.id} className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                        <div className="font-medium text-white">{order.orderNumber}</div>
                        <div className="mt-1 text-xs text-slate-500">{dateTime(order.createdAt)} · {order.shopName || "No shop"}</div>
                        <div className="mt-2 text-sm font-semibold text-emerald-300">{money(order.totalAmount)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
