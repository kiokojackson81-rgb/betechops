"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Card from "@/app/_components/Card";
import PeriodSwitcher from "@/app/_components/PeriodSwitcher";
import useTradingPeriodQueryState from "@/app/_components/useTradingPeriodQueryState";
import Input from "@/app/_components/Input";
import Textarea from "@/app/_components/Textarea";
import Button from "@/app/_components/Button";
import { showToast } from "@/lib/ui/toast";
import { type TradingPeriod } from "@/lib/tradingPeriod";
import {
  DayName,
  marketingDayConfigs,
  marketingFieldKeys,
  marketingFieldTypes,
} from "@/lib/marketingDayConfigs";
import { useRouter, useSearchParams } from "next/navigation";
import getLandingPage from "@/lib/getLandingPage";
import { getCommissionSummaryForSales } from "@/lib/marketingCommission";
import type { EarningsSummary } from "@/lib/marketingEarnings";
import { Trash2 } from "lucide-react";
import { useCardLock, LockButton } from "@/app/_components/useCardLock";
import type { UnpricedSale } from "@/lib/marketingUnpricedSales";
import {
  groupMarketingUnpricedSales,
  type GroupedUnpricedSale,
  type ReceiptGroupingItem,
} from "@/lib/unpricedReceiptGrouping";
import { buildEarningsCardBreakdown } from "@/lib/earningsCardBreakdown";
import { mapPayrollToEarningsSummary } from "@/lib/payrollMapping";
import { withImpersonateId } from "@/lib/impersonation";

type MarketingDailyFormState = {
  date: string;
  dayOfWeek: DayName;
  fields: Record<string, boolean | number | string | null>;
};

const BRENDAH_EMAIL = "brendah@betech.co.ke";

const brendahLegacyFieldTypes = {
  walkInsPurchased: "numeric",
  productsUploaded: "numeric",
  productsEdited: "numeric",
  productsCopied: "numeric",
  jumiaProductsUploaded: "numeric",
  jumiaProductsEdited: "numeric",
  jumiaProductsCopied: "numeric",
  kilimallProductsUploaded: "numeric",
  kilimallProductsEdited: "numeric",
  kilimallProductsCopied: "numeric",
  repliedFbComments: "yesno",
  repliedFbDms: "yesno",
  repliedIgComments: "yesno",
  repliedIgDms: "yesno",
  clearedFbInbox: "yesno",
  clearedIgInbox: "yesno",
  stockChecked: "yesno",
  pricingConfirmed: "yesno",
  competitorsReviewed: "yesno",
  outOfStockReview: "yesno",
  promoVideosPosted: "numeric",
  productDemoVideosRecorded: "numeric",
  wednesdayFollowUpNotes: "text",
  wednesdayEngagementNotes: "text",
  fridayPrepareWeekendPromos: "yesno",
  fridayPostEngagingVideos: "numeric",
  fridayImprovementSuggestions: "text",
  saturdayLiveSessionNotes: "text",
  weeklyPerformanceLiveHighlights: "text",
  weeklyPerformanceSummaryNotes: "text",
} as const satisfies Record<string, "yesno" | "numeric" | "text">;

const brendahLegacyFieldEntries = Object.entries(brendahLegacyFieldTypes);
const brendahLegacyFieldKeys = brendahLegacyFieldEntries.map(([key]) => key);



type ReceiptItem = { id: string; productName: string; buyingPrice: number | "" };
type ReceiptRow = {
  id: string;
  receiptNumber: string;
  sellingTotal: number | "";
  paymentMethod: "MPESA" | "CASH" | "";
  items: ReceiptItem[];
};

type RemoteSummaryPayload = {
  period?: { key?: string; label?: string; start?: string; end?: string };
  aggregates?: {
    totalSales?: number;
    visibleSales?: number;
    totalItems?: number;
    totalReceipts?: number;
    visibleReceipts?: number;
    totalReceiptRows?: number;
    paymentStats?: { totalSalesMpesa?: number; totalSalesCash?: number };
    commission?: { commission?: number };
    commissionBreakdown?: {
      directSalesCommission?: number;
      posProductCommission?: number;
      productUploadCommission?: number;
      otherCommission?: number;
      totalCommission?: number;
    };
  };
};

type ProductActivitySummary = {
  uploaded: number;
  edited: number;
  copied: number;
  commission: {
    newProducts: number;
    editedProducts: number;
    copiedProducts: number;
    total: number;
  };
};

type ProductActivityPayload = {
  daily: ProductActivitySummary;
  periodTotals: ProductActivitySummary;
  website?: {
    daily: ProductActivitySummary;
    periodTotals: ProductActivitySummary;
  };
  marketplaces?: {
    daily: MarketplaceProductActivityBreakdown;
    periodTotals: MarketplaceProductActivityBreakdown;
  };
};

type MarketplaceProductActivityBreakdown = {
  jumia: ProductActivitySummary;
  kilimall: ProductActivitySummary;
  total: ProductActivitySummary;
};

const summarizeProductActivityCounts = (counts: {
  uploaded: number;
  edited: number;
  copied: number;
}): ProductActivitySummary => {
  const uploaded = Math.max(0, Math.floor(Number(counts.uploaded) || 0));
  const edited = Math.max(0, Math.floor(Number(counts.edited) || 0));
  const copied = Math.max(0, Math.floor(Number(counts.copied) || 0));
  const newProducts = Math.min(Math.max(0, uploaded - 2_000) * 3, 10_000);
  const editedProducts = Math.floor(edited / 10);
  const copiedProducts = Math.floor(copied / 5);
  return {
    uploaded,
    edited,
    copied,
    commission: {
      newProducts,
      editedProducts,
      copiedProducts,
      total: newProducts + editedProducts + copiedProducts,
    },
  };
};

const getUnpricedSaleKey = (sale: GroupedUnpricedSale) => `${sale.source}:${sale.id}`;
const getUnpricedDraftKey = (sale: GroupedUnpricedSale, receiptItemId?: string) =>
  receiptItemId ? `${sale.source}:item:${receiptItemId}` : getUnpricedSaleKey(sale);

const dayOptions: DayName[] = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const deriveDayOfWeek = (dateStr: string): DayName => {
  const d = new Date(dateStr);
  const map = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  const label = map[d.getDay()] as DayName | "Sunday";
  const exists = marketingDayConfigs.find((c) => c.day === label);
  return exists?.day ?? "Monday";
};

const defaultFormState = (): MarketingDailyFormState => {
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  const day = deriveDayOfWeek(todayStr);
  const dynamic: Record<string, boolean | number | string | null> = {};
  marketingFieldKeys.forEach((key) => {
    const type = marketingFieldTypes[key];
    dynamic[key] = type === "yesno" ? false : "";
  });
  brendahLegacyFieldEntries.forEach(([key, type]) => {
    dynamic[key] = type === "yesno" ? false : "";
  });
  return {
    date: todayStr,
    dayOfWeek: day,
    fields: { ...dynamic },
  };
};

const pillClass = (checked: boolean) =>
  `rounded-full border px-4 py-2 text-sm font-medium transition ${
    checked
      ? "border-emerald-400 bg-emerald-400 text-black shadow-lg shadow-emerald-500/20"
      : "border-slate-700 bg-slate-800 text-slate-200 hover:border-slate-500"
  }`;

const toDateInput = (value: Date) => value.toISOString().slice(0, 10);

const formatKES = (value?: number | null) =>
  `KES ${Number(value ?? 0).toLocaleString("en-KE", { maximumFractionDigits: 0 })}`;

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

// Defaults and options used by the receipts list component (must come after toDateInput)
const defaultDate = toDateInput(new Date());

const ReceiptRangeOptions = [
  { key: "today", label: "Today" },
  { key: "this-week", label: "This week" },
  { key: "period", label: "This trading period" },
  { key: "custom", label: "Custom range" },
];

// Placeholder for optional period range; populated by server or left undefined
const periodRange: { start?: string; end?: string; label?: string } | undefined = undefined;

const toDateInputFromString = (value: string | undefined, fallback: string) => {
  if (!value) return fallback;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return parsed.toISOString().slice(0, 10);
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

/* ---------- Quick stats card ---------- */

type StatsCardProps = {
  periodLabel: string;
  receipts: number;
  receiptRows: number;
  visibleSalesKes: number;
  recognizedSalesKes: number;
  recognizedReceipts?: number;
  items: number;
  commissionKes: number;
  commissionBreakdown?: {
    directSalesCommission?: number;
    posProductCommission?: number;
    productUploadCommission?: number;
    otherCommission?: number;
    totalCommission?: number;
  } | null;
  currentSalesForTier: number;
  nextTarget: number | null;
};

function StatsCard({
  periodLabel,
  receipts,
  receiptRows,
  visibleSalesKes,
  recognizedSalesKes,
  recognizedReceipts = receipts,
  items,
  commissionKes,
  commissionBreakdown = null,
  currentSalesForTier,
  nextTarget,
}: StatsCardProps) {
  const hasNextTier = typeof nextTarget === "number" && nextTarget > 0;
  const { locked, toggle } = useCardLock("marketing:quickstats");
  const mask = (val: React.ReactNode) => (locked ? "..." : val);

  const remaining =
    hasNextTier && nextTarget! > currentSalesForTier
      ? nextTarget! - currentSalesForTier
      : 0;

  const progress =
    hasNextTier && nextTarget!
      ? Math.min((currentSalesForTier / nextTarget!) * 100, 100)
      : 100;

  return (
    <Card className="h-full border-slate-800 bg-slate-900/80 shadow-xl shadow-black/40">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold">Quick stats</h2>
          <LockButton locked={locked} onToggle={toggle} />
        </div>
        <p className="text-xs text-slate-400 text-right">{periodLabel}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Receipts */}
        <div className="rounded-2xl bg-slate-950/60 px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-slate-400">Receipts</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-400">{mask(receipts)}</p>
          <p className="text-[11px] text-slate-400">
            POS receipts in selected range
          </p>
        </div>

        {/* Sales */}
        <div className="rounded-2xl bg-slate-950/60 px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-slate-400">Sales (KES)</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-400">
            {mask(recognizedSalesKes.toLocaleString())}
          </p>
          <p className="text-[11px] text-slate-400">
            {periodLabel}
          </p>
        </div>

        {/* Commission */}
        <div className="rounded-2xl bg-slate-950/60 px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-slate-400">
            Commission (KES)
          </p>
          <p className="mt-1 text-2xl font-semibold text-emerald-400">{mask(commissionKes.toLocaleString())}</p>
        </div>

        {/* Items */}
        <div className="rounded-2xl bg-slate-950/60 px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-slate-400">Items sold</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-400">{mask(items)}</p>
        </div>
      </div>

      {/* Progress toward next tier */}
        <div className="mt-6 space-y-2">
        <p className="text-xs uppercase tracking-wide text-slate-400">To next tier</p>
        <p className="text-xs sm:text-sm text-slate-200">
          {hasNextTier && remaining > 0
            ? `KES ${remaining.toLocaleString()} more to hit next tier`
            : "You've reached the top tier for this period!"}
        </p>
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
          <div
            className="h-full rounded-full bg-emerald-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </Card>
  );
}

type EarningsCardProps = {
  summary: EarningsSummary | null;
  downloadHref?: string;
};

