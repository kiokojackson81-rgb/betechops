"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import ReceiptFormClient from "./ReceiptFormClient";
import { normalizePhone } from "@/lib/phone";

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
  const [phone, setPhone] = useState("");
  const [results, setResults] = useState<ReceiptRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);

  const listRef = useRef<HTMLDivElement | null>(null);

  const handleCreated = () => {
    setView("create");
  };

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
      const res = await fetch(`/api/receipts?${params.toString()}`, { cache: "no-store" });
      const data = await res.json();
      setResults(data.receipts || []);
      setPage(data.paging?.page ?? p);
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
  }, [query, phone, view, size]);

  useEffect(() => {
    if (!phone) setPhone("+254");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Receipts list/search panel */}
      <section id="receipts-list" ref={listRef} style={{ display: view === "list" ? "" : "none" }}>
        <div className="mt-6 rounded-2xl border border-white/10 bg-slate-900/60 p-4">
          <h3 className="text-xl font-bold text-white mb-2">Search results</h3>
          <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-3">
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

          <div className="mt-3 space-y-2">
            {results.length === 0 ? (
              <p className="text-sm text-slate-400">No receipts found. Try a different query.</p>
            ) : (
              results.map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-md bg-slate-950/30 p-3">
                  <div>
                    <div className="text-sm font-semibold">{r.orderRef || r.id}</div>
                    <div className="text-xs text-slate-400">
                      {r.customerName || "-"} • {(r as any).customerPhone || "-"}
                    </div>
                  </div>
                  <Link href={`/receipts/${r.id}`} className="rounded-full bg-emerald-500 px-3 py-1 text-xs font-semibold text-black">
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
        </div>
      </section>

      <div className="space-y-6">
        <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-xl shadow-black/40">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Receipts desk</p>
              <h1 className="text-2xl font-semibold text-white">Betech Customers Operations</h1>
              <p className="text-sm text-slate-400">
                Track every printable document, search by customer, and open the PDF drawer without leaving this page.
              </p>
            </div>
            <button
              onClick={() => {
                setView("list");
                listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-black hover:brightness-95"
            >
              View receipts
            </button>
          </div>
          <div className="mt-4">
            <ReceiptFormClient onCreated={handleCreated} />
          </div>
        </section>

        {view === "list" && results.length > 0 && (
          <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
            <h3 className="text-sm font-semibold text-slate-200">Search results</h3>
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
                    <div className="text-xs text-slate-400">
                      {r.customerName || "-"} • {(r as any).customerPhone || "-"}
                    </div>
                  </div>
                  <Link
                    href={`/receipts/${r.id}`}
                    className="rounded-full bg-emerald-500 px-3 py-1 text-xs font-semibold text-black"
                  >
                    View receipt
                  </Link>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
