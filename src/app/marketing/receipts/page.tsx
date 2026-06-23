"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Card from "@/app/_components/Card";
import DailyReportReceiptsPanel from "@/components/daily-report-receipts";
import WebsiteOrdersDeskClient from "@/components/WebsiteOrdersDeskClient";
import QuotationRequestsDeskClient from "@/components/QuotationRequestsDeskClient";
import { getTradingPeriodFor } from "@/lib/tradingPeriod";

type ReceiptRangeKey = "today" | "yesterday" | "this-week" | "period" | "custom";

type MarketingReceiptSummary = {
  totalSales: number;
  receiptsCount: number;
};

const toDateInput = (value: Date) => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatKES = (value?: number | null) =>
  `KES ${Number(value ?? 0).toLocaleString("en-KE", {
    maximumFractionDigits: 0,
  })}`;

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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
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
  const [summary, setSummary] = useState<MarketingReceiptSummary>({
    totalSales: 0,
    receiptsCount: 0,
  });
  const initialTab = searchParams.get("tab");
  const initialPodFilter = searchParams.get("pod") === "pending" ? "pod_pending" : "all";
  const [viewMode, setViewMode] = useState<"receipts" | "web-orders" | "quote-requests">(
    initialTab === "web-orders"
      ? "web-orders"
      : initialTab === "quotations"
        ? "quote-requests"
        : "receipts",
  );

  useEffect(() => {
    const nextTab = searchParams.get("tab");
    const resolvedViewMode =
      nextTab === "web-orders"
        ? "web-orders"
        : nextTab === "quotations"
          ? "quote-requests"
          : "receipts";
    setViewMode((current) => (current === resolvedViewMode ? current : resolvedViewMode));
  }, [searchParams]);

  function setReceiptViewMode(nextMode: "receipts" | "web-orders" | "quote-requests") {
    setViewMode(nextMode);
    const params = new URLSearchParams(searchParams.toString());
    if (nextMode === "receipts") {
      params.set("tab", "pos");
      params.delete("orderId");
      params.delete("quoteId");
    } else if (nextMode === "web-orders") {
      params.set("tab", "web-orders");
      params.delete("quoteId");
    } else {
      params.set("tab", "quotations");
      params.delete("orderId");
    }
    const nextQuery = params.toString();
    router.replace(`${pathname}${nextQuery ? `?${nextQuery}` : ""}`, { scroll: false });
  }

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
              Browse your receipts, filter POD work, and record delivery evidence from the same history screen.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/marketing/agent-orders"
              className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-emerald-200 transition hover:border-emerald-400 hover:bg-emerald-500/15"
            >
              Agent orders
            </Link>
            <Link
              href="/marketing/tracker"
              className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-100 transition hover:border-white/40 hover:bg-white/10"
            >
              Operations overview
            </Link>
          </div>
        </header>

        <Card className="space-y-5 border-slate-800 bg-slate-900/80 shadow-xl shadow-black/40">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Receipts list</p>
              <h2 className="text-lg font-semibold text-slate-100">
                {viewMode === "receipts"
                  ? "My POS receipts"
                  : viewMode === "web-orders"
                    ? "My web orders"
                    : "My quotation requests"}
              </h2>
              <p className="text-sm text-slate-400">
                {viewMode === "receipts"
                  ? "Filter your own receipts by date, search term, or POD status. Pending PODs can be marked delivered with proof here."
                  : viewMode === "web-orders"
                    ? "Process your assigned website orders here using the same lifecycle used in admin."
                    : "Review assigned quotation requests and prepare product recommendations from the same desk."}
              </p>
            </div>
          </div>

          {viewMode === "receipts" ? (
            <>
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
                  <p className="text-2xl font-semibold text-emerald-300">
                    {summary.receiptsCount}
                  </p>
                  <p className="text-xs text-slate-400">Your receipts in the selected window</p>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-wide text-slate-400">Total sales</p>
                  <p className="text-2xl font-semibold text-emerald-300">
                    {formatKES(summary.totalSales)}
                  </p>
                  <p className="text-xs text-slate-400">Aggregated from the receipts below</p>
                </div>
              </div>

              <DailyReportReceiptsPanel
                start={filters.start}
                end={filters.end}
                q={filters.query}
                attendantId={undefined}
                onlyPos
                hideHeader
                showPodFilters
                initialPodFilter={initialPodFilter}
                extraFilterActions={[
                  {
                    key: "web-orders",
                    label: "Web orders",
                    active: false,
                    onClick: () => setReceiptViewMode("web-orders"),
                  },
                  {
                    key: "quote-requests",
                    label: "Quotation requests",
                    active: false,
                    onClick: () => setReceiptViewMode("quote-requests"),
                  },
                  ...ReceiptRangeOptions.map((option) => ({
                    key: option.key,
                    label: option.label,
                    active: rangeKey === option.key,
                    onClick: () => applyRange(option.key),
                  })),
                ]}
                emptyMessage="No receipts found for this range."
                onSummary={(panelSummary) =>
                  setSummary({
                    totalSales: panelSummary.totalSales,
                    receiptsCount: panelSummary.count,
                  })
                }
              />
            </>
          ) : viewMode === "web-orders" ? (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-wide">
                <button
                  type="button"
                  onClick={() => setReceiptViewMode("receipts")}
                  className="rounded-full border border-white/15 px-4 py-1 text-slate-200 transition hover:border-emerald-500 hover:text-white"
                >
                  POS receipts
                </button>
                <button
                  type="button"
                  className="rounded-full border border-emerald-500 bg-emerald-500/20 px-4 py-1 text-emerald-200 transition"
                >
                  Web orders
                </button>
                <button
                  type="button"
                  onClick={() => setReceiptViewMode("quote-requests")}
                  className="rounded-full border border-white/15 px-4 py-1 text-slate-200 transition hover:border-emerald-500 hover:text-white"
                >
                  Quotation requests
                </button>
              </div>
              <WebsiteOrdersDeskClient
                apiBasePath="/api/attendant/website-orders"
                defaultStatusFilter="PENDING"
                orderListLabel="Website orders"
                orderListTitle="Assigned web orders"
                orderListDescription="Process direct website orders assigned to your customer-service desk."
                emptyMessage="No assigned website orders found right now."
                filterStorageKey="marketing:web-orders:status"
              />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-wide">
                <button
                  type="button"
                  onClick={() => setReceiptViewMode("receipts")}
                  className="rounded-full border border-white/15 px-4 py-1 text-slate-200 transition hover:border-emerald-500 hover:text-white"
                >
                  POS receipts
                </button>
                <button
                  type="button"
                  onClick={() => setReceiptViewMode("web-orders")}
                  className="rounded-full border border-white/15 px-4 py-1 text-slate-200 transition hover:border-emerald-500 hover:text-white"
                >
                  Web orders
                </button>
                <button
                  type="button"
                  className="rounded-full border border-emerald-500 bg-emerald-500/20 px-4 py-1 text-emerald-200 transition"
                >
                  Quotation requests
                </button>
              </div>
              <QuotationRequestsDeskClient
                apiBasePath="/api/attendant/quote-requests"
                defaultStatusFilter="NEW"
                filterStorageKey="marketing:quote-requests:status"
                deskTitle="Assigned quotation requests"
                deskDescription="Prepare customer quotations, recommend products, and notify customers from the same follow-up desk."
                emptyMessage="No assigned quotation requests found right now."
              />
            </div>
          )}
        </Card>
      </main>
    </div>
  );
}