function EarningsCard({ summary, downloadHref }: EarningsCardProps) {
  const { locked, toggle } = useCardLock("marketing:earnings");
  if (!summary) return null;
  const mask = (v: React.ReactNode) => (locked ? "..." : v);
  const breakdown = buildEarningsCardBreakdown({
    ...summary,
    commissionTotal: (summary as any).commission ?? (summary as any).salesCommission ?? 0,
  });

  return (
    <Card className="border-slate-800 bg-slate-900/80 shadow-xl shadow-black/40">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div>
            <h2 className="text-lg font-semibold">Earnings this period</h2>
            <p className="text-xs text-slate-400">{summary.periodLabel}</p>
          </div>
          <LockButton locked={locked} onToggle={toggle} />
        </div>
        <div className="text-right text-xs">
          <p className="text-slate-400 uppercase tracking-wide">Net pay</p>
          <p className="text-xl font-semibold text-emerald-400">{mask(`KES ${breakdown.netPay.toLocaleString()}`)}</p>
        </div>
      </div>

      <div className="space-y-2 text-sm">
            {(summary as any).jenifferProgress ? (
              <div className="rounded-xl border border-amber-600/30 bg-amber-900/5 p-3">
                <div className="text-xs uppercase tracking-wide text-amber-300">Jeniffer progress</div>
                <div className="mt-1 flex items-center justify-between">
                  <div className="text-xs text-amber-200">Next target</div>
                  <div className="text-sm font-semibold text-amber-100">{((summary as any).jenifferProgress.nextTarget ?? "—").toString()}</div>
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <div className="text-xs text-amber-200">Prorated earned</div>
                  <div className="text-sm font-semibold text-amber-100">KES {(Number((summary as any).jenifferProgress.prorated) ?? 0).toLocaleString()}</div>
                </div>
                <div className="mt-2 text-xs text-amber-300">Band progress: {Math.round(((summary as any).jenifferProgress.progressPercent ?? 0) * 10000) / 100}%</div>
              </div>
            ) : null}
        {breakdown.lines.map((row) => (
          <div
            key={row.label}
            className="flex items-center justify-between rounded-xl bg-slate-950/60 px-3 py-2"
          >
            <span className="text-slate-300">{row.label}</span>
            <span
              className={
                row.kind === "earning"
                  ? "font-semibold text-emerald-400"
                  : "font-semibold text-rose-400"
              }
            >
              {mask(`${row.kind === "deduction" ? "-" : ""}KES ${Math.abs(row.amount).toLocaleString()}`)}
            </span>
          </div>
        ))}
      </div>
      {downloadHref ? (
      <div className="mt-4">
        <Link
          href={downloadHref}
          className="inline-flex rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-100 transition hover:border-white/30 hover:bg-white/10"
        >
          Download payslip
        </Link>
      </div>
      ) : null}
    </Card>
  );
}

