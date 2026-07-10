"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Card from "@/app/_components/Card";
import DailyReportReceiptsPanel from "@/components/daily-report-receipts";
import WebsiteOrdersDeskClient from "@/components/WebsiteOrdersDeskClient";
import QuotationRequestsDeskClient from "@/components/QuotationRequestsDeskClient";
import {
  isCarriedForwardPendingItem,
  isOpenQuotationStatus,
  isPendingPodStatus,
  isPendingWebOrderStatus,
  wasCreatedOrUpdatedInPeriod,
} from "@/lib/operationsWorkQueue";
import { getTradingPeriodFor } from "@/lib/tradingPeriod";

type ReceiptRangeKey =
  | "today"
  | "yesterday"
  | "this-week"
  | "this-month"
  | "period"
  | "custom";
type PodFilterValue =
  | "all"
  | "normal_only"
  | "settled"
  | "pod_pending"
  | "pod_delivered"
  | "pod_failed";
type ViewMode = "receipts" | "web-orders" | "quote-requests";

type MarketingReceiptSummary = {
  totalSales: number;
  receiptsCount: number;
};

type DashboardCounts = {
  podPending: number;
  webOrders: number;
  quotations: number;
  podPendingCurrentPeriod: number;
  webOrdersCurrentPeriod: number;
  quotationsCurrentPeriod: number;
  podPendingCarriedForward: number;
  webOrdersCarriedForward: number;
  quotationsCarriedForward: number;
};

