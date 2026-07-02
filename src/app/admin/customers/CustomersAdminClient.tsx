"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  ChevronDown,
  ChevronRight,
  History,
  Mail,
  MessageCircle,
  Phone,
  Receipt,
  ShoppingBag,
  Store,
  UserRound,
} from "lucide-react";
import type { AdminCustomerRow } from "@/lib/adminCustomers";
import { buildAdminCustomerProfileHref } from "@/lib/adminCustomerProfileLinks";

type CustomerRow = Omit<AdminCustomerRow, "firstPurchaseAt" | "lastPurchaseAt" | "orders"> & {
  firstPurchaseAt: string | null;
  lastPurchaseAt: string | null;
  orders: Array<Omit<AdminCustomerRow["orders"][number], "createdAt" | "receiptGeneratedAt"> & {
    createdAt: string;
    receiptGeneratedAt: string | null;
  }>;
};

type CustomerContext = {
  profile: {
    displayName: string;
    accountUserId: string | null;
    phones: string[];
    emails: string[];
    location: string | null;
    customerSince: string | null;
  };
  account: {
    exists: boolean;
    lastLoginMethod: string | null;
    phoneVerifiedAt: string | null;
    emailVerifiedAt: string | null;
    hasPortalAccess: boolean;
    createdAt: string | null;
  };
  voice: {
    totalCalls: number;
    answeredCalls: number;
    missedCalls: number;
    attemptedCalls: number;
    openFollowUps: number;
    callbackRequests: number;
    requestedCallbacks: number;
    lastCallAt: string | null;
    lastCallStatusLabel: string | null;
    lastCallAgent: string | null;
    latestAssignedAgent: string | null;
    lastRequestedCallbackAt: string | null;
    lastRequestedCallbackBy: string | null;
  };
  sales: {
    totalPurchasesValue: number;
    openQuotations: number;
    pendingWebOrders: number;
    pendingPod: number;
    lastPurchaseAt: string | null;
  };
  chatrace: {
    found: boolean;
    lastInteractionAt: string | null;
    tags: string[];
    inboxUrl: string | null;
    channel: string | null;
    sourceError: boolean;
  };
  quickLinks: {
    voiceHistoryHref: string | null;
    lastCallHref: string | null;
    receiptDeskHref: string | null;
    lastReceiptHref: string | null;
    quotationHref: string | null;
    webOrdersHref: string | null;
    chatraceInboxHref: string | null;
  };
  timeline: Array<{
    id: string;
    title: string;
    detail: string;
    at: string;
    href: string | null;
    tone: "voice" | "sales" | "account" | "support" | "chatrace";
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

function buildPortalLoginHref(args: {
  customerUserId?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
  callbackUrl?: string;
}) {
  const params = new URLSearchParams();
  if (args.customerUserId) params.set("userId", args.customerUserId);
  if (args.customerName) params.set("name", args.customerName);
  if (args.customerPhone) params.set("phone", args.customerPhone);
  if (args.customerEmail) params.set("email", args.customerEmail);
  params.set("callbackUrl", args.callbackUrl || "/account");
  return `/api/admin/customers/portal-login?${params.toString()}`;
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
      <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{label}</div>
      <div className="mt-2 text-lg font-semibold text-white">{value}</div>
    </div>
  );
}

function ContextBadge({
  label,
  tone = "slate",
}: {
  label: string;
  tone?: "emerald" | "amber" | "rose" | "cyan" | "violet" | "slate";
}) {
  const toneClass =
    tone === "emerald"
      ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-100"
      : tone === "amber"
        ? "border-amber-400/25 bg-amber-400/10 text-amber-100"
        : tone === "rose"
          ? "border-rose-400/25 bg-rose-400/10 text-rose-100"
          : tone === "cyan"
            ? "border-cyan-400/25 bg-cyan-400/10 text-cyan-100"
            : tone === "violet"
              ? "border-violet-400/25 bg-violet-400/10 text-violet-100"
              : "border-white/10 bg-white/[0.03] text-slate-200";
  return <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${toneClass}`}>{label}</span>;
}

function QuickLink({ href, label }: { href: string | null | undefined; label: string }) {
  if (!href) {
    return <span className="inline-flex rounded-full border border-white/5 px-3 py-1.5 text-xs text-slate-600">{label}</span>;
  }

  if (href.startsWith("http")) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 rounded-full border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-white/20 hover:text-white"
      >
        {label}
        <ArrowUpRight className="h-3 w-3" />
      </a>
    );
  }

  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 rounded-full border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-white/20 hover:text-white"
    >
      {label}
      <ArrowUpRight className="h-3 w-3" />
    </Link>
  );
}

function timelineToneClass(tone: CustomerContext["timeline"][number]["tone"]) {
  if (tone === "voice") return "border-cyan-400/20 bg-cyan-400/10 text-cyan-100";
  if (tone === "sales") return "border-emerald-400/20 bg-emerald-400/10 text-emerald-100";
  if (tone === "account") return "border-violet-400/20 bg-violet-400/10 text-violet-100";
  if (tone === "support") return "border-amber-400/20 bg-amber-400/10 text-amber-100";
  return "border-fuchsia-400/20 bg-fuchsia-400/10 text-fuchsia-100";
}

function statusTone(value: string | null | undefined) {
  const normalized = String(value || "").trim().toLowerCase();
  if (["answered", "connected", "contacted", "resolved"].includes(normalized)) return "emerald" as const;
  if (["attempted call", "attempted_call", "pending"].includes(normalized)) return "amber" as const;
  if (["missed", "failed", "no answer", "no_answer"].includes(normalized)) return "rose" as const;
  return "slate" as const;
}

export default function CustomersAdminClient({ customers }: { customers: CustomerRow[] }) {
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const [detailsById, setDetailsById] = useState<Record<string, CustomerContext | null>>({});
  const [loadingIds, setLoadingIds] = useState<string[]>([]);
  const [detailErrors, setDetailErrors] = useState<Record<string, string | null>>({});

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

  async function loadCustomerDetail(customer: CustomerRow) {
    if (detailsById[customer.id] || loadingIds.includes(customer.id)) return;
    setLoadingIds((current) => [...current, customer.id]);
    setDetailErrors((current) => ({ ...current, [customer.id]: null }));
    try {
      const params = new URLSearchParams();
      if (customer.customerUserId) params.set("customerUserId", customer.customerUserId);
      if (customer.displayName) params.set("displayName", customer.displayName);
      if (customer.phones.length) params.set("phones", customer.phones.join(","));
      if (customer.emails.length) params.set("emails", customer.emails.join(","));
      const response = await fetch(`/api/admin/customers/context?${params.toString()}`, {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error(`context_${response.status}`);
      }
      const payload = (await response.json()) as CustomerContext;
      setDetailsById((current) => ({ ...current, [customer.id]: payload }));
    } catch (error) {
      console.error("[admin.customers.context_failed]", error);
      setDetailErrors((current) => ({ ...current, [customer.id]: "Could not load full customer context." }));
    } finally {
      setLoadingIds((current) => current.filter((id) => id !== customer.id));
    }
  }

  function toggleExpanded(customer: CustomerRow) {
    const willExpand = !expandedIds.includes(customer.id);
    setExpandedIds((current) =>
      current.includes(customer.id) ? current.filter((id) => id !== customer.id) : [...current, customer.id],
    );
    if (willExpand) {
      void loadCustomerDetail(customer);
    }
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
        <div className="grid grid-cols-[56px_minmax(260px,1.9fr)_190px_110px_120px_160px_170px] items-center gap-3 border-b border-white/10 bg-slate-950/95 px-4 py-4 text-[11px] uppercase tracking-[0.18em] text-slate-500">
          <div />
          <div>Customer</div>
          <div>Contact</div>
          <div>Orders</div>
          <div>Receipts</div>
          <div>Total purchase</div>
          <div>Last activity</div>
        </div>
        <div className="divide-y divide-white/5">
          {customers.map((customer) => {
            const expanded = expandedIds.includes(customer.id);
            const detail = detailsById[customer.id];
            const profileHref = buildAdminCustomerProfileHref({
              customerUserId: customer.customerUserId,
              phone: customer.primaryPhone,
              phones: customer.phones,
              email: customer.primaryEmail,
              emails: customer.emails,
              displayName: customer.displayName,
            });
            return (
              <div key={customer.id} className="transition hover:bg-white/[0.02]">
                <div className="grid grid-cols-[56px_minmax(260px,1.9fr)_190px_110px_120px_160px_170px] items-center gap-3 px-4 py-4">
                  <div>
                    <button
                      onClick={() => toggleExpanded(customer)}
                      className="rounded-xl border border-white/10 p-2 text-slate-200 transition hover:border-white/20"
                      aria-label={expanded ? "Collapse customer row" : "Expand customer row"}
                    >
                      {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>
                  </div>
                  <div className="min-w-0">
                    <Link href={profileHref} className="font-semibold text-white transition hover:text-cyan-200">
                      {customer.displayName}
                    </Link>
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
                </div>

                {expanded ? (
                  <div className="border-t border-white/5 bg-slate-950/45 px-4 py-5">
                    <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
                      <div className="space-y-4">
                        {loadingIds.includes(customer.id) ? (
                          <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-sm text-slate-400">
                            Loading full customer context...
                          </div>
                        ) : null}
                        {detailErrors[customer.id] ? (
                          <div className="rounded-2xl border border-rose-400/25 bg-rose-400/10 p-4 text-sm text-rose-100">
                            {detailErrors[customer.id]}
                          </div>
                        ) : null}
                        {detail ? (
                          <div className="rounded-2xl border border-cyan-400/15 bg-slate-950/60 p-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Customer 360</div>
                                <div className="mt-1 text-lg font-semibold text-white">
                                  {detail.profile.displayName}
                                </div>
                                <div className="mt-1 text-sm text-slate-400">
                                  {detail.profile.location || "No location recorded"}
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {detail.voice.lastCallStatusLabel ? (
                                  <ContextBadge
                                    label={detail.voice.lastCallStatusLabel || "Voice"}
                                    tone={statusTone(detail.voice.lastCallStatusLabel)}
                                  />
                                ) : null}
                                <ContextBadge
                                  label={detail.account.hasPortalAccess ? "Portal Active" : "Portal Pending"}
                                  tone={detail.account.hasPortalAccess ? "emerald" : "slate"}
                                />
                                {detail.chatrace.found ? <ContextBadge label="Chatrace Found" tone="violet" /> : null}
                              </div>
                            </div>
                            <div className="mt-4 grid gap-3 sm:grid-cols-2">
                              <MetricCard label="Calls" value={String(detail.voice.totalCalls || 0)} />
                              <MetricCard label="Last call" value={dateTime(detail.voice.lastCallAt)} />
                              <MetricCard label="Voice owner" value={detail.voice.latestAssignedAgent || "Unassigned"} />
                              <MetricCard label="Customer since" value={dateTime(detail.profile.customerSince)} />
                            </div>
                            <div className="mt-4 flex flex-wrap gap-2">
                              <QuickLink href={profileHref} label="Open full profile" />
                              <QuickLink href={detail.quickLinks.lastCallHref} label="Open last call" />
                              <QuickLink href={detail.quickLinks.voiceHistoryHref} label="Open voice history" />
                              <QuickLink href={detail.quickLinks.lastReceiptHref} label="Open last receipt" />
                              <QuickLink href={detail.quickLinks.receiptDeskHref} label="Open receipts desk" />
                              <QuickLink href={detail.quickLinks.quotationHref} label="Open quotations" />
                              <QuickLink href={detail.quickLinks.webOrdersHref} label="Open web orders" />
                              <QuickLink href={detail.quickLinks.chatraceInboxHref} label="Open Chatrace inbox" />
                            </div>
                          </div>
                        ) : null}
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
                            {customer.orders.find((order) => order.referredByAgentName || order.attributionCodeUsed) ? (
                              <div className="flex items-start gap-2">
                                <UserRound className="mt-0.5 h-4 w-4 text-violet-300" />
                                <div>
                                  {customer.orders.find((order) => order.referredByAgentName || order.attributionCodeUsed)?.referredByAgentName || "Attributed referral"}
                                  {customer.orders.find((order) => order.referredByAgentName || order.attributionCodeUsed)?.attributionCodeUsed
                                    ? ` · code ${customer.orders.find((order) => order.referredByAgentName || order.attributionCodeUsed)?.attributionCodeUsed}`
                                    : ""}
                                </div>
                              </div>
                            ) : null}
                          </div>
                          <div className="mt-4 flex flex-wrap gap-2 text-xs">
                            <a
                              href={buildPortalLoginHref({
                                customerUserId: customer.customerUserId,
                                customerName: customer.displayName,
                                customerPhone: customer.primaryPhone,
                                customerEmail: customer.primaryEmail,
                                callbackUrl: "/account",
                              })}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1.5 font-semibold text-emerald-100 transition hover:border-emerald-300/35"
                            >
                              Open customer account
                            </a>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        {detail ? (
                          <div className="grid gap-4 xl:grid-cols-2">
                            <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                              <div className="flex items-center justify-between gap-3">
                                <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Voice and support</div>
                                <History className="h-4 w-4 text-cyan-300" />
                              </div>
                              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                <MetricCard label="Answered" value={String(detail.voice.answeredCalls || 0)} />
                                <MetricCard label="Missed" value={String(detail.voice.missedCalls || 0)} />
                                <MetricCard label="Attempted" value={String(detail.voice.attemptedCalls || 0)} />
                                <MetricCard label="Open follow-ups" value={String(detail.voice.openFollowUps || 0)} />
                              </div>
                              <div className="mt-3 flex flex-wrap gap-2">
                                {detail.voice.lastRequestedCallbackAt ? (
                                  <ContextBadge label="Requested Callback" tone="emerald" />
                                ) : null}
                                <ContextBadge
                                  label={`Callback Requests ${detail.voice.callbackRequests || 0}`}
                                  tone="amber"
                                />
                              </div>
                              <div className="mt-3 space-y-2 text-sm text-slate-300">
                                <div>Last call agent: {detail.voice.lastCallAgent || "No agent recorded"}</div>
                                <div>Last callback request: {dateTime(detail.voice.lastRequestedCallbackAt)}</div>
                                <div>Requested by: {detail.voice.lastRequestedCallbackBy || "No callback request yet"}</div>
                              </div>
                            </div>

                            <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                              <div className="flex items-center justify-between gap-3">
                                <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Portal and Chatrace</div>
                                <MessageCircle className="h-4 w-4 text-violet-300" />
                              </div>
                              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                <MetricCard label="Portal" value={detail.account.exists ? "Linked" : "Not linked"} />
                                <MetricCard label="Sign-in method" value={detail.account.lastLoginMethod || "Not recorded"} />
                                <MetricCard label="Phone verified" value={dateTime(detail.account.phoneVerifiedAt)} />
                                <MetricCard label="Last Chatrace" value={dateTime(detail.chatrace.lastInteractionAt)} />
                              </div>
                              <div className="mt-3 space-y-2 text-sm text-slate-300">
                                <div>Email verified: {dateTime(detail.account.emailVerifiedAt)}</div>
                                <div>Portal created: {dateTime(detail.account.createdAt)}</div>
                                <div>Chatrace channel: {detail.chatrace.channel || "Not recorded"}</div>
                                <div>Tags: {detail.chatrace.tags.join(", ") || "No tags"}</div>
                              </div>
                            </div>
                          </div>
                        ) : null}

                        {detail ? (
                          <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                            <div className="flex items-center justify-between gap-3">
                              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Cross-system timeline</div>
                              <div className="text-xs text-slate-500">{detail.timeline.length} recent events</div>
                            </div>
                            <div className="mt-4 space-y-3">
                              {detail.timeline.length ? (
                                detail.timeline.map((item) => (
                                  <div key={item.id} className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
                                    <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                                      <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                          <ContextBadge
                                            label={item.tone}
                                            tone={
                                              item.tone === "voice"
                                                ? "cyan"
                                                : item.tone === "sales"
                                                  ? "emerald"
                                                  : item.tone === "account"
                                                    ? "violet"
                                                    : item.tone === "support"
                                                      ? "amber"
                                                      : "rose"
                                            }
                                          />
                                          <div className="font-semibold text-white">{item.title}</div>
                                        </div>
                                        <div className="mt-2 text-sm text-slate-300">{item.detail}</div>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <div className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${timelineToneClass(item.tone)}`}>
                                          {dateTime(item.at)}
                                        </div>
                                        <QuickLink href={item.href} label="Open" />
                                      </div>
                                    </div>
                                  </div>
                                ))
                              ) : (
                                <div className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-sm text-slate-500">
                                  No cross-system events found for this customer yet.
                                </div>
                              )}
                            </div>
                          </div>
                        ) : null}

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
                                    {order.referredByAgentName || order.attributionCodeUsed ? (
                                      <div className="mt-1 text-xs text-violet-300">
                                        Referred by {order.referredByAgentName || "agent"}
                                        {order.attributionCodeUsed ? ` · code ${order.attributionCodeUsed}` : ""}
                                      </div>
                                    ) : null}
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
                                  {order.routeId ? (
                                    <a
                                      href={buildPortalLoginHref({
                                        customerUserId: order.customerUserId || customer.customerUserId,
                                        customerName: order.customerName || customer.displayName,
                                        customerPhone: order.customerPhone || customer.primaryPhone,
                                        customerEmail: order.customerEmail || customer.primaryEmail,
                                        callbackUrl: `/account/orders/${order.routeId}`,
                                      })}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1.5 font-semibold text-emerald-100 transition hover:border-emerald-300/35"
                                    >
                                      Open customer order
                                    </a>
                                  ) : null}
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
          const detail = detailsById[customer.id];
          const profileHref = buildAdminCustomerProfileHref({
            customerUserId: customer.customerUserId,
            phone: customer.primaryPhone,
            phones: customer.phones,
            email: customer.primaryEmail,
            emails: customer.emails,
            displayName: customer.displayName,
          });
          return (
            <div key={customer.id} className="rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,.96),rgba(2,6,23,.96))] p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link href={profileHref} className="font-semibold text-white transition hover:text-cyan-200">
                    {customer.displayName}
                  </Link>
                  <div className="mt-1 text-sm text-slate-400">{customer.primaryPhone || customer.primaryEmail || "No contact details"}</div>
                </div>
                <button
                  onClick={() => toggleExpanded(customer)}
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
                  {loadingIds.includes(customer.id) ? (
                    <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4 text-sm text-slate-400">
                      Loading full customer context...
                    </div>
                  ) : null}
                  {detailErrors[customer.id] ? (
                    <div className="rounded-2xl border border-rose-400/25 bg-rose-400/10 p-4 text-sm text-rose-100">
                      {detailErrors[customer.id]}
                    </div>
                  ) : null}
                  {detail ? (
                    <div className="rounded-2xl border border-cyan-400/15 bg-slate-950/50 p-4">
                      <div className="flex flex-wrap gap-2">
                        {detail.voice.lastCallStatusLabel ? (
                          <ContextBadge label={detail.voice.lastCallStatusLabel} tone={statusTone(detail.voice.lastCallStatusLabel)} />
                        ) : null}
                        <ContextBadge label={detail.account.hasPortalAccess ? "Portal Active" : "Portal Pending"} tone={detail.account.hasPortalAccess ? "emerald" : "slate"} />
                        {detail.voice.lastRequestedCallbackAt ? <ContextBadge label="Requested Callback" tone="emerald" /> : null}
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-3">
                        <MetricCard label="Calls" value={String(detail.voice.totalCalls)} />
                        <MetricCard label="Missed" value={String(detail.voice.missedCalls)} />
                        <MetricCard label="Attempted" value={String(detail.voice.attemptedCalls)} />
                        <MetricCard label="Last Chatrace" value={dateTime(detail.chatrace.lastInteractionAt)} />
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <QuickLink href={profileHref} label="Full profile" />
                        <QuickLink href={detail.quickLinks.lastCallHref} label="Open last call" />
                        <QuickLink href={detail.quickLinks.receiptDeskHref} label="Receipts desk" />
                        <QuickLink href={detail.quickLinks.chatraceInboxHref} label="Chatrace" />
                      </div>
                    </div>
                  ) : null}
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
                  <div className="flex flex-wrap gap-2 text-xs">
                    <a
                      href={buildPortalLoginHref({
                        customerUserId: customer.customerUserId,
                        customerName: customer.displayName,
                        customerPhone: customer.primaryPhone,
                        customerEmail: customer.primaryEmail,
                        callbackUrl: "/account",
                      })}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1.5 font-semibold text-emerald-100 transition hover:border-emerald-300/35"
                    >
                      Open customer account
                    </a>
                  </div>
                  <div className="space-y-3">
                    {customer.orders.slice(0, 5).map((order) => (
                      <div key={order.id} className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                        <div className="font-medium text-white">{order.orderNumber}</div>
                        <div className="mt-1 text-xs text-slate-500">{dateTime(order.createdAt)} · {order.shopName || "No shop"}</div>
                        {order.referredByAgentName || order.attributionCodeUsed ? (
                          <div className="mt-1 text-xs text-violet-300">
                            Referred by {order.referredByAgentName || "agent"}
                            {order.attributionCodeUsed ? ` · code ${order.attributionCodeUsed}` : ""}
                          </div>
                        ) : null}
                        <div className="mt-2 text-sm font-semibold text-emerald-300">{money(order.totalAmount)}</div>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs">
                          {order.routeId ? (
                            <a
                              href={buildPortalLoginHref({
                                customerUserId: order.customerUserId || customer.customerUserId,
                                customerName: order.customerName || customer.displayName,
                                customerPhone: order.customerPhone || customer.primaryPhone,
                                customerEmail: order.customerEmail || customer.primaryEmail,
                                callbackUrl: `/account/orders/${order.routeId}`,
                              })}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1.5 font-semibold text-emerald-100 transition hover:border-emerald-300/35"
                            >
                              Open customer order
                            </a>
                          ) : null}
                          <Link
                            href={`/admin/orders?q=${encodeURIComponent(order.orderNumber)}`}
                            className="rounded-full border border-white/10 px-3 py-1.5 text-slate-300 transition hover:border-white/20 hover:text-white"
                          >
                            Open in orders
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                  {detail?.timeline?.length ? (
                    <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Recent timeline</div>
                      <div className="mt-3 space-y-3">
                        {detail.timeline.slice(0, 5).map((item) => (
                          <div key={item.id} className="rounded-xl border border-white/5 bg-white/[0.03] px-3 py-3">
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <div className="truncate font-medium text-white">{item.title}</div>
                                <div className="mt-1 text-xs text-slate-400">{item.detail}</div>
                              </div>
                              <div className="text-right text-[11px] text-slate-500">{dateTime(item.at)}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