function BrendahQuickStatsCard(props: {
  periodLabel: string;
  receipts: number;
  salesKes: number;
  newProducts: number;
  editedProducts: number;
  copiedProducts: number;
  commissionKes: number;
}) {
  const { periodLabel, receipts, salesKes, newProducts, editedProducts, copiedProducts, commissionKes } = props;
  const { locked, toggle } = useCardLock("marketing:quickstats");
  const mask = (value: React.ReactNode) => (locked ? "..." : value);

  return (
    <Card className="border-slate-800 bg-slate-900/80 shadow-xl shadow-black/40">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold">Quick stats</h2>
          <LockButton locked={locked} onToggle={toggle} />
        </div>
        <p className="text-xs text-slate-400 text-right">{periodLabel}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {[
          { label: "Receipts", value: receipts },
          { label: "Sales (KES)", value: salesKes.toLocaleString() },
          { label: "New products", value: newProducts },
          { label: "Edited products", value: editedProducts },
          { label: "Copied products", value: copiedProducts },
          { label: "Commission (KES)", value: commissionKes.toLocaleString() },
        ].map((item) => (
          <div key={item.label} className="rounded-2xl bg-slate-950/60 px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-slate-400">{item.label}</p>
            <p className="mt-1 text-2xl font-semibold text-emerald-400">{mask(item.value)}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

function BrendahLegacyEarningsCard(props: { summary: EarningsSummary | null; downloadHref?: string }) {
  const { summary, downloadHref } = props;
  const { locked, toggle } = useCardLock("marketing:earnings");
  if (!summary) return null;
  const mask = (v: React.ReactNode) => (locked ? "..." : v);
  const netPay = Number(summary.netPay ?? 0);
  const baseSalary = Number(summary.baseSalary ?? 0);
  const marketingCommission = Number((summary as any).salesCommission ?? (summary as any).commission ?? 0);

  return (
    <Card className="border-slate-800 bg-slate-900/80 shadow-xl shadow-black/40">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Earnings Summary</div>
          <p className="mt-2 text-sm text-slate-400">{summary.periodLabel}</p>
        </div>
        <LockButton locked={locked} onToggle={toggle} />
      </div>

      <div className="rounded-2xl border border-emerald-500/30 bg-slate-950/60 p-4">
        <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Net Pay</div>
        <div className="mt-2 text-3xl font-semibold text-emerald-400">{mask(formatKES(netPay))}</div>
      </div>

      <div className="mt-4 space-y-3 text-sm">
        <div className="flex items-center justify-between rounded-xl bg-slate-950/60 px-3 py-2">
          <span className="text-slate-300">Base salary</span>
          <span className="font-semibold text-slate-100">{mask(formatKES(baseSalary))}</span>
        </div>
        <div className="flex items-center justify-between rounded-xl bg-slate-950/60 px-3 py-2">
          <span className="text-slate-300">Marketing commission</span>
          <span className="font-semibold text-slate-100">{mask(formatKES(marketingCommission))}</span>
        </div>
      </div>

      {downloadHref ? (
        <div className="mt-4">
          <Link
            href={downloadHref}
            className="inline-flex rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-100 transition hover:border-white/30 hover:bg-white/10"
          >
            Download payslip
          </Link>
        </div>
      ) : null}
    </Card>
  );
}

type ReceiptRangeKey = "today" | "this-week" | "period" | "custom";

type MarketingReceiptRow = {
  id: string;
  orderRef?: string | null;
  receiptNumber?: string | null;
  docType?: string | null;
  createdAt: string;
  customerName?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
  attendantName?: string | null;
  total?: number | null;
};

function ReceiptsList({ anchorId = "receipts" }: { anchorId?: string }) {

  const [filters, setFilters] = useState({
    start: defaultDate,
    end: defaultDate,
    query: "",
  });
  const [rangeKey, setRangeKey] = useState<ReceiptRangeKey>("today");
  const [receipts, setReceipts] = useState<MarketingReceiptRow[]>([]);
  const [attendantId, setAttendantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setFilters((prev) => ({ ...prev, start: defaultDate, end: defaultDate }));
    setRangeKey("today");
  }, [defaultDate]);

  useEffect(() => {
    let cancelled = false;
    const loadAttendant = async () => {
      try {
        const params = new URLSearchParams();
        if (typeof window !== "undefined") {
          const impersonateId = new URLSearchParams(window.location.search).get("impersonateId");
          if (impersonateId) params.set("impersonateId", impersonateId);
        }
        const res = await fetch(
          `/api/attendants/me${params.toString() ? `?${params.toString()}` : ""}`,
          { cache: "no-store" },
        );
        if (!res.ok) return;
        const payload = await res.json().catch(() => null);
        const resolved =
          payload?.data?.user?.id ??
          payload?.user?.id ??
          null;
        if (!cancelled && resolved) setAttendantId(String(resolved));
      } catch {
        // no-op: receipts call below will surface auth errors
      }
    };
    void loadAttendant();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!attendantId) return;
    let cancelled = false;
    const controller = new AbortController();
    const fetchReceipts = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        params.set("includeItems", "false");
        params.set("size", "40");
        params.set("includeLedger", "true");
        params.set("attendantId", attendantId);
        params.set("start", filters.start);
        params.set("end", filters.end);
        if (filters.query.trim()) params.set("q", filters.query.trim());

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
        if (!cancelled) setLoading(false);
      }
    };
    fetchReceipts();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [attendantId, filters]);

  const applyRange = (key: ReceiptRangeKey) => {
    const { start, end } = (() => {
      if (key === "today") {
        return { start: defaultDate, end: defaultDate };
      }
      if (key === "this-week") {
        const { start: weekStart, end: weekEnd } = getWeekBounds(new Date());
        return { start: toDateInput(weekStart), end: toDateInput(weekEnd) };
      }
      if (key === "period" && periodRange) {
        return {
          start: toDateInputFromString(periodRange.start, defaultDate),
          end: toDateInputFromString(periodRange.end, defaultDate),
        };
      }
      return { start: defaultDate, end: defaultDate };
    })();
    setFilters((prev) => ({ ...prev, start, end }));
    setRangeKey(key);
  };

  const summary = useMemo(() => {
    const totalSales = receipts.reduce((sum, receipt) => sum + Number(receipt.total ?? 0), 0);
    return {
      totalSales,
      count: receipts.length,
    };
  }, [receipts]);

  const rangeLabel = (() => {
    if (rangeKey === "today") return "Today";
    if (rangeKey === "this-week") return "This week";
    if (rangeKey === "period") return periodRange?.label ?? "This trading period";
    return "Custom range";
  })();

  return (
    <div id={anchorId} className="space-y-5">
      <Card className="border-slate-800 bg-slate-900/80 shadow-xl shadow-black/40">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Receipts list</p>
            <h2 className="text-lg font-semibold text-slate-100">Read-only receipts history</h2>
            <p className="text-sm text-slate-400">
              Explore your POS receipts and filter by date range or search term.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-wide">
            {ReceiptRangeOptions.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => applyRange(option.key as any)}
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
            onChange={(event) => {
              setRangeKey("custom");
              setFilters((prev) => {
                const next = { ...prev, start: event.target.value };
                if (next.end && next.start && next.start > next.end) {
                  next.end = next.start;
                }
                return next;
              });
            }}
            className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
          />
        </label>
        <label className="text-xs uppercase tracking-wide text-slate-400">
          End date
          <input
            type="date"
            value={filters.end}
            onChange={(event) => {
              setRangeKey("custom");
              setFilters((prev) => {
                const next = { ...prev, end: event.target.value };
                if (next.start && next.end && next.end < next.start) {
                  next.start = next.end;
                }
                return next;
              });
            }}
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
          <p className="text-xs text-slate-400">Aggregated from the list below</p>
        </div>
      </div>

      <div className="space-y-2">
        {loading && (
          <p className="text-sm text-slate-400">Loading receipts…</p>
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
                {receipt.attendantName ?? "Attendant unknown"} • {formatDateTime(receipt.createdAt)}
              </p>
              <p className="text-[11px] text-slate-500">
                {receipt.customerName ?? "-"} • {receipt.docType ?? "Receipt"}
              </p>
              <p className="text-[11px] text-slate-500">
                {(receipt.customerPhone || "-")}{receipt.customerEmail ? ` • ${receipt.customerEmail}` : ""}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-emerald-300">{formatKES(receipt.total)}</p>
              <Link
                href={`/receipts/${receipt.id}`}
                className="text-xs text-emerald-300 hover:text-emerald-200"
              >
                View details
              </Link>
            </div>
          </div>
        ))}
        </div>
      </Card>
    </div>
  );
}

/* ---------- Page component ---------- */

export function MarketingTrackerTopActions() {
  const [downloadingPerformance, setDownloadingPerformance] = useState(false);
  const { selectedPeriod } = useTradingPeriodQueryState();
  const searchParams = useSearchParams();
  const impersonateId = searchParams.get("impersonateId");
  const withContext = (href: string) => withImpersonateId(href, impersonateId);
  const selectedReportDate = searchParams.get("reportDate") || defaultFormState().date;
  const downloadPerformancePdf = () => {
    try {
      setDownloadingPerformance(true);
      const params = new URLSearchParams();
      if (selectedPeriod?.key) params.set("periodKey", selectedPeriod.key);
      if (impersonateId) params.set("impersonateId", impersonateId);
      params.set("ts", String(Date.now()));
      const url = `/api/attendant/daily-report/performance-receipt/pdf?${params.toString()}`;
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    } finally {
      setTimeout(() => setDownloadingPerformance(false), 700);
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <Link
          href={withContext(`/receipts?view=create&start=${selectedReportDate}&end=${selectedReportDate}`)}
          className="rounded-2xl bg-emerald-400 px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-950 transition hover:bg-emerald-300"
        >
          Create receipt
        </Link>
        <button
          type="button"
          onClick={downloadPerformancePdf}
          className="rounded-2xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-cyan-100 transition hover:bg-cyan-400/15"
        >
          {downloadingPerformance ? "Preparing..." : "Download report"}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Link
          href={withContext("/marketing/receipts?tab=pos")}
          className="rounded-xl border border-white/10 px-3 py-2 text-center text-xs text-slate-200 hover:bg-white/5"
        >
          POS receipts
        </Link>
        <Link
          href={withContext("/marketing/receipts?tab=web-orders")}
          className="rounded-xl border border-white/10 px-3 py-2 text-center text-xs text-slate-200 hover:bg-white/5"
        >
          Web orders
        </Link>
        <Link
          href={withContext("/marketing/agent-orders")}
          className="rounded-xl border border-white/10 px-3 py-2 text-center text-xs text-slate-200 hover:bg-white/5"
        >
          Agent orders
        </Link>
        <Link
          href={withContext("/marketing/receipts?tab=quotations")}
          className="rounded-xl border border-white/10 px-3 py-2 text-center text-xs text-slate-200 hover:bg-white/5"
        >
          Quotations
        </Link>
        <Link
          href={withContext("/attendant/voice?tab=followups")}
          className="rounded-xl border border-white/10 px-3 py-2 text-center text-xs text-slate-200 hover:bg-white/5"
        >
          Voice calls
        </Link>
        <Link
          href={withContext("/attendant/wellness")}
          className="rounded-xl border border-white/10 px-3 py-2 text-center text-xs text-slate-200 hover:bg-white/5"
        >
          Wellness
        </Link>
      </div>
    </div>
  );
}

export default function MarketingTrackerLegacySections() {
  const searchParams = useSearchParams();
  const trackerImpersonateId = searchParams.get("impersonateId");
  const impersonateIdFromWindow = () =>
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("impersonateId")
      : null;

  const [form, setForm] = useState<MarketingDailyFormState>(() =>
    defaultFormState(),
  );
  const [receipts, setReceipts] = useState<ReceiptRow[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [weeklyMeetingAttended, setWeeklyMeetingAttended] = useState(false);
  const [weeklyVideoShootParticipated, setWeeklyVideoShootParticipated] =
    useState(false);
  const [weeklyVideoCount, setWeeklyVideoCount] = useState<number | "">("");
  const [periodSummary, setPeriodSummary] = useState<null | {
    period: { key: string; label: string; start: string; end: string };
    aggregates: {
      totalSales: number;
      totalItems: number;
      paymentStats: {
        totalSalesMpesa: number;
        totalSalesCash: number;
        countMpesaReceipts?: number;
        countCashReceipts?: number;
      };
      commission: { commission: number };
    };
  }>(null);
  // Background authoritative server summary used for Quick stats calculations.
  // We keep this separate from `periodSummary` which controls the visible
  // summary panel. The panel should remain hidden unless the attendant
  // explicitly submits - serverPeriodSummary is updated by the poll.
  const [serverPeriodSummary, setServerPeriodSummary] = useState<null | {
    period: { key: string; label: string; start: string; end: string };
    aggregates: {
      totalSales: number;
      totalItems: number;
      paymentStats: {
        totalSalesMpesa: number;
        totalSalesCash: number;
        countMpesaReceipts?: number;
        countCashReceipts?: number;
      };
      commission: { commission: number };
    };
  }>(null);
  const { currentPeriod, selectedPeriod, selectedPeriodKey, setSelectedPeriod } =
    useTradingPeriodQueryState();
  const [earningsSummary, setEarningsSummary] = useState<EarningsSummary | null>(null);
  const earningsSummaryJsonRef = useRef<string>("");
  const [rawUnpricedSales, setRawUnpricedSales] = useState<UnpricedSale[]>([]);
  const unpricedSales = useMemo(
    () => groupMarketingUnpricedSales(rawUnpricedSales),
    [rawUnpricedSales],
  );
  const effectivePeriodRange =
    serverPeriodSummary?.period ?? periodSummary?.period ?? undefined;
  const [buyingDrafts, setBuyingDrafts] = useState<Record<string, string>>({});
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [productActivity, setProductActivity] = useState<ProductActivityPayload | null>(null);
  const [productActivityLoading, setProductActivityLoading] = useState(false);
  const [marketplaceSaving, setMarketplaceSaving] = useState(false);
  const [marketplaceDraftDirty, setMarketplaceDraftDirty] = useState(false);
  const marketplaceDraftDirtyRef = useRef(false);
  const [deletingSaleKey, setDeletingSaleKey] = useState<string | null>(null);
  const [pricingSaleKey, setPricingSaleKey] = useState<string | null>(null);
  const unpricedQueueStats = useMemo(() => {
    return unpricedSales.reduce(
      (acc, sale) => {
        acc.receipts += 1;
        if (sale.source === "support") {
          acc.supportReceipts += 1;
          const pendingItems = sale.receiptItems?.length ?? sale.itemsPending ?? 0;
          if (pendingItems > 0) {
            acc.items += pendingItems;
          } else {
            const fallback = sale.itemsPending ?? 0;
            acc.items += fallback > 0 ? fallback : 1;
          }
        } else {
          const pendingItems = (sale.groupedSaleIds?.length ?? sale.itemsPending ?? 1) || 1;
          acc.items += pendingItems;
        }
        return acc;
      },
      { receipts: 0, supportReceipts: 0, items: 0 },
    );
  }, [unpricedSales]);
  useEffect(() => {
    earningsSummaryJsonRef.current = JSON.stringify(earningsSummary ?? {});
  }, [earningsSummary]);

  const config = useMemo(
    () =>
      marketingDayConfigs.find((c) => c.day === form.dayOfWeek) ??
      marketingDayConfigs[0],
    [form.dayOfWeek],
  );

  useEffect(() => {
    setForm((prev) => ({ ...prev, dayOfWeek: deriveDayOfWeek(prev.date) }));
    marketplaceDraftDirtyRef.current = false;
    setMarketplaceDraftDirty(false);
  }, [form.date]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("reportDate") === form.date) return;
    params.set("reportDate", form.date);
    const nextQuery = params.toString();
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}${window.location.hash}`,
    );
  }, [form.date]);

  useEffect(() => {
    if (!periodSummary) return;
    const timer = setTimeout(() => setPeriodSummary(null), 5 * 60 * 1000);
    return () => clearTimeout(timer);
  }, [periodSummary]);

  const groupedYesNo = useMemo(() => {
    const groups = new Map<string, typeof config.yesNoFields>();
    (config?.yesNoFields || []).forEach((f) => {
      if (!groups.has(f.section)) groups.set(f.section, []);
      groups.get(f.section)?.push(f);
    });
    return Array.from(groups.entries());
  }, [config]);

  const router = useRouter();

  const handleSetBuyingDraft = (key: string, value: string) => {
    setBuyingDrafts((prev) => ({ ...prev, [key]: value }));
  };

  const allocateReceiptBuyingPrices = (
    total: number,
    items: Array<{ id: string; saleValue?: number }>,
  ) => {
    const roundedTotal = Math.max(0, Math.round(total));
    if (!items.length || roundedTotal <= 0) return [];
    const weights = items.map((item) => Math.max(0, item.saleValue ?? 0));
    const weightSum = weights.reduce((sum, value) => sum + value, 0);
    let remainder = roundedTotal;
    const allocations = items.map((item, index) => {
      const value =
        weightSum > 0
          ? Math.floor((weights[index] / weightSum) * roundedTotal)
          : Math.floor(roundedTotal / items.length);
      remainder -= value;
      return { id: item.id, value };
    });
    let pointer = 0;
    while (remainder > 0 && allocations.length > 0) {
      allocations[pointer % allocations.length].value += 1;
      remainder -= 1;
      pointer += 1;
    }
    return allocations;
  };

  const submitBuyingPrice = async (
    sale: GroupedUnpricedSale,
    receiptItemId: string | undefined,
    buyingPrice: number,
    options?: { overrideSaleId?: string; saleValue?: number },
  ) => {
    if (sale.source === "support" && !receiptItemId) {
      throw new Error("Select an item on the receipt to price");
    }

    const targetSaleId = options?.overrideSaleId ?? sale.id;
    const endpoint =
      sale.source === "support" ? "/api/support/price-sale" : "/api/marketing/price-sale";
    const body =
      sale.source === "support"
        ? { receiptItemId, buyingPrice }
        : { dailySaleId: targetSaleId, buyingPrice };

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.error || "Failed to save buying price");
    }
    const data = await res.json().catch(() => null);

    let saleValueDelta = 0;
    let paymentDelta: "MPESA" | "CASH" | null = null;
    setRawUnpricedSales((prev) => {
      const next: UnpricedSale[] = [];
      for (const row of prev) {
        if (row.id !== targetSaleId || row.source !== sale.source) {
          next.push(row);
          continue;
        }
        if (row.source === "support" && receiptItemId) {
          const remainingItems = (row.receiptItems || []).filter((item) => item.id !== receiptItemId);
          if (!remainingItems.length) {
            saleValueDelta = data?.receiptTotal ?? row.sellingPrice;
            paymentDelta = row.paymentMethod;
            continue;
          }
          next.push({
            ...row,
            receiptItems: remainingItems,
            itemsPending: Math.max(0, (row.itemsPending ?? remainingItems.length + 1) - 1),
          });
          continue;
        }
        saleValueDelta = options?.saleValue ?? data?.saleValue ?? row.sellingPrice;
        paymentDelta = row.paymentMethod;
      }
      return next;
    });

    if (saleValueDelta > 0) {
      const methodKey = paymentDelta === "CASH" ? "totalSalesCash" : "totalSalesMpesa";
      setServerPeriodSummary((prev) => {
        if (!prev) return prev;
        const updatedPaymentStats = {
          ...prev.aggregates.paymentStats,
          [methodKey]: (prev.aggregates.paymentStats[methodKey] ?? 0) + saleValueDelta,
        };
        return {
          ...prev,
          aggregates: {
            ...prev.aggregates,
            totalSales: prev.aggregates.totalSales + saleValueDelta,
            totalItems: prev.aggregates.totalItems + 1,
            paymentStats: updatedPaymentStats,
          },
        };
      });

      try {
        setEarningsSummary((prev) => {
          if (!prev) return prev;
          const currentTotalSales = serverPeriodSummary?.aggregates?.totalSales ?? 0;
          const newTotalSales = currentTotalSales + saleValueDelta;
          const commissionInfo = getCommissionSummaryForSales(newTotalSales);
          const newCommission = Math.round(commissionInfo.commission ?? 0);
          const delta = newCommission - (prev.commission ?? 0);
          if (delta === 0) return { ...prev, commission: newCommission };
          return {
            ...prev,
            commission: newCommission,
            totalEarnings: (prev.totalEarnings ?? 0) + delta,
            netPay: (prev.netPay ?? 0) + delta,
          };
        });
      } catch {
        // ignore client-side calculation issues
      }
    }
  };

  const handleSubmitBuyingPrice = async (sale: GroupedUnpricedSale, receiptItemId?: string) => {
    const draftKey = getUnpricedDraftKey(sale, receiptItemId);
    const rawValue = buyingDrafts[draftKey] ?? "";
    const parsedValue = Number(rawValue);
    if (!rawValue || Number.isNaN(parsedValue) || parsedValue <= 0) {
      showToast("Enter a valid buying price", "error");
      return;
    }

    const buyingPrice = Math.round(parsedValue);
    setPricingSaleKey(draftKey);
    try {
      await submitBuyingPrice(sale, receiptItemId, buyingPrice);
      setBuyingDrafts((prev) => {
        const next = { ...prev };
        delete next[draftKey];
        return next;
      });
      showToast("Buying price saved", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to save buying price", "error");
    } finally {
      setPricingSaleKey(null);
    }
  };

  const handleSubmitSupportReceiptTotal = async (sale: GroupedUnpricedSale) => {
    const draftKey = getUnpricedDraftKey(sale);
    const rawValue = buyingDrafts[draftKey] ?? "";
    const parsedValue = Number(rawValue);
    if (!rawValue || Number.isNaN(parsedValue) || parsedValue <= 0) {
      showToast("Enter a valid buying price", "error");
      return;
    }
    const items = sale.receiptItems || [];
    if (!items.length) {
      showToast("No receipt items available for pricing", "error");
      return;
    }
    const allocations = allocateReceiptBuyingPrices(Math.round(parsedValue), items);
    setPricingSaleKey(draftKey);
    try {
      for (let i = 0; i < allocations.length; i++) {
        const { id, value } = allocations[i];
        await submitBuyingPrice(sale, id, value);
      }
      setBuyingDrafts((prev) => {
        const next = { ...prev };
        delete next[draftKey];
        return next;
      });
      showToast("Buying price saved", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to save buying price", "error");
    } finally {
      setPricingSaleKey(null);
    }
  };

  const handleSubmitMarketingReceiptTotal = async (sale: GroupedUnpricedSale) => {
    const draftKey = getUnpricedDraftKey(sale);
    const rawValue = buyingDrafts[draftKey] ?? "";
    const parsedValue = Number(rawValue);
    if (!rawValue || Number.isNaN(parsedValue) || parsedValue <= 0) {
      showToast("Enter a valid buying price", "error");
      return;
    }
    const items = (sale.receiptItems as ReceiptGroupingItem[] | undefined) ?? [];
    if (!items.length) {
      showToast("No receipt items available for pricing", "error");
      return;
    }
    const allocations = allocateReceiptBuyingPrices(Math.round(parsedValue), items);
    setPricingSaleKey(draftKey);
    try {
      for (const { id, value } of allocations) {
        const entry = items.find((item) => item.id === id);
        await submitBuyingPrice(sale, undefined, value, {
          overrideSaleId: id,
          saleValue: entry?.saleValue,
        });
      }
      setBuyingDrafts((prev) => {
        const next = { ...prev };
        delete next[draftKey];
        return next;
      });
      showToast("Buying price saved", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to save buying price", "error");
    } finally {
      setPricingSaleKey(null);
    }
  };

  const handleDeleteUnpricedSale = async (sale: GroupedUnpricedSale) => {
    const key = getUnpricedSaleKey(sale);
    if (typeof window !== "undefined") {
      const confirmed = window.confirm("Delete this pending sale? This cannot be undone.");
      if (!confirmed) return;
    }
    setDeletingSaleKey(key);
    try {
      const ids =
        sale.source === "daily-sale" && sale.groupedSaleIds?.length
          ? sale.groupedSaleIds
          : [sale.id];
      for (const saleId of ids) {
        const res = await fetch("/api/marketing/unpriced-sales/delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ saleId, source: sale.source }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => null);
          showToast(err?.error || "Failed to delete sale", "error");
          return;
        }
      }
      setRawUnpricedSales((prev) =>
        prev.filter((row) => !(sale.groupedSaleIds ?? [sale.id]).includes(row.id)),
      );
      setBuyingDrafts((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      showToast("Sale deleted", "success");
    } catch {
      showToast("Failed to delete sale", "error");
    } finally {
      setDeletingSaleKey((prev) => (prev === key ? null : prev));
    }
  };

  // auth guard
  useEffect(() => {
    (async () => {
      try {
        const imp = impersonateIdFromWindow();
        const url = imp
          ? `/api/attendants/me?impersonateId=${encodeURIComponent(imp)}`
          : "/api/attendants/me";
        const res = await fetch(url, { credentials: "same-origin" });
        if (!res.ok) {
          try {
            const cb = typeof window !== "undefined" ? window.location.pathname : "/marketing/tracker";
            router.replace(`/attendant/login?callbackUrl=${encodeURIComponent(cb)}`);
          } catch (e) {
            router.replace("/attendant/login");
          }
          return;
        }
        const data = await res.json().catch(() => null);
        const user = data?.user;
        if (!user) {
          try {
            const cb = typeof window !== "undefined" ? window.location.pathname : "/marketing/tracker";
            router.replace(`/attendant/login?callbackUrl=${encodeURIComponent(cb)}`);
          } catch (e) {
            router.replace("/attendant/login");
          }
          return;
        }
        setCurrentUserEmail(user.email?.toLowerCase() ?? null);
        const role = user.role as string | undefined;
        const category = user.attendantCategory as string | undefined;
        if (role === "ADMIN") return;
        if (user.email?.toLowerCase?.() === BRENDAH_EMAIL) return;
        if (category !== "DIRECT_SALES_OPS") {
          const dest = getLandingPage(category ?? null, role);
          router.replace(dest);
        }
      } catch {
        try {
          const cb = typeof window !== "undefined" ? window.location.pathname : "/marketing/tracker";
          router.replace(`/attendant/login?callbackUrl=${encodeURIComponent(cb)}`);
        } catch (e) {
          router.replace("/attendant/login");
        }
      }
    })();
  }, [router]);

  useEffect(() => {
    if (currentUserEmail !== BRENDAH_EMAIL) {
      setProductActivity(null);
      return;
    }

    const controller = new AbortController();
    const loadProductActivity = async () => {
      setProductActivityLoading(true);
      try {
        const params = new URLSearchParams({
          date: form.date,
          periodKey: selectedPeriodKey,
        });
        const imp = impersonateIdFromWindow();
        if (imp) params.set("impersonateId", imp);
        const response = await fetch(`/api/marketing/product-activity?${params.toString()}`, {
          cache: "no-store",
          credentials: "same-origin",
          signal: controller.signal,
        });
        if (!response.ok) return;
        const payload = (await response.json()) as ProductActivityPayload;
        setProductActivity(payload);
        const websiteDaily = payload.website?.daily ?? payload.daily;
        const marketplaceDaily = payload.marketplaces?.daily;
        setForm((current) => ({
          ...current,
          fields: {
            ...current.fields,
            productsUploaded: websiteDaily.uploaded,
            productsEdited: websiteDaily.edited,
            productsCopied: websiteDaily.copied,
            ...(!marketplaceDraftDirtyRef.current && marketplaceDaily
              ? {
                  jumiaProductsUploaded: marketplaceDaily.jumia.uploaded,
                  jumiaProductsEdited: marketplaceDaily.jumia.edited,
                  jumiaProductsCopied: marketplaceDaily.jumia.copied,
                  kilimallProductsUploaded: marketplaceDaily.kilimall.uploaded,
                  kilimallProductsEdited: marketplaceDaily.kilimall.edited,
                  kilimallProductsCopied: marketplaceDaily.kilimall.copied,
                }
              : {}),
          },
        }));
      } catch (error) {
        if ((error as Error).name !== "AbortError") setProductActivity(null);
      } finally {
        setProductActivityLoading(false);
      }
    };

    void loadProductActivity();
    const interval = window.setInterval(loadProductActivity, 15_000);
    return () => {
      controller.abort();
      window.clearInterval(interval);
    };
  }, [currentUserEmail, form.date, selectedPeriodKey]);

  // fetch + poll period summary so Quick stats stay in sync with server
  useEffect(() => {
    const POLL_INTERVAL_MS = 15_000; // poll every 15s
    const controller = new AbortController();

    const buildSummaryFrom = (data: RemoteSummaryPayload) => {
      type PaymentStatsRaw = {
        totalSalesMpesa?: number;
        totalSalesCash?: number;
        countMpesaReceipts?: number;
        countCashReceipts?: number;
      };

      const paymentStatsRaw: PaymentStatsRaw = data.aggregates?.paymentStats ?? {};
      return {
        period: {
          key: data.period?.key ?? "",
          label: data.period?.label ?? "",
          start: data.period?.start ?? "",
          end: data.period?.end ?? "",
        },
      aggregates: {
        totalSales: data.aggregates?.totalSales ?? 0,
        visibleSales: data.aggregates?.visibleSales ?? data.aggregates?.totalSales ?? 0,
        totalReceipts: data.aggregates?.totalReceipts ?? 0,
        visibleReceipts: data.aggregates?.visibleReceipts ?? data.aggregates?.totalReceipts ?? 0,
        totalItems: data.aggregates?.totalItems ?? 0,
        totalReceiptRows: data.aggregates?.totalReceiptRows ?? 0,
        paymentStats: {
          totalSalesMpesa: paymentStatsRaw.totalSalesMpesa ?? 0,
          totalSalesCash: paymentStatsRaw.totalSalesCash ?? 0,
          countMpesaReceipts: paymentStatsRaw.countMpesaReceipts ?? 0,
          countCashReceipts: paymentStatsRaw.countCashReceipts ?? 0,
          },
          commission: {
            commission: data.aggregates?.commission?.commission ?? 0,
          },
          commissionBreakdown: data.aggregates?.commissionBreakdown ?? null,
        },
      };
    };

    const fetchSummary = async () => {
      try {
        if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
        const imp = impersonateIdFromWindow();
        const params = new URLSearchParams({ periodKey: selectedPeriodKey });
        if (imp) {
          params.set("impersonateId", imp);
        }
        const url = `/api/marketing/report/summary?${params.toString()}`;
        const res = await fetch(url, {
          credentials: "same-origin",
          signal: controller.signal,
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = await res.json().catch(() => null);
        if (!data) return;
        const next = buildSummaryFrom(data);
        const safeNext = {
          ...next,
          aggregates: {
            ...next.aggregates,
            paymentStats: {
              totalSalesMpesa: next.aggregates.paymentStats.totalSalesMpesa ?? 0,
              totalSalesCash: next.aggregates.paymentStats.totalSalesCash ?? 0,
              countMpesaReceipts: next.aggregates.paymentStats.countMpesaReceipts ?? 0,
              countCashReceipts: next.aggregates.paymentStats.countCashReceipts ?? 0,
            },
          },
        };
        // update authoritative server-side summary but do NOT show the panel
        // unless the attendant explicitly submitted (periodSummary is used
        // for the visible panel). This keeps Quick stats accurate while the
        // panel remains hidden.
        setServerPeriodSummary((prev) => {
          if (!prev) return safeNext;
          const changed =
            prev.aggregates.totalSales !== safeNext.aggregates.totalSales ||
            (prev.aggregates as any).visibleSales !== (safeNext.aggregates as any).visibleSales ||
            prev.aggregates.totalItems !== safeNext.aggregates.totalItems ||
            prev.aggregates.paymentStats.totalSalesMpesa !== safeNext.aggregates.paymentStats.totalSalesMpesa ||
            prev.aggregates.paymentStats.totalSalesCash !== safeNext.aggregates.paymentStats.totalSalesCash ||
            prev.aggregates.commission.commission !== safeNext.aggregates.commission.commission ||
            prev.period.label !== safeNext.period.label;
          return changed ? safeNext : prev;
        });
      } catch {
        // ignore network/abort errors
      }
    };

    // initial fetch
    fetchSummary();

    const id = setInterval(fetchSummary, POLL_INTERVAL_MS);

    return () => {
      clearInterval(id);
      controller.abort();
    };
  }, [selectedPeriodKey]);

  // Poll earnings summary for the current attendant (used by EarningsCard)
  useEffect(() => {
    const POLL_INTERVAL_MS = 15_000;
    const controller = new AbortController();

    const fetchEarnings = async () => {
      try {
        if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
        const imp = impersonateIdFromWindow();
        const url = imp
          ? `/api/payroll/summary?attendantId=${encodeURIComponent(imp)}&periodKey=${encodeURIComponent(selectedPeriod.key)}`
          : `/api/payroll/summary?periodKey=${encodeURIComponent(selectedPeriod.key)}`;
        const res = await fetch(url, { credentials: "same-origin", signal: controller.signal });
        if (!res.ok) return;
        const data = await res.json().catch(() => null);
        if (!data) return;
        const row = data?.row ?? data?.rows?.[0] ?? null;
        const next = row
          ? (mapPayrollToEarningsSummary(row, Number(row.totalReceipts ?? 0)) as unknown as EarningsSummary)
          : null;
        // shallow compare by JSON to avoid unnecessary updates
        const prevStr = earningsSummaryJsonRef.current;
        const nextStr = JSON.stringify(next ?? {});
        if (next && prevStr !== nextStr) {
          earningsSummaryJsonRef.current = nextStr;
          setEarningsSummary(next);
        }
      } catch {
        // ignore network/abort errors
      }
    };

    fetchEarnings();
    const id = setInterval(fetchEarnings, POLL_INTERVAL_MS);
    return () => {
      clearInterval(id);
      controller.abort();
    };
  }, [selectedPeriod.key]);

  useEffect(() => {
    const POLL_INTERVAL_MS = 20_000;
    if (!currentUserEmail || currentUserEmail !== "jeniffer@betech.co.ke") {
      setRawUnpricedSales([]);
      return;
    }
    const controller = new AbortController();

    const fetchUnpricedSales = async () => {
      try {
        if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
        const res = await fetch("/api/marketing/unpriced-sales", {
          credentials: "same-origin",
          signal: controller.signal,
        });
        if (!res.ok) return;
        const data = await res.json().catch(() => null);
        if (!data?.sales) return;
        setRawUnpricedSales(data.sales);
      } catch {
        // ignore expected aborts/errors
      }
    };

    fetchUnpricedSales();
    const id = setInterval(fetchUnpricedSales, POLL_INTERVAL_MS);
    return () => {
      clearInterval(id);
      controller.abort();
    };
  }, [currentUserEmail]);

  const updateField = (key: string, value: boolean | number | string | null) => {
    setForm((prev) => ({ ...prev, fields: { ...prev.fields, [key]: value } }));
  };

  const updateMarketplaceField = (key: string, value: string) => {
    marketplaceDraftDirtyRef.current = true;
    setMarketplaceDraftDirty(true);
    updateField(key, value);
  };

  const marketplaceDraft = useMemo(() => {
    const count = (key: string) => Math.max(0, Math.floor(Number(form.fields[key]) || 0));
    const jumia = summarizeProductActivityCounts({
      uploaded: count("jumiaProductsUploaded"),
      edited: count("jumiaProductsEdited"),
      copied: count("jumiaProductsCopied"),
    });
    const kilimall = summarizeProductActivityCounts({
      uploaded: count("kilimallProductsUploaded"),
      edited: count("kilimallProductsEdited"),
      copied: count("kilimallProductsCopied"),
    });
    return {
      jumia,
      kilimall,
      total: summarizeProductActivityCounts({
        uploaded: jumia.uploaded + kilimall.uploaded,
        edited: jumia.edited + kilimall.edited,
        copied: jumia.copied + kilimall.copied,
      }),
    };
  }, [form.fields]);

  const productActivityPreview = useMemo(() => {
    const savedDaily = productActivity?.marketplaces?.daily.total;
    const period = productActivity?.periodTotals;
    return summarizeProductActivityCounts({
      uploaded: (period?.uploaded ?? 0) - (savedDaily?.uploaded ?? 0) + marketplaceDraft.total.uploaded,
      edited: (period?.edited ?? 0) - (savedDaily?.edited ?? 0) + marketplaceDraft.total.edited,
      copied: (period?.copied ?? 0) - (savedDaily?.copied ?? 0) + marketplaceDraft.total.copied,
    });
  }, [marketplaceDraft, productActivity]);

  const handleSaveMarketplaceActivity = async () => {
    setMarketplaceSaving(true);
    try {
      const params = new URLSearchParams();
      const impersonateId = impersonateIdFromWindow();
      if (impersonateId) params.set("impersonateId", impersonateId);
      const response = await fetch(`/api/marketing/product-activity${params.size ? `?${params.toString()}` : ""}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          date: form.date,
          periodKey: selectedPeriodKey,
          jumia: marketplaceDraft.jumia,
          kilimall: marketplaceDraft.kilimall,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || "Failed to save marketplace activity");
      setProductActivity(payload as ProductActivityPayload);
      marketplaceDraftDirtyRef.current = false;
      setMarketplaceDraftDirty(false);
      showToast("Jumia and Kilimall product activity saved", "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Failed to save marketplace activity", "error");
    } finally {
      setMarketplaceSaving(false);
    }
  };

