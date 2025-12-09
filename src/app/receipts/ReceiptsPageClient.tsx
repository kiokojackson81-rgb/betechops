"use client";

import Link from "next/link";
import { useMemo, useState, useEffect } from "react";
import ReceiptFormClient from "./ReceiptFormClient";
import ReceiptPrintView from "./_components/ReceiptPrintView";
import { normalizePhone, formatPhoneForDisplay } from "@/lib/phone";

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

type ReceiptSummary = {
  totalCount: number;
  totalValue: number;
  averageValue: number;
  lastReceipt?: { id: string; createdAt: string; customerName?: string | null };
};

const computeSummary = (rows: ReceiptRow[]): ReceiptSummary => {
  const totalValue = rows.reduce((sum, row) => sum + Number(row.total ?? 0), 0);
  const totalCount = rows.length;
  const averageValue = totalCount ? totalValue / totalCount : 0;
  const head = rows[0];
  const lastReceipt = head
    ? { id: head.id, createdAt: head.createdAt, customerName: head.customerName }
    : undefined;
  return { totalCount, totalValue, averageValue, lastReceipt };
};

export default function ReceiptsPageClient({ initial }: { initial: ReceiptRow[] }) {
  // default to create view; allow toggling to inline 'list' search for attendants
  const [view, setView] = useState<"create" | "list">("create");
  const [query, setQuery] = useState("");
  const [phone, setPhone] = useState("");
  const [results, setResults] = useState<ReceiptRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<any | null>(null);
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [totalPages, setTotalPages] = useState<number | null>(null);

  const handleCreated = () => {
    // after create, keep on create view and optionally clear or focus
    setView("create");
    // TODO: we could refresh summary or show created receipt
  };

  // perform search with explicit phone support and pagination
  const doSearch = async (opts?: { page?: number }) => {
    setLoading(true);
    try {
      const p = opts?.page ?? page;
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      if (phone) params.set("phone", normalizePhone(phone) || phone);
      params.set("includeItems", "true");
      params.set("page", String(p));
      params.set("size", String(size));
      const url = `/api/receipts?${params.toString()}`;
      const res = await fetch(url, { cache: "no-store" });
      const data = await res.json();
      setResults(data.receipts || []);
      setPage(data.paging?.page ?? p);
      setTotalCount(data.paging?.totalCount ?? null);
      setTotalPages(data.paging?.totalPages ?? null);
    } catch (e) {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  // debounce search when query or phone changes
  useEffect(() => {
    if (view !== "list") return;
    const t = setTimeout(() => doSearch({ page: 1 }), 450);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, phone, view, size]);

  // prefill phone with country code on mount if empty
  useEffect(() => {
    if (!phone) setPhone("+254");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const viewReceipt = async (r: ReceiptRow) => {
    // fetch authoritative receipt with items
    try {
      const res = await fetch(`/api/receipts?q=${encodeURIComponent(r.orderRef || r.id)}&includeItems=true`, { cache: "no-store" });
      const data = await res.json();
      const found = Array.isArray(data.receipts) ? data.receipts[0] : data.receipt ?? null;
      setSelected(found || r);
      // ensure preview area is visible
      setView("list");
    } catch (e) {
      setSelected(r);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-6 shadow-inner shadow-black/40">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Receipts desk</p>
            <h1 className="text-2xl font-semibold text-white">Betech Customers Operations</h1>
            <p className="text-sm text-slate-400">Track receipts and create new printable receipts from here.</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className={`rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-white/10 ${view === "create" ? "bg-white/5" : ""}`}
              onClick={() => setView("create")}
            >
              Create
            </button>
            <button
              type="button"
              className={`rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-black hover:brightness-95 ${view === "list" ? "ring-2 ring-emerald-300" : ""}`}
              onClick={() => setView((v) => (v === "list" ? "create" : "list"))}
            >
              View receipts
            </button>
          </div>
        </div>

        {/* Inline search panel for attendants (visible when view === 'list') */}
        {view === "list" && (
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
            <input
              type="text"
              placeholder="Search by receipt number, customer phone or attendant"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="col-span-2 rounded-lg bg-slate-900 p-2 text-white placeholder-slate-500"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => doSearch()}
                className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-black"
              >
                {loading ? "Searching..." : "Search"}
              </button>
              <button
                type="button"
                onClick={() => { setResults([]); setQuery(""); setSelected(null); }}
                className="rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200"
              >
                Clear
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Main area: create form or search results + receipt preview */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.1fr)]">
        <div>
          <section id="receipt-create" className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-xl shadow-black/40">
            <ReceiptFormClient onCreated={handleCreated} />
          </section>

          {/* When in list mode, show results table */}
          {view === "list" && (
            <section className="mt-6 rounded-2xl border border-white/10 bg-slate-900/60 p-4">
              <h3 className="text-sm font-semibold text-slate-200">Search results</h3>
              {results.length === 0 ? (
                <p className="mt-3 text-sm text-slate-400">No receipts found. Try a different query.</p>
              ) : (
                <div className="mt-3 space-y-2">
                  <div className="hidden grid-cols-3 gap-4 px-3 pb-2 text-xs text-slate-400 md:grid">
                    <div>Receipt</div>
                    <div>Customer</div>
                    <div className="text-right">Actions</div>
                  </div>
                  {results.map((r) => (
                    <div key={r.id} className="flex items-center justify-between rounded-md bg-slate-950/30 p-3">
                      <div>
                        <div className="text-sm font-semibold">{r.orderRef || r.id}</div>
                        <div className="text-xs text-slate-400">{r.customerName || "-"} • { (r as any).customerPhone || "-" }</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => viewReceipt(r)}
                          className="rounded-full bg-emerald-500 px-3 py-1 text-xs font-semibold text-black"
                        >
                          View receipt
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Pagination controls */}
              <div className="mt-4 flex items-center justify-between">
                <div className="text-sm text-slate-400">Showing {results.length} results</div>
                <div className="flex items-center gap-2">
                  <button
                    disabled={page <= 1}
                    onClick={() => { setPage((p) => Math.max(1, p - 1)); doSearch({ page: Math.max(1, page - 1) }); }}
                    className="rounded border border-white/10 px-3 py-1 text-sm text-slate-200 disabled:opacity-40"
                  >
                    Prev
                  </button>
                  <div className="text-sm text-slate-200">Page {page}</div>
                  <button
                    onClick={() => { setPage((p) => p + 1); doSearch({ page: page + 1 }); }}
                    className="rounded border border-white/10 px-3 py-1 text-sm text-slate-200"
                  >
                    Next
                  </button>
                </div>
              </div>
            </section>
          )}
        </div>

        <div>
          <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-400">Preview</p>
            <h3 className="mt-2 text-xl font-semibold text-white">Receipt preview</h3>
            <div className="mt-4">
              {selected ? (
                <ReceiptPrintView data={selected} mode="preview" />
              ) : (
                <p className="text-sm text-slate-400">Select a receipt from search results to preview it here.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
