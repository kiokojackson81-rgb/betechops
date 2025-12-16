"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import ReceiptFormClient from "./ReceiptFormClient";

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
};

export default function ReceiptsPageClient({ initial }: { initial: ReceiptRow[] }) {
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
  const [fromDate, setFromDate] = useState<string | null>(null);
  const [toDate, setToDate] = useState<string | null>(null);

  const listRef = useRef<HTMLDivElement | null>(null);
  const formRef = useRef<HTMLDivElement | null>(null);

  const scrollIntoView = (ref: React.RefObject<HTMLDivElement | null>) => {
    if (ref.current) {
      ref.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const handleCreated = () => {
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
    if (view !== "list") return;
    const t = setTimeout(() => doSearch({ page: 1 }), 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, view]);

  // On mount, detect attendantId in the URL and open list view filtered to that attendant
  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        const sp = new URLSearchParams(window.location.search);
        const aid = sp.get("attendantId");
        if (aid) {
          setAttendantId(aid);
          setView("list");
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

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {view === "create" && (
        <section
          ref={formRef}
          className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-xl shadow-black/40"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Receipts desk</p>
              <h1 className="text-2xl font-semibold text-white">Betech Customers Operations</h1>
              <p className="text-sm text-slate-400">
                Track every printable document, search by customer, and open the PDF drawer without leaving this page.
              </p>
            </div>
            <button
              onClick={openListView}
              className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-black hover:brightness-95"
            >
              View receipts
            </button>
          </div>

          {/* Totals panel */}
          <div className="mt-4 flex items-center justify-end">
            <div className="rounded-lg bg-slate-950/50 px-4 py-2 text-sm text-slate-200">
              <div className="flex gap-4">
                <div>
                  <div className="text-xs text-slate-400">Receipts</div>
                  <div className="text-lg font-semibold">{totals.count}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-400">Amount</div>
                  <div className="text-lg font-semibold">KSh {totals.amount.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-400">Items</div>
                  <div className="text-lg font-semibold">{totals.items}</div>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-4">
            <ReceiptFormClient onCreated={handleCreated} showHero={false} />
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
                {attendantId ? "Receipts list" : "Receipts desk"}
              </p>
              <h2 className="text-xl font-semibold text-white">
                {attendantId ? "Read-only receipts history" : "Search receipts"}
              </h2>
              <p className="text-sm text-slate-400">
                {attendantId
                  ? "Explore every receipt captured across the system and filter by date, range, or attendant."
                  : "Search by receipt number, customer phone, or attendant name."}
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
              results.map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-md bg-slate-950/40 p-3">
                  <div>
                    <div className="text-sm font-semibold">{r.orderRef || r.id}</div>
                    <div className="text-xs text-slate-400">
                      {r.customerName || "-"} - {(r as any).customerPhone || "-"}
                    </div>
                  </div>
                  <Link
                    href={`/receipts/${r.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-full bg-emerald-500 px-3 py-1 text-xs font-semibold text-black"
                  >
                    View receipt
                  </Link>
                </div>
              ))
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