const totals = useMemo((): { totalSales: number; totalProfit: number; totalItems: number; filledReceiptsCount: number } => {
    const totalSales = receipts.reduce(
      (sum, r) =>
        sum +
        (typeof r.sellingTotal === "number"
          ? r.sellingTotal
          : Number(r.sellingTotal || 0)),
      0,
    );
    const totalProfit = receipts.reduce((sum, r) => {
      const selling = typeof r.sellingTotal === "number" ? r.sellingTotal : Number(r.sellingTotal || 0);

      // If any item in the receipt does not have a buyingPrice entered,
      // treat the receipt as unpriced and exclude it from profit calculations.
      const allItemsPriced = r.items.every((it) => {
        if (typeof it.buyingPrice === "number") return it.buyingPrice > 0;
        return Number(it.buyingPrice || 0) > 0;
      });

      if (!allItemsPriced) return sum;

      const buyingSum = r.items.reduce(
        (s, it) => s + (typeof it.buyingPrice === "number" ? it.buyingPrice : Number(it.buyingPrice || 0)),
        0,
      );

      return sum + (selling - buyingSum);
    }, 0);
    // Count only "filled" items (product name or a buying price) so the
    // items counter updates as the attendant types product names/prices.
    const totalItems = receipts.reduce((sum, r) => {
      const filled = r.items.filter((it) => {
        const nameFilled = typeof it.productName === "string" && it.productName.trim() !== "";
        const priceFilled =
          typeof it.buyingPrice === "number"
            ? it.buyingPrice > 0
            : Number(it.buyingPrice || 0) > 0;
        return nameFilled || priceFilled;
      }).length;
      return sum + filled;
    }, 0);

    // Count only "filled" receipts (sellingTotal > 0, any filled item, or
    // a non-empty receipt number) so the receipts counter updates while
    // typing, similar to total sales.
    const filledReceiptsCount = receipts.reduce((count, r) => {
      const hasSelling =
        typeof r.sellingTotal === "number"
          ? r.sellingTotal > 0
          : Number(r.sellingTotal || 0) > 0;
      const hasItems = r.items.some((it) => {
        const nameFilled = typeof it.productName === "string" && it.productName.trim() !== "";
        const priceFilled =
          typeof it.buyingPrice === "number"
            ? it.buyingPrice > 0
            : Number(it.buyingPrice || 0) > 0;
        return nameFilled || priceFilled;
      });
      const hasReceiptNumber = (r.receiptNumber ?? "").trim() !== "";
      return count + (hasSelling || hasItems || hasReceiptNumber ? 1 : 0);
    }, 0);

  return { totalSales, totalProfit, totalItems, filledReceiptsCount };
}, [receipts]);

