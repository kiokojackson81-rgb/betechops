"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Card from "@/app/_components/Card";
import { getTradingPeriodFor } from "@/lib/tradingPeriod";

type ReceiptRangeKey = "today" | "yesterday" | "this-week" | "period" | "custom";

type MarketingReceiptRow = {
  id: string;
  orderRef?: string | null;
  receiptNumber?: string | null;
  docType?: string | null;
  createdAt: string;
  customerName?: string | null;
  attendantName?: string | null;
  total?: number | null;
};

const toDateInput = (value: Date) => value.toISOString().slice(0, 10);

const formatKES = (value?: number | null) =>
  `KES ${Number(value ?? 0).toLocaleString("en-KE", {
    maximumFractionDigits: 0,
  })}`;

const formatDateTime = (value?: string | null) => {
  if (!value) return "-";
  return new Date(value).toLocaleString("en-KE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const toStartOfDayIso = (value?: string) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setUTCHours(0, 0, 0, 0);
  return date.toISOString();
};

const toEndOfDayIso = (value?: string) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setUTCHours(23, 59, 59, 999);
  return date.toISOString();
};

const getWeekBounds = (reference: Date) => {
  const day = reference.getDay();
  const diff = (day + 6) % 7;
  const start = new Date(reference);
  start.setDate(reference.getDate() - diff);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

const ReceiptRangeOptions: { key: ReceiptRangeKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "this-week", label: "This week" },
  { key: "period", label: "This period" },
];

