"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import ReceiptFormClient from "./ReceiptFormClient";
import DailyReportReceiptsPanel from "@/components/daily-report-receipts";
import QuotationRequestsDeskClient from "@/components/QuotationRequestsDeskClient";
import LipaPolePoleAdminClient from "@/app/admin/lipa-pole-pole/LipaPolePoleAdminClient";
import { buildAdminCustomerProfileHref } from "@/lib/adminCustomerProfileLinks";
import { getTradingPeriodFor } from "@/lib/tradingPeriod";

type ReceiptRow = {
  id: string;
  orderRef?: string;
  docType: string;
  createdAt: string;
  customerName?: string | null;
  attendantName?: string | null;
  total?: number | null;
  status?: string | null;
  items?: any[];
  source?: "pos" | "marketing" | "support";
  detailUrl?: string | null;
};

type PublicStaffOption = {
  id: string;
  name: string | null;
  email: string | null;
  attendantCategory?: string | null;
};

export default function ReceiptsPageClient({
  initial,
  initialOnlyPos = true,
}: {
  initial: ReceiptRow[];
  initialOnlyPos?: boolean;
}) {
  const [view, setView] = useState<"create" | "list">("create");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ReceiptRow[]>(initial ?? []);
  const [loading, setLoading] = useState(false);
  const [totals, setTotals] = useState<{ count: number; amount: number; items: number }>({
    count: 0,
    amount: 0,
    items: 0,
  });
  const [page, setPage] = useState(1);
  const size = 10;
  const [attendantId, setAttendantId] = useState<string | null>(null);
  const [onlyPos] = useState(initialOnlyPos);
  const [fromDate, setFromDate] = useState<string | null>(null);
  const [toDate, setToDate] = useState<string | null>(null);
  const defaultTradingPeriod = getTradingPeriodFor(new Date());
  const defaultPeriodStart = defaultTradingPeriod.start.toLocaleDateString("en-CA", { timeZone: "Africa/Nairobi" });
  const defaultPeriodEnd = defaultTradingPeriod.end.toLocaleDateString("en-CA", { timeZone: "Africa/Nairobi" });
  const [historyStart, setHistoryStart] = useState<string>(defaultPeriodStart);
  const [historyEnd, setHistoryEnd] = useState<string>(defaultPeriodEnd);
  const [historySearch, setHistorySearch] = useState("");
  const [attendantInput, setAttendantInput] = useState("");
  const [debouncedHistorySearch, setDebouncedHistorySearch] = useState("");
  const [historySummary, setHistorySummary] = useState<{ count: number; totalSales: number }>({
    count: 0,
    totalSales: 0,
  });
  const [createDocumentType, setCreateDocumentType] = useState<"RECEIPT" | "QUOTATION" | "LPP">("RECEIPT");
  const [quotationStaffOptions, setQuotationStaffOptions] = useState<PublicStaffOption[]>([]);
  const [quotationStaffLoading, setQuotationStaffLoading] = useState(false);

  const listRef = useRef<HTMLDivElement | null>(null);
  const formRef = useRef<HTMLDivElement | null>(null);

  const scrollIntoView = (ref: React.RefObject<HTMLDivElement | null>) => {
    if (ref.current) {
      ref.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const handleCreated = (
    _receipt?: any,
    context?: { staffId: string | null; serial: string; receiptId: string | null }
  ) => {
    if (context?.staffId) {
      setAttendantId(context.staffId);
      setHistorySearch(context.serial);
      setView("list");
      setTimeout(() => scrollIntoView(listRef), 100);
      return;
    }
    setView("create");
    setTimeout(() => scrollIntoView(formRef), 100);
  };

  const doSearch = async (opts?: { page?: number }) => {
    setLoading(true);
    try {
      const nextPage = opts?.page ?? page;
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      if (fromDate) params.set("from", fromDate);
      if (toDate) params.set("to", toDate);
      params.set("includeItems", "true");
      params.set("scope", "mine");
      if (onlyPos) params.set("onlyPos", "1");
      params.set("page", String(nextPage));
      params.set("size", String(size));
      if (attendantId) params.set("attendantId", attendantId);
      const res = await fetch(`/api/receipts?${params.toString()}`, { cache: "no-store" });
      const data = await res.json();
      setResults(data.receipts || []);
      // Try to read totals from API; otherwise compute locally
      if (data.totals) {
        setTotals({ count: data.totals.count || 0, amount: data.totals.amount || 0, items: data.totals.items || 0 });
      } else {
        const computedCount = (data.receipts || []).length;
        const computedAmount = (data.receipts || []).reduce((s: number, r: ReceiptRow) => s + (r.total || 0), 0);
        const computedItems = (data.receipts || []).reduce((s: number, r: ReceiptRow) => s + ((r.items && r.items.length) || 0), 0);
        setTotals({ count: computedCount, amount: computedAmount, items: computedItems });
      }
      setPage(data.paging?.page ?? nextPage);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (view !== "list" || attendantId) return;
    const t = setTimeout(() => doSearch({ page: 1 }), 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, view, attendantId]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedHistorySearch(historySearch), 250);
    return () => clearTimeout(t);
  }, [historySearch]);

  useEffect(() => {
    if (view !== "create" || createDocumentType !== "QUOTATION" || quotationStaffOptions.length) return;
    let cancelled = false;
    setQuotationStaffLoading(true);
    fetch("/api/receipts/staff", { cache: "no-store" })
      .then((response) => response.json().catch(() => []))
      .then((data) => {
        if (cancelled) return;
        setQuotationStaffOptions(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (cancelled) return;
        setQuotationStaffOptions([]);
      })
      .finally(() => {
        if (!cancelled) setQuotationStaffLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [createDocumentType, quotationStaffOptions.length, view]);

  // On mount, detect attendantId in the URL and open list view filtered to that attendant
  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        const sp = new URLSearchParams(window.location.search);
        const aid = sp.get("attendantId");
        const start = sp.get("start");
        const end = sp.get("end");
        if (aid) {
          setAttendantId(aid);
          setView("list");
          if (start) setHistoryStart(start);
          if (end) setHistoryEnd(end);
          // If server-side provided initial receipts, prefer them; otherwise trigger search
          if (!initial || initial.length === 0) {
            void doSearch({ page: 1 });
          } else {
            setResults(initial || []);
          }
        }
      }
    } catch (e) {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openListView = () => {
    setView("list");
    setTimeout(() => scrollIntoView(listRef), 100);
    void doSearch({ page: 1 });
  };

  const openCreateView = () => {
    setView("create");
    setTimeout(() => scrollIntoView(formRef), 100);
  };

  const setHistoryRange = (range: "today" | "yesterday" | "thisWeek" | "period") => {
    const now = new Date();
    if (range === "today") {
      const iso = now.toISOString().slice(0, 10);
      setHistoryStart(iso);
      setHistoryEnd(iso);
      return;
    }
    if (range === "yesterday") {
      const d = new Date(now);
      d.setDate(d.getDate() - 1);
      const iso = d.toISOString().slice(0, 10);
      setHistoryStart(iso);
      setHistoryEnd(iso);
      return;
    }
    if (range === "thisWeek") {
      const d = new Date(now);
      const day = d.getDay();
      const diffToMonday = day === 0 ? -6 : 1 - day;
      const start = new Date(d);
      start.setDate(d.getDate() + diffToMonday);
      setHistoryStart(start.toISOString().slice(0, 10));
      setHistoryEnd(now.toISOString().slice(0, 10));
      return;
    }
    const period = getTradingPeriodFor(now);
    setHistoryStart(period.start.toLocaleDateString("en-CA", { timeZone: "Africa/Nairobi" }));
    setHistoryEnd(period.end.toLocaleDateString("en-CA", { timeZone: "Africa/Nairobi" }));
  };

  if (view === "list" && attendantId) {
    return (
      <div className="page-shell space-y-6 py-6">
        <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-xl shadow-black/40">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-4xl font-semibold text-white">Receipts history</h1>
              <p className="mt-2 text-sm text-slate-300">
                Browse your POS receipts and open the same shared receipt page used across the system.
              </p>
            </div>
            <button
              type="button"
              onClick={() => window.history.back()}
              className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-100 hover:bg-white/10"
            >
              Back
            </button>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-xl shadow-black/40">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Receipts list</p>
              <h2 className="text-2xl font-semibold text-white">Read-only receipts history</h2>
              <p className="text-sm text-slate-400">
                Explore your POS receipts, filter by date range, and open the shared receipt detail view.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-wide">
              {[
                { key: "today", label: "Today" },
                { key: "yesterday", label: "Yesterday" },
                { key: "thisWeek", label: "This week" },
                { key: "period", label: "This period" },
              ].map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setHistoryRange(option.key as "today" | "yesterday" | "thisWeek" | "period")}
                  className="rounded-full border border-white/15 px-4 py-1 text-slate-200 hover:border-emerald-500 hover:text-white"
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-3">
            <label className="text-xs uppercase tracking-wide text-slate-400">
              Search
              <input
                type="search"
                placeholder="Customer, attendant, receipt..."
                value={historySearch}
                onChange={(event) => setHistorySearch(event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
            </label>
            <label className="text-xs uppercase tracking-wide text-slate-400">
              Start date
              <input
                type="date"
                value={historyStart}
                onChange={(event) => setHistoryStart(event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
            </label>
            <label className="text-xs uppercase tracking-wide text-slate-400">
              End date
              <input
                type="date"
                value={historyEnd}
                onChange={(event) => setHistoryEnd(event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
            </label>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3">
              <p className="text-[11px] uppercase tracking-wide text-slate-400">Range</p>
              <p className="text-sm font-semibold text-slate-100">Selected</p>
              <p className="text-xs text-slate-400">
                Showing receipts from {historyStart} to {historyEnd}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3">
              <p className="text-[11px] uppercase tracking-wide text-slate-400">Receipts</p>
              <p className="text-2xl font-semibold text-emerald-300">{historySummary.count}</p>
              <p className="text-xs text-slate-400">Captured in the selected window</p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3">
              <p className="text-[11px] uppercase tracking-wide text-slate-400">Total sales</p>
              <p className="text-2xl font-semibold text-emerald-300">
                KES {historySummary.totalSales.toLocaleString("en-KE", { maximumFractionDigits: 0 })}
              </p>
              <p className="text-xs text-slate-400">Aggregated from the receipts below</p>
            </div>
          </div>

          <div className="mt-4">
            <DailyReportReceiptsPanel
              start={historyStart}
              end={historyEnd}
              q={debouncedHistorySearch}
              attendantId={attendantId}
              hideHeader
              onlyPos
              emptyMessage="No receipts found for this date."
              onSummary={(summary) => setHistorySummary(summary)}
            />
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="page-shell space-y-6 py-6">
      {view === "create" && (
        <section
          ref={formRef}
          className="rounded-3xl border border-white/10 bg-slate-900/80 p-4 shadow-xl shadow-black/40 sm:p-6"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Operations Desk</p>
              <h1 className="text-2xl font-semibold text-white">Receipts, PODs &amp; Quotations</h1>
              <p className="text-sm text-slate-400">Create, save, print, and manage customer documents.</p>
            </div>
            <button
              onClick={openListView}
              className="w-full rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-black hover:brightness-95 sm:w-auto"
            >
              View receipts
            </button>
          </div>

          {/* Totals panel removed per request */}
          <div className="mt-4">
            <div className="mb-4 grid gap-2 sm:flex sm:flex-wrap">
              {([
                ["RECEIPT", "Receipt / POD flow"],
                ["QUOTATION", "Quotation flow"],
                ["LPP", "Lipa Pole Pole"],
              ] as const).map(([type, label]) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setCreateDocumentType(type)}
                  className={`w-full rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-wide transition sm:w-auto ${
                    createDocumentType === type
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                      : "border-white/10 text-slate-300 hover:border-white/20 hover:text-white"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {createDocumentType === "QUOTATION" ? (
              <div className="space-y-3">
                {quotationStaffLoading && !quotationStaffOptions.length ? (
                  <div className="rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-slate-300">
                    Loading quotation staff...
                  </div>
                ) : null}
                <QuotationRequestsDeskClient
                  apiBasePath="/api/public/quotation-center"
                  deskTitle="Public quotation builder"
                  deskDescription="Choose the staff owner, build the quotation here, and notify the customer immediately after save."
                  compactMode
                  enableCreate
                  createOnlyMode
                  initialCreateOpen
                  allowTemplateSelection
                  allowTemplateManager={false}
                  createApiPath="/api/public/quotation-center/create"
                  createActionLabel="Save quotation and notify customer"
                  createSuccessMessage="Quotation saved and customer notification has been triggered."
                  assigneeOptions={quotationStaffOptions}
                  assigneeLabel="Assign quotation to staff"
                  requireAssigneeSelection
                />
              </div>
            ) : createDocumentType === "LPP" ? (
              <div>
                <LipaPolePoleAdminClient
                  initialItems={[]}
                  initialDetail={null}
                  initialQ=""
                  initialStatus="ALL"
                  embeddedCreateMode
                  onCancelInlineCreate={() => setCreateDocumentType("RECEIPT")}
                />
              </div>
            ) : (
              <ReceiptFormClient onCreated={handleCreated} showHero={false} />
            )}
          </div>
        </section>
      )}

      {view === "list" && (
        <section
          ref={listRef}
          className="rounded-2xl border border-white/10 bg-slate-900/70 p-6 shadow-xl shadow-black/30"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                {attendantId ? "My POS receipts" : "Receipts desk"}
              </p>
              <h2 className="text-xl font-semibold text-white">
                {attendantId ? "Read-only POS receipts history" : "Search POS receipts"}
              </h2>
              <p className="text-sm text-slate-400">
                {attendantId
                  ? "Browse your POS receipts only. Open any row to print, send, or change payment method on the shared receipt page."
                  : "Search your POS receipts by receipt number, customer phone, or attendant name."}
              </p>
            </div>
            <button
              onClick={openCreateView}
              className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-white/10"
            >
              Create receipt
            </button>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
            {!attendantId && (
              <div className="col-span-1">
                <label className="text-xs uppercase tracking-wide text-slate-400">
                  Attendant ID
                  <div className="mt-1 flex gap-2">
                    <input
                      type="text"
                      placeholder="Enter attendant id"
                      value={attendantInput}
                      onChange={(e) => setAttendantInput(e.target.value)}
                      className="w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (attendantInput.trim()) {
                          setAttendantId(attendantInput.trim());
                          setView("list");
                          void doSearch({ page: 1 });
                        }
                      }}
                      className="rounded-xl bg-emerald-500 px-3 py-2 text-sm font-semibold text-black"
                    >
                      Load
                    </button>
                  </div>
                </label>
              </div>
            )}
            <div className="col-span-2">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex gap-2">
                  {[
                    { key: "today", label: "Today" },
                    { key: "yesterday", label: "Yesterday" },
                    { key: "week", label: "Week" },
                    { key: "month", label: "Month" },
                    { key: "custom", label: "Custom" },
                  ].map((p) => (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => {
                        const now = new Date();
                        let f: Date | null = null;
                        let t: Date | null = null;
                        if (p.key === "today") {
                          f = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                          t = new Date(f);
                        } else if (p.key === "yesterday") {
                          const y = new Date(now);
                          y.setDate(y.getDate() - 1);
                          f = new Date(y.getFullYear(), y.getMonth(), y.getDate());
                          t = new Date(f);
                        } else if (p.key === "week") {
                          const start = new Date(now);
                          start.setDate(start.getDate() - 6);
                          f = new Date(start.getFullYear(), start.getMonth(), start.getDate());
                          t = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                        } else if (p.key === "month") {
                          const start = new Date(now.getFullYear(), now.getMonth(), 1);
                          f = new Date(start.getFullYear(), start.getMonth(), start.getDate());
                          t = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                        } else {
                          // custom: keep existing and focus inputs
                          setFromDate(fromDate);
                          setToDate(toDate);
                          return;
                        }
                        const fmt = (d: Date) => d.toISOString().slice(0, 10);
                        setFromDate(f ? fmt(f) : null);
                        setToDate(t ? fmt(t) : null);
                        void doSearch({ page: 1 });
                      }}
                      className="rounded-full bg-slate-800 px-3 py-1 text-sm text-slate-200 hover:bg-slate-700"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  placeholder="Receipt number, customer phone or attendant"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="ml-2 flex-1 rounded-lg bg-slate-900 p-2 text-white placeholder-slate-500"
                />
              </div>

              <div className="mt-2 flex items-center gap-2">
                <label className="text-xs text-slate-400">From</label>
                <input
                  type="date"
                  value={fromDate ?? ""}
                  onChange={(e) => setFromDate(e.target.value || null)}
                  className="rounded bg-slate-900 p-1 text-sm text-white"
                />
                <label className="text-xs text-slate-400">To</label>
                <input
                  type="date"
                  value={toDate ?? ""}
                  onChange={(e) => setToDate(e.target.value || null)}
                  className="rounded bg-slate-900 p-1 text-sm text-white"
                />
                <button
                  type="button"
                  onClick={() => doSearch({ page: 1 })}
                  className="ml-2 rounded-full bg-emerald-500 px-3 py-1 text-sm font-semibold text-black"
                >
                  Apply
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFromDate(null);
                    setToDate(null);
                    void doSearch({ page: 1 });
                  }}
                  className="ml-2 rounded-full border border-white/10 px-3 py-1 text-sm text-slate-200"
                >
                  Reset
                </button>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => doSearch()}
                className="flex-1 rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-black"
              >
                {loading ? "Searching..." : "Search"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setResults([]);
                  setQuery("");
                }}
                className="rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200"
              >
                Clear
              </button>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {results.length === 0 ? (
              <p className="text-sm text-slate-400">No receipts found. Try a different query.</p>
            ) : (
              results.map((r) => {
                const customerProfileHref = buildAdminCustomerProfileHref({
                  phone: (r as any).customerPhone ?? null,
                  email: (r as any).customerEmail ?? null,
                  displayName: r.customerName ?? null,
                });
                return (
                <div key={r.id} className="flex items-center justify-between rounded-md bg-slate-950/40 p-3">
                  <div>
                    <div className="text-sm font-semibold">{r.orderRef || r.id}</div>
                    <div className="text-xs text-slate-400">
                      <Link href={customerProfileHref} className="transition hover:text-cyan-300">
                        {r.customerName || "-"}
                      </Link>{" "}
                      - {(r as any).customerPhone || "-"}
                    </div>
                  </div>
                {r.detailUrl ? (
                  <Link
                    href={r.detailUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-full bg-emerald-500 px-3 py-1 text-xs font-semibold text-black"
                  >
                    View receipt
                  </Link>
                ) : (
                  <span className="text-xs text-slate-400">Receipt preview unavailable</span>
                )}
                </div>
              )})
            )}
          </div>

          {results.length > 0 && (
            <div className="mt-4 flex items-center justify-between">
              <div className="text-sm text-slate-400">Showing {results.length} results</div>
              <div className="flex items-center gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => {
                    const next = Math.max(1, page - 1);
                    setPage(next);
                    doSearch({ page: next });
                  }}
                  className="rounded border border-white/10 px-3 py-1 text-sm text-slate-200 disabled:opacity-40"
                >
                  Prev
                </button>
                <div className="text-sm text-slate-200">Page {page}</div>
                <button
                  onClick={() => {
                    const next = page + 1;
                    setPage(next);
                    doSearch({ page: next });
                  }}
                  className="rounded border border-white/10 px-3 py-1 text-sm text-slate-200"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