type VoiceDeskSummary = {
  queueCount: number;
  missedCount: number;
  followUpCount: number;
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

const getMonthBounds = (reference: Date) => {
  const start = new Date(reference.getFullYear(), reference.getMonth(), 1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(reference.getFullYear(), reference.getMonth() + 1, 0);
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

const PERIOD_FILTERS: Array<{ key: ReceiptRangeKey; label: string }> = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "this-week", label: "This Week" },
  { key: "this-month", label: "This Month" },
  { key: "period", label: "This Period" },
  { key: "custom", label: "Custom Range" },
];

const RECEIPT_STATUS_FILTERS: Array<{ key: PodFilterValue; label: string }> = [
  { key: "all", label: "All POS Receipts" },
  { key: "normal_only", label: "Normal Only" },
  { key: "settled", label: "Settled Receipts" },
  { key: "pod_pending", label: "POD Pending" },
  { key: "pod_delivered", label: "POD Delivered" },
  { key: "pod_failed", label: "POD Failed" },
];

function formatRangeLabel(args: {
  rangeKey: ReceiptRangeKey;
  start: string;
  end: string;
  periodLabel: string;
}) {
  if (args.rangeKey === "today") return "Today";
  if (args.rangeKey === "yesterday") return "Yesterday";
  if (args.rangeKey === "this-week") return "This Week";
  if (args.rangeKey === "this-month") return "This Month";
  if (args.rangeKey === "period") return args.periodLabel;
  return `${args.start} - ${args.end}`;
}

function FilterPill({
  active,
  children,
  onClick,
}: {
  active?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-wide transition ${
        active
          ? "border-emerald-500 bg-emerald-500/15 text-emerald-200"
          : "border-white/10 bg-white/[0.03] text-slate-200 hover:border-white/25 hover:bg-white/[0.06]"
      }`}
    >
      {children}
    </button>
  );
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url, {
      cache: "no-store",
      credentials: "same-origin",
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) return null;
    return payload as T;
  } catch {
    return null;
  }
}

export default function MarketingReceiptsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const today = useMemo(() => new Date(), []);
  const defaultDate = useMemo(() => toDateInput(today), [today]);
  const tradingPeriod = useMemo(() => getTradingPeriodFor(today), [today]);
  const periodRange = useMemo(
    () => ({
      start: toDateInput(tradingPeriod.start),
      end: toDateInput(tradingPeriod.end),
      label: tradingPeriod.label,
    }),
    [tradingPeriod],
  );

  const [filters, setFilters] = useState({
    start: periodRange.start,
    end: periodRange.end,
    query: "",
  });
  const [rangeKey, setRangeKey] = useState<ReceiptRangeKey>("period");
  const [summary, setSummary] = useState<MarketingReceiptSummary>({
    totalSales: 0,
    receiptsCount: 0,
  });
  const [dashboardCounts, setDashboardCounts] = useState<DashboardCounts>({
    podPending: 0,
    webOrders: 0,
    quotations: 0,
    podPendingCurrentPeriod: 0,
    webOrdersCurrentPeriod: 0,
    quotationsCurrentPeriod: 0,
    podPendingCarriedForward: 0,
    webOrdersCarriedForward: 0,
    quotationsCarriedForward: 0,
  });
  const [voiceDeskSummary, setVoiceDeskSummary] = useState<VoiceDeskSummary>({
    queueCount: 0,
    missedCount: 0,
    followUpCount: 0,
  });
  const [currentSearch, setCurrentSearch] = useState("");
  const [podFilter, setPodFilter] = useState<PodFilterValue>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("receipts");

  useEffect(() => {
    if (typeof window === "undefined") return;

    const syncFromLocation = () => {
      const nextSearch = window.location.search;
      setCurrentSearch(nextSearch);

      const params = new URLSearchParams(nextSearch);
      const nextTab = params.get("tab");
      const resolvedViewMode =
        nextTab === "web-orders"
          ? "web-orders"
          : nextTab === "quotations"
            ? "quote-requests"
            : "receipts";
      setViewMode((current) => (current === resolvedViewMode ? current : resolvedViewMode));
      setPodFilter(params.get("pod") === "pending" ? "pod_pending" : "all");
    };

    syncFromLocation();
    window.addEventListener("popstate", syncFromLocation);
    return () => window.removeEventListener("popstate", syncFromLocation);
  }, []);

  function setReceiptViewMode(nextMode: ViewMode) {
    setViewMode(nextMode);
    const params = new URLSearchParams(currentSearch);
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
    setCurrentSearch(nextQuery ? `?${nextQuery}` : "");
    router.replace(`${pathname}${nextQuery ? `?${nextQuery}` : ""}`, { scroll: false });
  }

  const applyRange = (key: ReceiptRangeKey) => {
    if (key === "custom") {
      setRangeKey("custom");
      return;
    }

    const nextRange = (() => {
      if (key === "today") return { start: defaultDate, end: defaultDate };
      if (key === "yesterday") {
        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);
        const yesterdayInput = toDateInput(yesterday);
        return { start: yesterdayInput, end: yesterdayInput };
      }
      if (key === "this-week") {
        const bounds = getWeekBounds(today);
        return { start: toDateInput(bounds.start), end: toDateInput(bounds.end) };
      }
      if (key === "this-month") {
        const bounds = getMonthBounds(today);
        return { start: toDateInput(bounds.start), end: toDateInput(bounds.end) };
      }
      return { start: periodRange.start, end: periodRange.end };
    })();

    setFilters((prev) => ({ ...prev, ...nextRange }));
    setRangeKey(key);
  };

  const handleStartChange = (value: string) => {
    setRangeKey("custom");
    setFilters((prev) => {
      const next = { ...prev, start: value };
      if (next.end && next.start > next.end) next.end = next.start;
      return next;
    });
  };

  const handleEndChange = (value: string) => {
    setRangeKey("custom");
    setFilters((prev) => {
      const next = { ...prev, end: value };
      if (next.start && next.end && next.end < next.start) next.start = next.end;
      return next;
    });
  };

  const selectedRangeLabel = formatRangeLabel({
    rangeKey,
    start: filters.start,
    end: filters.end,
    periodLabel: periodRange.label,
  });

  useEffect(() => {
    let cancelled = false;

    const syncCounts = async () => {
      const podParams = new URLSearchParams({
        includeItems: "false",
        size: "200",
        scope: "mine",
        onlyPos: "1",
        customerType: "pod",
        status: "pending",
        carryForwardPending: "1",
      });

      const [podPayload, webPayload, quotePayload] = await Promise.all([
        fetchJson<{ receipts?: Array<{ id: string; createdAt?: string | null; podDeliveryStatus?: string | null }> }>(
          `/api/receipts?${podParams.toString()}`,
        ),
        fetchJson<{ orders?: Array<{ id: string; status?: string | null; createdAt?: string | null; updatedAt?: string | null }> }>(
          "/api/attendant/website-orders?status=ALL",
        ),
        fetchJson<{ requests?: Array<{ id: string; status?: string | null; createdAt?: string | null; updatedAt?: string | null }> }>(
          "/api/attendant/quote-requests?status=ALL&source=WEBSITE_REQUEST",
        ),
      ]);

      if (cancelled) return;

      const inSelectedWindow = (value?: string | null) => {
        if (!value) return false;
        const timestamp = new Date(value).getTime();
        const start = filters.start ? new Date(`${filters.start}T00:00:00`).getTime() : -Infinity;
        const end = filters.end ? new Date(`${filters.end}T23:59:59.999`).getTime() : Infinity;
        return timestamp >= start && timestamp <= end;
      };

      const periodBounds = {
        start: filters.start ? new Date(`${filters.start}T00:00:00`) : new Date(-8640000000000000),
        end: filters.end ? new Date(`${filters.end}T23:59:59.999`) : new Date(8640000000000000),
      };

      const podReceipts = Array.isArray(podPayload?.receipts) ? podPayload.receipts.filter((receipt) => isPendingPodStatus(receipt.podDeliveryStatus)) : [];
      const openWebOrders = Array.isArray(webPayload?.orders)
        ? webPayload.orders.filter((order) => isPendingWebOrderStatus(order.status))
        : [];
      const openQuoteRequests = Array.isArray(quotePayload?.requests)
        ? quotePayload.requests.filter((request) => isOpenQuotationStatus(request.status))
        : [];

      setDashboardCounts({
        podPending: podReceipts.length,
        webOrders: openWebOrders.length,
        quotations: openQuoteRequests.length,
        podPendingCurrentPeriod: podReceipts.filter((receipt) => inSelectedWindow(receipt.createdAt)).length,
        webOrdersCurrentPeriod: openWebOrders.filter((order) => wasCreatedOrUpdatedInPeriod(order.createdAt, order.updatedAt, periodBounds)).length,
        quotationsCurrentPeriod: openQuoteRequests.filter((request) => wasCreatedOrUpdatedInPeriod(request.createdAt, request.updatedAt, periodBounds)).length,
        podPendingCarriedForward: podReceipts.filter((receipt) =>
          isCarriedForwardPendingItem({
            status: receipt.podDeliveryStatus,
            createdAt: receipt.createdAt,
            periodStart: periodBounds.start,
          }),
        ).length,
        webOrdersCarriedForward: openWebOrders.filter((order) =>
          isCarriedForwardPendingItem({
            status: order.status,
            createdAt: order.createdAt,
            periodStart: periodBounds.start,
          }) && !wasCreatedOrUpdatedInPeriod(order.createdAt, order.updatedAt, periodBounds),
        ).length,
        quotationsCarriedForward: openQuoteRequests.filter((request) =>
          isCarriedForwardPendingItem({
            status: request.status,
            createdAt: request.createdAt,
            periodStart: periodBounds.start,
          }) && !wasCreatedOrUpdatedInPeriod(request.createdAt, request.updatedAt, periodBounds),
        ).length,
      });
    };

    void syncCounts();
    return () => {
      cancelled = true;
    };
  }, [filters.end, filters.start]);

  useEffect(() => {
    let cancelled = false;

    const syncVoiceDeskSummary = async () => {
      const voicePayload = await fetchJson<{
        summary?: {
          missedCalls?: number;
          myMissedCalls?: number;
          myFollowUps?: number;
          newVoiceLeads?: number;
        };
        viewer?: { isAdmin?: boolean };
        callQueue?: Array<{ type?: string | null }>;
      }>("/api/voice/live");

      if (cancelled) return;

      const queueItems = Array.isArray(voicePayload?.callQueue) ? voicePayload.callQueue : [];
      const queueCount = queueItems.length;
      const missedCount = queueItems.filter(
        (item) => String(item?.type || "").trim().toLowerCase() === "lead",
      ).length;

      setVoiceDeskSummary({
        queueCount,
        missedCount,
        followUpCount: queueItems.filter(
          (item) => String(item?.type || "").trim().toLowerCase() === "task",
        ).length,
      });
    };

    void syncVoiceDeskSummary();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <main className="mx-auto max-w-7xl space-y-4 p-4">
        <header className="rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,rgba(15,23,42,.98),rgba(2,6,23,.98))] p-4 shadow-[0_24px_70px_rgba(0,0,0,0.35)]">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100">
                  Direct Sales Ops
                </span>
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-slate-300">
                  {periodRange.label}
                </span>
              </div>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-[1.8rem]">
                  Receipts Operations Dashboard
                </h1>
                <p className="mt-1 max-w-3xl text-sm text-slate-300">
                  Review POS receipts, web orders, quotations, POD work, and agent orders from one place.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 xl:justify-end">
              <button
                type="button"
                onClick={() => setReceiptViewMode("receipts")}
                className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-wide transition ${
                  viewMode === "receipts"
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                    : "border-white/10 bg-white/[0.03] text-slate-100 hover:border-white/30 hover:bg-white/[0.06]"
                }`}
              >
                POS Receipts
              </button>
              <button
                type="button"
                onClick={() => setReceiptViewMode("web-orders")}
                className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-wide transition ${
                  viewMode === "web-orders"
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                    : "border-white/10 bg-white/[0.03] text-slate-100 hover:border-white/30 hover:bg-white/[0.06]"
                }`}
              >
                Web Orders
              </button>
              <button
                type="button"
                onClick={() => setReceiptViewMode("quote-requests")}
                className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-wide transition ${
                  viewMode === "quote-requests"
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                    : "border-white/10 bg-white/[0.03] text-slate-100 hover:border-white/30 hover:bg-white/[0.06]"
                }`}
              >
                Quotations
              </button>
              <Link
                href="/marketing/agent-orders"
                className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-100 transition hover:border-white/30 hover:bg-white/[0.06]"
              >
                Agent Orders
              </Link>
              <Link
                href="/marketing/tracker"
                className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-100 transition hover:border-white/30 hover:bg-white/[0.06]"
              >
                Operations Overview
              </Link>
            </div>
          </div>
        </header>

        <section className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,.7),rgba(2,6,23,.78))] p-3">
          <div className="flex flex-wrap gap-2">
            {PERIOD_FILTERS.map((option) => (
              <FilterPill
                key={option.key}
                active={rangeKey === option.key}
                onClick={() => applyRange(option.key)}
              >
                {option.label}
              </FilterPill>
            ))}
          </div>
          <div className="mt-3 grid gap-2 lg:grid-cols-[minmax(0,1fr)_170px_170px]">
            <label className="text-[11px] uppercase tracking-wide text-slate-400">
              Search
              <input
                type="search"
                placeholder="Customer, attendant, receipt..."
                value={filters.query}
                onChange={(event) => setFilters((prev) => ({ ...prev, query: event.target.value }))}
                className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
            </label>
            <label className="text-[11px] uppercase tracking-wide text-slate-400">
              Start Date
              <input
                type="date"
                value={filters.start}
                onChange={(event) => handleStartChange(event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
            </label>
            <label className="text-[11px] uppercase tracking-wide text-slate-400">
              End Date
              <input
                type="date"
                value={filters.end}
                onChange={(event) => handleEndChange(event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
            </label>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-[20px] border border-white/10 bg-slate-900/80 p-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Total Sales
            </div>
            <div className="mt-2 text-xl font-semibold text-white">{formatKES(summary.totalSales)}</div>
            <div className="mt-1 text-xs text-slate-400">{selectedRangeLabel}</div>
          </div>
          <div className="rounded-[20px] border border-white/10 bg-slate-900/80 p-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Receipts
            </div>
            <div className="mt-2 text-2xl font-semibold text-white">{summary.receiptsCount}</div>
            <div className="mt-1 text-xs text-slate-400">POS receipts in selected range</div>
          </div>
          <div className="rounded-[20px] border border-white/10 bg-slate-900/80 p-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              POD Pending
            </div>
            <div className="mt-2 text-2xl font-semibold text-amber-300">{dashboardCounts.podPending}</div>
            <div className="mt-1 text-xs text-slate-400">Pending delivery follow-up</div>
            <div className="mt-1 text-[11px] text-slate-500">
              Current period {dashboardCounts.podPendingCurrentPeriod} · Carried forward {dashboardCounts.podPendingCarriedForward}
            </div>
          </div>
          <Link
            href="/attendant/voice?tab=followups"
            className="rounded-[20px] border border-white/10 bg-slate-900/80 p-3 transition hover:border-cyan-400/30 hover:bg-slate-900"
          >
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Missed Calls / Follow-ups
            </div>
            <div className="mt-2 text-2xl font-semibold text-cyan-200">
              {voiceDeskSummary.queueCount}
            </div>
            <div className="mt-1 text-xs text-slate-400">Actionable voice callbacks and follow-up work</div>
            <div className="mt-1 text-[11px] text-slate-500">
              Missed {voiceDeskSummary.missedCount}
              {" · "}
              Follow-ups {voiceDeskSummary.followUpCount}
            </div>
          </Link>
        </section>

        <Card className="space-y-4 border-slate-800 bg-slate-900/80 shadow-xl shadow-black/40">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Operations Desk</p>
              <h2 className="text-lg font-semibold text-slate-100">
                {viewMode === "receipts"
                  ? "POS Receipt Desk"
                  : viewMode === "web-orders"
                    ? "Web Orders Desk"
                    : "Quotation Center"}
              </h2>
              <p className="text-sm text-slate-400">
                {viewMode === "receipts"
                  ? "Search receipts, manage POD updates, and capture delivery fees inside the selected range."
                  : viewMode === "web-orders"
                    ? "Process assigned website orders using the same lifecycle used in admin."
                    : "Review assigned quotation requests, create manual quotations, use prepared templates, and notify customers from one desk."}
              </p>
            </div>
          </div>

          {viewMode === "receipts" ? (
            <div className="flex flex-wrap gap-2 border-t border-white/10 pt-3">
              {RECEIPT_STATUS_FILTERS.map((option) => (
                <FilterPill
                  key={option.key}
                  active={podFilter === option.key}
                  onClick={() => setPodFilter(option.key)}
                >
                  {option.label.replace(" POS Receipts", "").replace(" Receipts", "")}
                </FilterPill>
              ))}
            </div>
          ) : null}

          {viewMode === "receipts" ? (
            <DailyReportReceiptsPanel
              key={`pos:${podFilter}`}
              start={filters.start}
              end={filters.end}
              q={filters.query}
              attendantId={undefined}
              onlyPos
              hideHeader
              initialPodFilter={podFilter}
              emptyMessage="No receipts found for this range."
              onSummary={(panelSummary) =>
                setSummary({
                  totalSales: panelSummary.totalSales,
                  receiptsCount: panelSummary.count,
                })
              }
              carryForwardPending={podFilter === "pod_pending"}
            />
          ) : viewMode === "web-orders" ? (
            <WebsiteOrdersDeskClient
              apiBasePath="/api/attendant/website-orders"
              defaultStatusFilter="PENDING"
              orderListLabel="Website orders"
              orderListTitle="Assigned web orders"
              orderListDescription="Process your assigned website orders here using the same lifecycle used in admin."
              emptyMessage="No assigned website orders found right now."
              filterStorageKey="marketing:web-orders:status"
              q={filters.query}
              start={filters.start}
              end={filters.end}
              compactMode
            />
          ) : (
            <QuotationRequestsDeskClient
              apiBasePath="/api/attendant/quote-requests"
              defaultStatusFilter="PENDING"
              filterStorageKey="marketing:quote-requests:list-status:v3"
              deskTitle="Quotation Center"
              deskDescription="Review saved quotations, create new quotations, download PDFs, and manage customer quotation history from one desk."
              emptyMessage="No quotations found right now."
              q={filters.query}
              start={filters.start}
              end={filters.end}
              compactMode
              allowDelete
            />
          )}
        </Card>
      </main>
    </div>
  );
}