export default function MarketingReceiptsPage() {
  const defaultDate = toDateInput(new Date());
  const tradingPeriod = useMemo(() => getTradingPeriodFor(new Date()), []);
  const periodRange = useMemo(
    () => ({
      start: toDateInput(tradingPeriod.start),
      end: toDateInput(tradingPeriod.end),
      label: tradingPeriod.label,
    }),
    [tradingPeriod],
  );

  const [filters, setFilters] = useState({
    start: defaultDate,
    end: defaultDate,
    query: "",
  });
  const [rangeKey, setRangeKey] = useState<ReceiptRangeKey>("today");
  const [receipts, setReceipts] = useState<MarketingReceiptRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setFilters((prev) => ({ ...prev, start: defaultDate, end: defaultDate }));
    setRangeKey("today");
  }, [defaultDate]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    const fetchReceipts = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        params.set("includeItems", "false");
        params.set("size", "80");
        const startIso = toStartOfDayIso(filters.start);
        const endIso = toEndOfDayIso(filters.end);
        if (startIso) params.set("start", startIso);
        if (endIso) params.set("end", endIso);
        if (filters.query.trim()) {
          params.set("q", filters.query.trim());
        }
        const res = await fetch(`/api/receipts?${params.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || "Failed to load receipts");
        if (!cancelled) {
          setReceipts(Array.isArray(data?.receipts) ? data.receipts : []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unable to load receipts");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchReceipts();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [filters]);

  const summary = useMemo(() => {
    const totalSales = receipts.reduce(
      (sum, receipt) => sum + Number(receipt.total ?? 0),
      0,
    );
    return {
      totalSales,
      count: receipts.length,
    };
  }, [receipts]);

  const rangeLabel = (() => {
    if (rangeKey === "today") return "Today";
    if (rangeKey === "yesterday") return "Yesterday";
    if (rangeKey === "this-week") return "This week";
    if (rangeKey === "period") return periodRange.label;
    return "Custom range";
  })();

  const applyRange = (key: ReceiptRangeKey) => {
    const { start, end } = (() => {
      if (key === "today") {
        return { start: defaultDate, end: defaultDate };
      }
      if (key === "yesterday") {
        const today = new Date(defaultDate);
        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);
        const yesterdayInput = toDateInput(yesterday);
        return { start: yesterdayInput, end: yesterdayInput };
      }
      if (key === "this-week") {
        const { start: weekStart, end: weekEnd } = getWeekBounds(new Date());
        return { start: toDateInput(weekStart), end: toDateInput(weekEnd) };
      }
      if (key === "period") {
        return { start: periodRange.start, end: periodRange.end };
      }
      return { start: defaultDate, end: defaultDate };
    })();
    setFilters((prev) => ({ ...prev, start, end }));
    setRangeKey(key);
  };

  const handleStartChange = (value: string) => {
    setRangeKey("custom");
    setFilters((prev) => {
      const next = { ...prev, start: value };
      if (next.end && next.start > next.end) {
        next.end = next.start;
      }
      return next;
    });
  };

  const handleEndChange = (value: string) => {
    setRangeKey("custom");
    setFilters((prev) => {
      const next = { ...prev, end: value };
      if (next.start && next.end && next.end < next.start) {
        next.start = next.end;
      }
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <main className="mx-auto max-w-5xl space-y-6 p-6">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold">Receipts history</h1>
            <p className="text-sm text-slate-300">
              Browse every receipt captured in the system. Use the range pills or
              custom dates to narrow the window.
            </p>
          </div>
          <Link
            href="/marketing/tracker"
            className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-100 transition hover:border-white/40 hover:bg-white/10"
          >
            Back to dashboard
          </Link>
        </header>

        <Card className="space-y-5 border-slate-800 bg-slate-900/80 shadow-xl shadow-black/40">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Receipts list</p>
              <h2 className="text-lg font-semibold text-slate-100">
                Read-only receipts history
              </h2>
              <p className="text-sm text-slate-400">
                Explore every receipt captured across the system and filter by date, range, or attendant.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-wide">
              {ReceiptRangeOptions.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => applyRange(option.key)}
                  className={`rounded-full border px-4 py-1 transition ${
                    rangeKey === option.key
                      ? "border-emerald-500 bg-emerald-500/20 text-emerald-200"
                      : "border-white/15 text-slate-200 hover:border-emerald-500 hover:text-white"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-4">
            <label className="text-xs uppercase tracking-wide text-slate-400">
              Search
              <input
                type="search"
                placeholder="Customer, attendant, receipt..."
                value={filters.query}
                onChange={(event) =>
                  setFilters((prev) => ({ ...prev, query: event.target.value }))
                }
                className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
            </label>
            <label className="text-xs uppercase tracking-wide text-slate-400">
              Start date
              <input
                type="date"
                value={filters.start}
                onChange={(event) => handleStartChange(event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
            </label>
            <label className="text-xs uppercase tracking-wide text-slate-400">
              End date
              <input
                type="date"
                value={filters.end}
                onChange={(event) => handleEndChange(event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3">
              <p className="text-[11px] uppercase tracking-wide text-slate-400">Range</p>
              <p className="text-sm font-semibold text-slate-100">{rangeLabel}</p>
              <p className="text-xs text-slate-400">
                Showing receipts from {filters.start} to {filters.end}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3">
              <p className="text-[11px] uppercase tracking-wide text-slate-400">Receipts</p>
              <p className="text-2xl font-semibold text-emerald-300">{summary.count}</p>
              <p className="text-xs text-slate-400">Captured in the selected window</p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3">
              <p className="text-[11px] uppercase tracking-wide text-slate-400">Total sales</p>
              <p className="text-2xl font-semibold text-emerald-300">{formatKES(summary.totalSales)}</p>
              <p className="text-xs text-slate-400">Aggregated from the receipts below</p>
            </div>
          </div>

          <div className="space-y-2">
            {loading && (
              <p className="text-sm text-slate-400">Loading receipts.</p>
            )}
            {error && <p className="text-sm text-rose-300">{error}</p>}
            {!loading && !receipts.length && !error && (
              <p className="text-sm text-slate-400">No receipts found for this range.</p>
            )}
            {receipts.map((receipt) => (
              <div
                key={receipt.id}
                className="flex items-center justify-between rounded-2xl border border-white/5 bg-slate-950/60 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-semibold text-white">
                    {receipt.orderRef ?? receipt.receiptNumber ?? receipt.id}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {receipt.attendantName ?? "Attendant unknown"} · {formatDateTime(receipt.createdAt)}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {receipt.customerName ?? "-"} · {receipt.docType ?? "Receipt"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-emerald-300">
                    {formatKES(receipt.total)}
                  </p>
                  {receipt.id ? (
                    <Link
                      href={`/receipts/${receipt.id}`}
                      className="text-xs text-emerald-300 hover:text-emerald-200"
                    >
                      View details
                    </Link>
                  ) : (
                    <span className="text-xs text-slate-500">Unavailable</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </main>
    </div>
  );
}