// derived stats for the Quick stats card
  const totalReceipts = totals.filledReceiptsCount ?? receipts.length;
  const totalSales = totals.totalSales;
  const totalItems = totals.totalItems;
  const totalReceiptRows = receipts.length;
  // Combine server-side period totals (if any) with the unsaved local receipts
  // so the Quick stats update instantly as the attendant enters or deletes sales.
  // Use `serverPeriodSummary` (authoritative) for calculations so the visible
  // panel (`periodSummary`) can remain hidden while Quick stats stay accurate.
  const serverPeriodTotalSales = serverPeriodSummary?.aggregates?.totalSales ?? 0;
  const serverVisiblePeriodSales =
    Number((serverPeriodSummary?.aggregates as any)?.visibleSales ?? serverPeriodSummary?.aggregates?.totalSales ?? 0);
  const isJeniffer = currentUserEmail === "jeniffer@betech.co.ke";
  const earningsSales = Number((earningsSummary as any)?.totalSales ?? 0);
  const combinedPeriodSalesRaw = serverPeriodTotalSales + totalSales;
  const combinedVisibleSalesRaw = serverVisiblePeriodSales + totalSales;
  const combinedPeriodSales =
    isJeniffer && combinedPeriodSalesRaw <= 0 && earningsSales > 0
      ? earningsSales
      : combinedPeriodSalesRaw;
  const combinedVisibleSales =
    isJeniffer && combinedVisibleSalesRaw <= 0 && earningsSales > 0
      ? earningsSales
      : combinedVisibleSalesRaw;
  const serverPeriodTotalItems = serverPeriodSummary?.aggregates?.totalItems ?? 0;
  const earningsItems = Number((earningsSummary as any)?.totalItems ?? 0);
  const combinedPeriodItemsRaw = serverPeriodTotalItems + totalItems;
  const combinedPeriodItems =
    isJeniffer && combinedPeriodItemsRaw <= 0 && earningsItems > 0
      ? earningsItems
      : combinedPeriodItemsRaw;
  // receipts: server may provide counts per payment method in paymentStats
  const serverPeriodReceipts =
    Number((serverPeriodSummary?.aggregates as any)?.totalReceipts ?? 0);
  const serverVisibleReceipts =
    Number((serverPeriodSummary?.aggregates as any)?.visibleReceipts ?? serverPeriodReceipts);
  const earningsReceipts = Number((earningsSummary as any)?.totalReceipts ?? 0);
  const combinedPeriodReceiptsRaw = serverPeriodReceipts + totalReceipts;
  const combinedVisibleReceiptsRaw = serverVisibleReceipts + totalReceipts;
  const combinedPeriodReceipts =
    isJeniffer && combinedPeriodReceiptsRaw <= 0 && earningsReceipts > 0
      ? earningsReceipts
      : combinedPeriodReceiptsRaw;
  const combinedVisibleReceipts =
    isJeniffer && combinedVisibleReceiptsRaw <= 0 && earningsReceipts > 0
      ? earningsReceipts
      : combinedVisibleReceiptsRaw;
  const serverPeriodReceiptRows = (serverPeriodSummary?.aggregates as any)?.totalReceiptRows ?? 0;
  const combinedPeriodReceiptRows = serverPeriodReceiptRows + totalReceiptRows;
  const isBrendahLegacyProfile = currentUserEmail === BRENDAH_EMAIL;

  const commissionSummary = useMemo(
    () => getCommissionSummaryForSales(combinedPeriodSales),
    [combinedPeriodSales],
  );
  // Prefer server-provided canonical commission for accuracy; fall back to
  // earnings summary (Jeniffer override) or local commission calculator.
  const serverCommission =
    Number(serverPeriodSummary?.aggregates?.commission?.commission ?? periodSummary?.aggregates?.commission?.commission ?? 0);

  const preferredEarningsCommission =
    isJeniffer
      ? Number(earningsSummary?.salesCommission ?? 0)
      : Number(earningsSummary?.commission ?? 0);

  const commissionKes =
    isJeniffer && preferredEarningsCommission >= 0
      ? preferredEarningsCommission
      : serverCommission > 0
      ? serverCommission
      : preferredEarningsCommission > 0
      ? preferredEarningsCommission
      : commissionSummary.commission;
  const previewCommissionKes = isBrendahLegacyProfile
    ? Math.max(
        0,
        commissionKes +
          productActivityPreview.commission.total -
          (productActivity?.periodTotals.commission.total ?? 0),
      )
    : commissionKes;
  const nextTarget = commissionSummary.nextTarget;
  const periodLabel =
    periodSummary?.period.label ??
    serverPeriodSummary?.period.label ??
    selectedPeriod.label ??
    "Loading current period\u2026";
  const displayedVisibleSalesKes = combinedVisibleSales;
  const displayedRecognizedSalesKes = combinedPeriodSales;
  const displayedItems = combinedPeriodItems;
  const displayedVisibleReceipts = combinedVisibleReceipts;
  const displayedRecognizedReceipts = combinedPeriodReceipts;

  const serverCommissionBreakdown =
    (serverPeriodSummary?.aggregates as any)?.commissionBreakdown ?? (periodSummary?.aggregates as any)?.commissionBreakdown ?? null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    const errors: string[] = [];

    receipts.forEach((r, i) => {
      if (!r.receiptNumber || r.receiptNumber.trim() === "")
        errors.push(`Receipt ${i + 1}: missing receipt number`);
      if (r.sellingTotal === "" || Number.isNaN(Number(r.sellingTotal)))
        errors.push(`Receipt ${i + 1}: invalid selling total`);
      if (!r.paymentMethod)
        errors.push(`Receipt ${i + 1}: missing payment method`);
      r.items.forEach((it, j) => {
        if (!it.productName || it.productName.trim() === "")
          errors.push(
            `Receipt ${i + 1}, item ${j + 1}: missing product name`,
          );
        if (it.buyingPrice === "" || Number.isNaN(Number(it.buyingPrice)))
          errors.push(
            `Receipt ${i + 1}, item ${j + 1}: invalid buying price`,
          );
      });
    });

    if (!isBrendahLegacyProfile) {
      (config.textFields || []).forEach((f) => {
        const raw = form.fields[f.key];
        if (!raw || String(raw).trim() === "") errors.push(`${f.key}: required`);
      });
      (config.numericFields || []).forEach((f) => {
        const raw = form.fields[f.key];
        if (
          raw === "" ||
          raw === null ||
          raw === undefined ||
          Number.isNaN(Number(raw))
        )
          errors.push(`${f.key}: required numeric`);
      });
    }

    if (errors.length > 0) {
      showToast(errors.slice(0, 5).join("; "), "error");
      setSubmitting(false);
      return;
    }

    try {
      const yesNo: Record<string, boolean> = {};
      const numeric: Record<string, number> = {};
      const text: Record<string, string> = {};
      Object.entries(marketingFieldTypes).forEach(([key, type]) => {
        const raw = form.fields[key];
        if (type === "yesno") yesNo[key] = Boolean(raw);
        else if (type === "numeric") numeric[key] = Number(raw || 0);
        else text[key] = typeof raw === "string" ? raw : "";
      });
      if (isBrendahLegacyProfile) {
        brendahLegacyFieldEntries.forEach(([key, type]) => {
          const raw = form.fields[key];
          if (type === "yesno") yesNo[key] = Boolean(raw);
          else if (type === "numeric") numeric[key] = Number(raw || 0);
          else text[key] = typeof raw === "string" ? raw : "";
        });
      }

      const payload = {
        date: form.date,
        dayOfWeek: form.dayOfWeek,
        receipts: receipts.map((r) => ({
          receiptNumber: r.receiptNumber,
          sellingTotal:
            r.sellingTotal === "" ? 0 : Math.max(0, Number(r.sellingTotal)),
          paymentMethod: r.paymentMethod,
          items: r.items.map((it) => ({
            productName: it.productName.trim(),
            buyingPrice:
              it.buyingPrice === "" ? 0 : Math.max(0, Number(it.buyingPrice)),
          })),
        })),
        yesNo,
        numeric,
        text,
        weeklyMeetingAttended,
        weeklyVideoShootParticipated,
        weeklyVideoCount: weeklyVideoCount ? Number(weeklyVideoCount) : 0,
      };

      const imp = impersonateIdFromWindow();
      const url = imp
        ? `/api/marketing/daily?impersonateId=${encodeURIComponent(imp)}`
        : "/api/marketing/daily";
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        showToast("Marketing daily tracker submitted", "success");
        setForm(defaultFormState());
        setReceipts([]);
        setWeeklyMeetingAttended(false);
        setWeeklyVideoShootParticipated(false);
        setWeeklyVideoCount("");
        const data = await res.json().catch(() => null);
        if (data?.periodSummary) {
          // Use authoritative receipt counts returned by the server so Quick
          // stats show exact MPESA/CASH/total receipts immediately after submit.
          const next = {
            period: {
              key: "",
              label: data.periodSummary.periodLabel,
              start: "",
              end: "",
            },
            aggregates: {
              totalSales: data.periodSummary.periodSales ?? 0,
              totalItems: data.periodSummary.totalItems ?? 0,
              paymentStats: {
                totalSalesMpesa: data.periodSummary.mpesaTotal ?? 0,
                totalSalesCash: data.periodSummary.cashTotal ?? 0,
                countMpesaReceipts: data.periodSummary.countMpesaReceipts ?? 0,
                countCashReceipts: data.periodSummary.countCashReceipts ?? 0,
              },
              commission: {
                commission: data.periodSummary.commission ?? 0,
              },
            },
          };
          // show the panel briefly
          setPeriodSummary(next);
          // also update the background authoritative summary used by Quick stats
          setServerPeriodSummary(next);
        }
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.error || "Failed to submit entry", "error");
      }
    } catch (err: unknown) {
      showToast(
        err instanceof Error ? err.message : "Failed to submit entry",
        "error",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const renderLegacyBooleanButton = (key: string, label: string) => (
    <button
      type="button"
      key={key}
      onClick={() => updateField(key, !Boolean(form.fields[key]))}
      className={pillClass(Boolean(form.fields[key]))}
    >
      {label}
    </button>
  );

  const renderLegacyNumberField = (key: string, label: string) => (
    <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_160px] md:items-center" key={key}>
      <label className="text-base text-slate-100">{label}</label>
      <Input
        type="number"
        min={0}
        value={String(form.fields[key] ?? "")}
        onChange={(e) => updateField(key, e.target.value)}
        className="w-full rounded-3xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-right text-slate-100"
      />
    </div>
  );

  const renderAutomaticProductActivity = () => {
    const emptyActivity = {
      uploaded: 0,
      edited: 0,
      copied: 0,
      commission: { newProducts: 0, editedProducts: 0, copiedProducts: 0, total: 0 },
    };
    const daily = productActivity?.website?.daily ?? productActivity?.daily ?? emptyActivity;
    const periodTotals = productActivity?.website?.periodTotals ?? daily;
    const metrics = [
      { label: "Products uploaded", daily: daily.uploaded, period: periodTotals.uploaded },
      { label: "Products edited", daily: daily.edited, period: periodTotals.edited },
      { label: "Products copied", daily: daily.copied, period: periodTotals.copied },
    ];

    return (
      <Card className="border-emerald-400/20 bg-[linear-gradient(135deg,rgba(16,185,129,.12),rgba(15,23,42,.88)_48%,rgba(2,6,23,.96))] shadow-xl shadow-black/20">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">Automatically calculated</div>
            <h2 className="mt-2 text-2xl font-semibold text-slate-100">Product &amp; stock management</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              Website catalogue products created or edited in the product desk are already counted. No manual entry is required.
            </p>
          </div>
          <Link
            href={withImpersonateId("/marketing/products", trackerImpersonateId)}
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-400/15"
          >
            Manage products
          </Link>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {metrics.map((metric) => (
            <div key={metric.label} className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
              <div className="text-xs uppercase tracking-[0.16em] text-slate-400">{metric.label}</div>
              <div className="mt-2 text-3xl font-semibold text-white">{productActivityLoading ? "..." : metric.daily}</div>
              <div className="mt-1 text-xs text-slate-500">{metric.period} this trading period</div>
            </div>
          ))}
        </div>

        <div className="mt-3 flex flex-col gap-2 rounded-2xl border border-amber-300/15 bg-amber-300/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-sm text-slate-300">Product activity commission for this trading period</span>
          <span className="text-lg font-semibold text-amber-200">{formatKES(periodTotals.commission.total)}</span>
        </div>
      </Card>
    );
  };

  const renderManualMarketplaceProductActivity = () => {
    const emptyActivity: ProductActivitySummary = {
      uploaded: 0,
      edited: 0,
      copied: 0,
      commission: { newProducts: 0, editedProducts: 0, copiedProducts: 0, total: 0 },
    };
    const savedDaily = productActivity?.marketplaces?.daily;
    const periodTotals = productActivity?.marketplaces?.periodTotals;
    const marketplaces = [
      {
        key: "jumia",
        label: "Jumia",
        fields: {
          uploaded: "jumiaProductsUploaded",
          edited: "jumiaProductsEdited",
          copied: "jumiaProductsCopied",
        },
        daily: savedDaily?.jumia ?? emptyActivity,
        period: periodTotals?.jumia ?? emptyActivity,
      },
      {
        key: "kilimall",
        label: "Kilimall",
        fields: {
          uploaded: "kilimallProductsUploaded",
          edited: "kilimallProductsEdited",
          copied: "kilimallProductsCopied",
        },
        daily: savedDaily?.kilimall ?? emptyActivity,
        period: periodTotals?.kilimall ?? emptyActivity,
      },
    ] as const;

    return (
      <Card className="border-amber-400/20 bg-[linear-gradient(135deg,rgba(245,158,11,.10),rgba(15,23,42,.9)_48%,rgba(2,6,23,.96))] shadow-xl shadow-black/20">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">
            Manually recorded
          </div>
          <h2 className="mt-2 text-2xl font-semibold text-slate-100">Marketplace product uploads</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Record products uploaded, edited, or copied directly on Jumia and Kilimall. Quick stats update as you type; save when the figures are correct.
          </p>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          {marketplaces.map((marketplace) => (
            <section key={marketplace.key} className="rounded-3xl border border-white/10 bg-slate-950/55 p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-white">{marketplace.label}</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Saved today: {marketplace.daily.uploaded} uploaded, {marketplace.daily.edited} edited, {marketplace.daily.copied} copied
                  </p>
                </div>
                <span className="rounded-full border border-amber-300/20 bg-amber-300/5 px-3 py-1 text-xs text-amber-200">
                  {marketplace.period.uploaded + marketplace.period.edited + marketplace.period.copied} this period
                </span>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {([
                  ["uploaded", "Uploaded"],
                  ["edited", "Edited"],
                  ["copied", "Copied"],
                ] as const).map(([activity, label]) => (
                  <label key={activity} className="space-y-2">
                    <span className="text-xs uppercase tracking-[0.16em] text-slate-400">{label}</span>
                    <Input
                      type="number"
                      min={0}
                      step={1}
                      value={String(form.fields[marketplace.fields[activity]] ?? "")}
                      onChange={(event) => updateMarketplaceField(marketplace.fields[activity], event.target.value)}
                      className="w-full rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-lg font-semibold text-slate-100"
                    />
                  </label>
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-4 flex flex-col gap-4 rounded-2xl border border-amber-300/15 bg-amber-300/5 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm text-slate-200">
              Current entry: {marketplaceDraft.total.uploaded} uploaded · {marketplaceDraft.total.edited} edited · {marketplaceDraft.total.copied} copied
            </div>
            <div className="mt-1 text-xs text-slate-400">
              Saved this period: {(periodTotals?.total.uploaded ?? 0)} uploaded · {(periodTotals?.total.edited ?? 0)} edited · {(periodTotals?.total.copied ?? 0)} copied
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:items-end">
            <span className="text-sm font-semibold text-amber-100">
              Preview commission {formatKES(productActivityPreview.commission.total)}
            </span>
            <Button
              type="button"
              onClick={() => void handleSaveMarketplaceActivity()}
              disabled={marketplaceSaving || !marketplaceDraftDirty}
              className="min-h-11 rounded-full bg-amber-400 px-6 font-semibold text-slate-950 hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {marketplaceSaving ? "Saving..." : marketplaceDraftDirty ? "Save marketplace activity" : "Saved"}
            </Button>
          </div>
        </div>
      </Card>
    );
  };

  const renderLegacyTextarea = (key: string, label: string, placeholder: string) => (
    <div className="space-y-3" key={key}>
      <label className="text-xs uppercase tracking-[0.2em] text-slate-400">{label}</label>
      <Textarea
        value={String(form.fields[key] ?? "")}
        onChange={(e) => updateField(key, e.target.value)}
        placeholder={placeholder}
        rows={4}
        className="w-full rounded-3xl border border-slate-800 bg-slate-950/80 px-4 py-4 text-slate-100"
      />
    </div>
  );

  const renderBrendahLegacyChecklist = () => {
    switch (form.dayOfWeek) {
      case "Monday":
        return (
          <div className="space-y-6">
            <Card className="border-slate-800 bg-slate-900/60 shadow-xl shadow-black/20">
              <h2 className="text-2xl font-semibold text-slate-100">Walk-ins & shop neatness</h2>
              <div className="mt-6 space-y-6">
                {renderLegacyNumberField("walkInsPurchased", "Walk-ins who purchased")}
                <div className="space-y-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Shop condition</p>
                  <div className="flex flex-wrap gap-3">
                    {renderLegacyBooleanButton("shopCleaned", "Shop cleaned")}
                    {renderLegacyBooleanButton("shopWellArranged", "Shop neatness")}
                    {renderLegacyBooleanButton("displayWellLabeled", "Display labeled")}
                  </div>
                </div>
              </div>
            </Card>

            <Card className="border-slate-800 bg-slate-900/60 shadow-xl shadow-black/20">
              <h2 className="text-2xl font-semibold text-slate-100">Customer & communications</h2>
              <div className="mt-6 flex flex-wrap gap-3">
                {renderLegacyBooleanButton("repliedFbComments", "Replied to FB comments")}
                {renderLegacyBooleanButton("repliedFbDms", "Replied to FB DMs")}
                {renderLegacyBooleanButton("repliedIgComments", "Replied to IG comments")}
                {renderLegacyBooleanButton("repliedIgDms", "Replied to IG DMs")}
                {renderLegacyBooleanButton("clearedFbInbox", "Cleared FB inbox")}
                {renderLegacyBooleanButton("clearedIgInbox", "Cleared IG inbox")}
              </div>
            </Card>

            <Card className="border-slate-800 bg-slate-900/60 shadow-xl shadow-black/20">
              <h2 className="text-2xl font-semibold text-slate-100">Marketplace review</h2>
              <div className="mt-6 flex flex-wrap gap-3">
                {renderLegacyBooleanButton("stockChecked", "Stock checked")}
                {renderLegacyBooleanButton("pricingConfirmed", "Pricing confirmed")}
                {renderLegacyBooleanButton("competitorsReviewed", "Competitors reviewed")}
                {renderLegacyBooleanButton("outOfStockReview", "Out of stock review")}
              </div>
            </Card>
          </div>
        );
      case "Tuesday":
        return (
          <Card className="border-slate-800 bg-slate-900/60 shadow-xl shadow-black/20">
            <h2 className="text-2xl font-semibold text-slate-100">Tuesday – promo content</h2>
            <p className="mt-3 text-slate-400">
              Post product highlights or promotional videos and record at least one demo video for future content scheduling.
            </p>
            <div className="mt-6 space-y-6">
              {renderLegacyNumberField("promoVideosPosted", "Promo videos / highlights posted")}
              {renderLegacyNumberField("productDemoVideosRecorded", "Product demo videos recorded")}
            </div>
          </Card>
        );
      case "Wednesday":
        return (
          <div className="space-y-6">
            <Card className="border-slate-800 bg-slate-900/60 shadow-xl shadow-black/20">
              <h2 className="text-2xl font-semibold text-slate-100">Live session follow-ups</h2>
              <p className="mt-3 text-slate-400">Conduct timely follow-ups on leads generated from the live session.</p>
              <div className="mt-6">
                {renderLegacyTextarea(
                  "wednesdayFollowUpNotes",
                  "Notes on follow-ups, customers contacted, next actions",
                  "Notes on follow-ups, customers contacted, next actions...",
                )}
              </div>
            </Card>
            <Card className="border-slate-800 bg-slate-900/60 shadow-xl shadow-black/20">
              <h2 className="text-2xl font-semibold text-slate-100">Content engagement tracking</h2>
              <p className="mt-3 text-slate-400">
                Track engagement data to identify top-performing content, views, comments, saves, and shares.
              </p>
              <div className="mt-6">
                {renderLegacyTextarea(
                  "wednesdayEngagementNotes",
                  "Top-performing posts, engagement numbers, lessons learnt",
                  "Top-performing posts, engagement numbers, lessons learnt...",
                )}
              </div>
            </Card>
          </div>
        );
      case "Thursday":
        return (
          <div className="space-y-6">
            <Card className="border-slate-800 bg-slate-900/60 shadow-xl shadow-black/20">
              <h2 className="text-2xl font-semibold text-slate-100">Walk-ins & shop neatness</h2>
              <div className="mt-6 space-y-6">
                {renderLegacyNumberField("walkInsPurchased", "Walk-ins who purchased")}
                <div className="space-y-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Shop condition</p>
                  <div className="flex flex-wrap gap-3">
                    {renderLegacyBooleanButton("shopCleaned", "Shop cleaned")}
                    {renderLegacyBooleanButton("shopWellArranged", "Shop neatness")}
                    {renderLegacyBooleanButton("displayWellLabeled", "Display labeled")}
                  </div>
                </div>
              </div>
            </Card>

            <Card className="border-slate-800 bg-slate-900/60 shadow-xl shadow-black/20">
              <h2 className="text-2xl font-semibold text-slate-100">Customer & communications</h2>
              <div className="mt-6 flex flex-wrap gap-3">
                {renderLegacyBooleanButton("repliedFbComments", "Replied to FB comments")}
                {renderLegacyBooleanButton("repliedFbDms", "Replied to FB DMs")}
                {renderLegacyBooleanButton("repliedIgComments", "Replied to IG comments")}
                {renderLegacyBooleanButton("repliedIgDms", "Replied to IG DMs")}
                {renderLegacyBooleanButton("clearedFbInbox", "Cleared FB inbox")}
                {renderLegacyBooleanButton("clearedIgInbox", "Cleared IG inbox")}
              </div>
            </Card>

            <Card className="border-slate-800 bg-slate-900/60 shadow-xl shadow-black/20">
              <h2 className="text-2xl font-semibold text-slate-100">Marketplace review</h2>
              <div className="mt-6 flex flex-wrap gap-3">
                {renderLegacyBooleanButton("stockChecked", "Stock checked")}
                {renderLegacyBooleanButton("pricingConfirmed", "Pricing confirmed")}
                {renderLegacyBooleanButton("competitorsReviewed", "Competitors reviewed")}
                {renderLegacyBooleanButton("outOfStockReview", "Out of stock review")}
              </div>
            </Card>

            <Card className="border-slate-800 bg-slate-900/60 shadow-xl shadow-black/20">
              <h2 className="text-2xl font-semibold text-slate-100">Weekly marketing activities (Thursday)</h2>
              <div className="mt-6 space-y-6">
                <div className="space-y-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Weekly meeting</p>
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setWeeklyMeetingAttended(true);
                        updateField("weeklyMeetingAttended", true);
                      }}
                      className={pillClass(weeklyMeetingAttended)}
                    >
                      Attended weekly marketing meeting
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setWeeklyMeetingAttended(false);
                        updateField("weeklyMeetingAttended", false);
                      }}
                      className={pillClass(!weeklyMeetingAttended)}
                    >
                      Did not attend
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Video shoot</p>
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setWeeklyVideoShootParticipated(true);
                        updateField("weeklyVideoShootParticipated", true);
                      }}
                      className={pillClass(weeklyVideoShootParticipated)}
                    >
                      Participated in weekly video shoot
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setWeeklyVideoShootParticipated(false);
                        updateField("weeklyVideoShootParticipated", false);
                      }}
                      className={pillClass(!weeklyVideoShootParticipated)}
                    >
                      Did not participate
                    </button>
                  </div>
                </div>

                {renderLegacyNumberField("weeklyVideoCount", "Number of videos participated in (shooting)")}
              </div>
            </Card>
          </div>
        );
      case "Friday":
        return (
          <div className="space-y-6">
            <Card className="border-slate-800 bg-slate-900/60 shadow-xl shadow-black/20">
              <h2 className="text-2xl font-semibold text-slate-100">Marketplace review</h2>
              <div className="mt-6 flex flex-wrap gap-3">
                {renderLegacyBooleanButton("stockChecked", "Stock checked")}
                {renderLegacyBooleanButton("pricingConfirmed", "Pricing confirmed")}
                {renderLegacyBooleanButton("competitorsReviewed", "Competitors reviewed")}
                {renderLegacyBooleanButton("outOfStockReview", "Out of stock review")}
              </div>
            </Card>

            <Card className="border-slate-800 bg-slate-900/60 shadow-xl shadow-black/20">
              <h2 className="text-2xl font-semibold text-slate-100">Friday – weekend prep & improvements</h2>
              <div className="mt-6 space-y-6">
                {renderLegacyNumberField("fridayPostEngagingVideos", "Post engaging product videos or testimonials")}
                <div className="space-y-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Weekend promotions</p>
                  <div className="flex flex-wrap gap-3">
                    {renderLegacyBooleanButton("fridayPrepareWeekendPromos", "Prepare weekend promotions or schedule future posts")}
                  </div>
                </div>
                {renderLegacyTextarea(
                  "fridayImprovementSuggestions",
                  "Final improvement suggestions for the week (based on competitor activities)",
                  "Improvements, competitor moves, ideas for next week...",
                )}
              </div>
            </Card>
          </div>
        );
      case "Saturday":
        return (
          <div className="space-y-6">
            <Card className="border-slate-800 bg-slate-900/60 shadow-xl shadow-black/20">
              <h2 className="text-2xl font-semibold text-slate-100">Live session</h2>
              <div className="mt-6 grid gap-6">
                {renderLegacyNumberField("liveSessionsCount", "Live sessions hosted")}
                {renderLegacyNumberField("liveSessionsEstimatedViewers", "Viewers (estimated)")}
                {renderLegacyNumberField("liveSessionDurationMinutes", "Duration (minutes)")}
                {renderLegacyTextarea(
                  "liveSessionPlatform",
                  "Platform used (TikTok / IG / FB / YT)",
                  "Platform used (TikTok / IG / FB / YT)",
                )}
              </div>
            </Card>

            <Card className="border-slate-800 bg-slate-900/60 shadow-xl shadow-black/20">
              <h2 className="text-2xl font-semibold text-slate-100">Weekly performance summary</h2>
              <p className="mt-3 text-slate-400">
                Submit weekly performance summary including performance suggestions, improvement ideas, complaints or any issues that need management attention.
              </p>
              <div className="mt-6 space-y-6">
                {renderLegacyTextarea(
                  "weeklyPerformanceLiveHighlights",
                  "Live session highlights / key learnings",
                  "Live session highlights / key learnings",
                )}
                {renderLegacyTextarea(
                  "weeklyPerformanceSummaryNotes",
                  "Weekly performance summary & issues needing management attention",
                  "Weekly performance summary & issues needing management attention",
                )}
              </div>
            </Card>
          </div>
        );
      default:
        return (
          <Card className="border-slate-800 bg-slate-900/60 shadow-xl shadow-black/20">
            <h2 className="text-2xl font-semibold text-slate-100">{form.dayOfWeek} checklist</h2>
            <p className="mt-3 text-slate-400">This day is using the standard marketing checklist.</p>
          </Card>
        );
    }
  };

  return (
      <form
        onSubmit={handleSubmit}
        className="flex w-full flex-col gap-6 text-slate-100"
      >
        <div className="flex flex-col gap-3 rounded-3xl border border-slate-800 bg-slate-950/70 px-6 py-4 md:px-8 md:py-5">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Statistics period</p>
              <p className="text-lg font-semibold text-slate-100">{selectedPeriod.label}</p>
              {selectedPeriodKey !== currentPeriod.key && (
                <p className="text-xs text-amber-300">Showing archived period.</p>
              )}
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <PeriodSwitcher
                currentPeriod={currentPeriod}
                selectedPeriod={selectedPeriod}
                onSelectPeriod={setSelectedPeriod}
              />
            </div>
          </div>
        </div>

        {periodSummary && (
          <Card className="border-emerald-700/60 bg-emerald-900/20 text-emerald-100 shadow-xl shadow-emerald-900/30">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-emerald-200">
                    Summary so far for this trading period
                  </p>
                  <h2 className="text-lg font-semibold">
                    {periodSummary.period.label}
                  </h2>
                  <p className="text-xs text-emerald-200">
                    {periodSummary.period.label}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setPeriodSummary(null)}
                >
                  Hide
                </Button>
              </div>
              <div className="grid gap-3 text-sm md:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-emerald-700/40 bg-emerald-900/30 p-3">
                  <div className="text-xs uppercase tracking-wide text-emerald-200">
                    Period sales
                  </div>
                  <div className="text-xl font-semibold text-white">
                    KES {periodSummary.aggregates.totalSales.toLocaleString()}
                  </div>
                </div>
                <div className="rounded-xl border border-emerald-700/40 bg-emerald-900/30 p-3">
                  <div className="text-xs uppercase tracking-wide text-emerald-200">
                    Total items
                  </div>
                  <div className="text-xl font-semibold text-white">
                    {periodSummary.aggregates.totalItems.toLocaleString()}
                  </div>
                </div>
                <div className="rounded-xl border border-emerald-700/40 bg-emerald-900/30 p-3">
                  <div className="text-xs uppercase tracking-wide text-emerald-200">
                    MPESA vs Cash
                  </div>
                  <div className="text-sm">
                    MPESA KES{" "}
                    {periodSummary.aggregates.paymentStats.totalSalesMpesa.toLocaleString()}
                  </div>
                  <div className="text-sm">
                    Cash KES{" "}
                    {periodSummary.aggregates.paymentStats.totalSalesCash.toLocaleString()}
                  </div>
                </div>
                <div className="rounded-xl border border-emerald-700/40 bg-emerald-900/30 p-3">
                  <div className="text-xs uppercase tracking-wide text-emerald-200">
                    Commission so far
                  </div>
                  <div className="text-xl font-semibold text-white">
                    KES{" "}
                    {periodSummary.aggregates.commission.commission.toLocaleString()}
                  </div>
                </div>
              </div>
              <p className="text-xs text-emerald-200">
                This panel auto-hides after 5 minutes. Commission shown is
                cumulative for the current trading period.
              </p>
            </div>
          </Card>
        )}

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(320px,3fr)] 2xl:grid-cols-[minmax(0,7fr)_minmax(360px,3fr)]">
          <div className="min-w-0 space-y-6">
            <Card className="border-slate-800 bg-slate-900/60 shadow-xl shadow-black/20">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Reporting day</p>
                  <h2 className="text-xl font-semibold text-slate-100">
                    {config.day} checklist
                  </h2>
                  <p className="text-sm text-slate-400">
                    {isBrendahLegacyProfile
                      ? "Pick the reporting date, confirm the day, then complete the daily checklist on the left."
                      : "Choose the date, confirm the auto-loaded day, then complete the checklist on the left."}
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:min-w-[360px] lg:max-w-[440px]">
                  <label className="space-y-2 text-xs uppercase tracking-wide text-slate-400">
                    Date
                    <Input
                      type="date"
                      value={form.date}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, date: e.target.value }))
                      }
                      className="w-full rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-slate-100"
                    />
                  </label>
                  <label className="space-y-2 text-xs uppercase tracking-wide text-slate-400">
                    Day of week
                    <select
                      value={form.dayOfWeek}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          dayOfWeek: e.target.value as DayName,
                        }))
                      }
                      className="w-full rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-slate-100"
                    >
                      {dayOptions.map((day) => (
                        <option key={day} value={day}>
                          {day}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
            </Card>

            {isBrendahLegacyProfile ? (
              <div className="space-y-6">
                {renderAutomaticProductActivity()}
                {renderManualMarketplaceProductActivity()}
                {renderBrendahLegacyChecklist()}
              </div>
            ) : (
              <Card className="border-slate-800 bg-slate-900/60 shadow-xl shadow-black/20">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-400">Day checklist</p>
                    <h2 className="text-xl font-semibold">{config.day}</h2>
                  </div>
                  <div className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-200">
                    Auto-loaded from selected day
                  </div>
                </div>

                <div className="space-y-6">
                  {groupedYesNo.map(([section, fields]) => (
                    <div key={section} className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-slate-200">{section}</h3>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {fields.map((f) => (
                          <button
                            type="button"
                            key={f.key}
                            onClick={() =>
                              updateField(f.key, !Boolean(form.fields[f.key]))
                            }
                            className={pillClass(Boolean(form.fields[f.key]))}
                          >
                            {f.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}

                  {form.dayOfWeek === "Thursday" && (
                    <section className="mt-6 rounded-xl border border-red-500/30 p-4">
                      <h3 className="mb-3 text-sm font-semibold">
                        Weekly Marketing Activities (Thursday)
                      </h3>

                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <div className="w-full">
                            <label className="text-xs uppercase tracking-wide text-slate-400">
                              Weekly meeting
                            </label>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setWeeklyMeetingAttended(true);
                                  updateField("weeklyMeetingAttended", true);
                                }}
                                className={pillClass(weeklyMeetingAttended)}
                              >
                                Attended weekly marketing meeting
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setWeeklyMeetingAttended(false);
                                  updateField("weeklyMeetingAttended", false);
                                }}
                                className={pillClass(!weeklyMeetingAttended)}
                              >
                                Did not attend
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="w-full">
                            <label className="text-xs uppercase tracking-wide text-slate-400">
                              Video shoot
                            </label>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setWeeklyVideoShootParticipated(true);
                                  updateField("weeklyVideoShootParticipated", true);
                                }}
                                className={pillClass(weeklyVideoShootParticipated)}
                              >
                                Participated in weekly video shoot
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setWeeklyVideoShootParticipated(false);
                                  updateField("weeklyVideoShootParticipated", false);
                                }}
                                className={pillClass(!weeklyVideoShootParticipated)}
                              >
                                Did not participate
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="w-full">
                            <label className="text-xs uppercase tracking-wide text-slate-400">
                              Number of videos participated in (shooting)
                            </label>
                            <div className="mt-2">
                              <Input
                                type="number"
                                min={0}
                                value={String(weeklyVideoCount)}
                                onChange={(e) => {
                                  const v =
                                    e.target.value === ""
                                      ? ""
                                      : Math.max(0, Number(e.target.value));
                                  setWeeklyVideoCount(
                                    v === "" ? "" : Number(v),
                                  );
                                  updateField(
                                    "weeklyVideoCount",
                                    v === "" ? "" : Number(v),
                                  );
                                }}
                                className="w-28 rounded-full border border-slate-800 bg-slate-950/80 px-3 py-2 text-center text-slate-100"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </section>
                  )}

                  {(config.numericFields || []).length > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold text-slate-200">
                        Numeric checks
                      </h3>
                      <div className="grid gap-3 md:grid-cols-2">
                        {(config.numericFields || []).map((f) => (
                          <div key={f.key} className="space-y-2">
                            <label className="text-xs uppercase tracking-wide text-slate-400">
                              {f.label}
                            </label>
                            <Input
                              type="number"
                              min={f.min}
                              value={String(form.fields[f.key] ?? "")}
                              onChange={(e) => updateField(f.key, e.target.value)}
                              className="w-full rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-slate-100"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {(config.textFields || []).length > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold text-slate-200">Notes</h3>
                      <div className="grid gap-3">
                        {(config.textFields || []).map((f) => (
                          <div key={f.key} className="space-y-2">
                            <label className="text-xs uppercase tracking-wide text-slate-400">
                              {f.label}
                            </label>
                            <Textarea
                              value={String(form.fields[f.key] ?? "")}
                              onChange={(e) => updateField(f.key, e.target.value)}
                              placeholder={f.placeholder}
                              rows={3}
                              className="w-full rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-slate-100"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            )}
          </div>

          <aside className="space-y-6 lg:sticky lg:top-6">
            {isBrendahLegacyProfile ? (
              <>
                <BrendahQuickStatsCard
                  periodLabel={periodLabel}
                  receipts={displayedRecognizedReceipts}
                  salesKes={displayedRecognizedSalesKes}
                  newProducts={productActivity ? productActivityPreview.uploaded : Number((earningsSummary as any)?.totalNewProducts ?? 0)}
                  editedProducts={productActivity ? productActivityPreview.edited : Number((earningsSummary as any)?.totalEditedProducts ?? 0)}
                  copiedProducts={productActivity ? productActivityPreview.copied : Number((earningsSummary as any)?.totalCopiedProducts ?? 0)}
                  commissionKes={previewCommissionKes}
                />
                <BrendahLegacyEarningsCard
                  summary={earningsSummary}
                  downloadHref={withImpersonateId(`/api/attendant/payslip?periodKey=${encodeURIComponent(selectedPeriod.key)}`, trackerImpersonateId)}
                />
              </>
            ) : (
              <>
                <StatsCard
                  periodLabel={periodLabel}
                  receipts={displayedVisibleReceipts}
                  receiptRows={combinedPeriodReceiptRows}
                  visibleSalesKes={displayedVisibleSalesKes}
                  recognizedSalesKes={displayedRecognizedSalesKes}
                  recognizedReceipts={displayedRecognizedReceipts}
                  items={displayedItems}
                  commissionKes={commissionKes}
                  commissionBreakdown={serverCommissionBreakdown}
                  currentSalesForTier={combinedPeriodSales}
                  nextTarget={nextTarget}
                />
                <EarningsCard
                  summary={earningsSummary}
                  downloadHref={withImpersonateId(`/api/attendant/payslip?periodKey=${encodeURIComponent(selectedPeriod.key)}`, trackerImpersonateId)}
                />
              </>
            )}
            
          </aside>
        </div>

        <div className="flex items-center justify-end gap-3 rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
          <Button
            type="reset"
            variant="secondary"
            onClick={() => setForm(defaultFormState())}
            className="px-5"
          >
            {isBrendahLegacyProfile ? "Reset day" : "Reset"}
          </Button>
          <Button
            type="submit"
            variant="primary"
            className="bg-emerald-500 px-5 text-black hover:brightness-95"
            disabled={submitting}
          >
            {submitting ? "Submitting..." : "Submit report"}
          </Button>
        </div>
      </form>
  );
}
