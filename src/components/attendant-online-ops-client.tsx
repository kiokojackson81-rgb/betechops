"use client";

import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import Card from "@/app/_components/Card";
import Button from "@/app/_components/Button";
import ReceiptsEditor from "@/app/_components/ReceiptsEditor";
import { showToast } from "@/lib/ui/toast";
import QuickStatsCard from "@/components/QuickStatsCard";
import EarningsCard from "@/app/_components/EarningsCard";
import PayrollTableClient from "@/app/admin/payroll/PayrollTableClient";
import type { PayrollRow } from "@/app/admin/payroll/types";
import { mapPayrollToEarningsSummary as mapToEarnings, mapPayrollToPayrollRow as mapToPayrollRow } from "@/lib/payrollMapping";

type PaymentMethod = "MPESA" | "CASH" | "";

type ReceiptStatsRow = {
  id: string;
  total?: number | null;
  items?: Array<{ buyingPrice?: number | "" | null; productName?: string | null }>;
};

type OnlinePlatformSummary = {
  key: string;
  name: string;
  orders: number;
  sales: number;
  commission: number;
};

type OnlineSummaryResponse = {
  period: { key: string; label: string; start: string; end: string };
  totals: { orders: number; sales: number; commission: number; marketplaceSales?: number; remainingToNextTier?: number };
  platforms: OnlinePlatformSummary[];
};

type ReceiptItem = { id: string; productName: string; buyingPrice: number | "" };
type ReceiptRow = {
  id: string;
  receiptNumber: string;
  sellingTotal: number | "";
  paymentMethod: PaymentMethod;
  items: ReceiptItem[];
};

type ShopSalesRow = {
  id: string;
  name: string;
  platform: string;
  country: string;
  currency: string;
  status: string;
  codeLabel: string;
  handlerName: string;
  handlerRole: string;
  periodLabel: string;
  totalSales: number;
};

type WeeklyShopEarningsRow = {
  shopId: string;
  shopName: string;
  platform: string;
  weekLabel: string;
  weekStart: string;
  weekEnd: string;
  sales: number;
  commission: number;
  orders?: number;
};

type WeeklyEarningsResponse = {
  rangeLabel: string;
  totals: { sales: number; commission: number; orders?: number; shops: number };
  rows: WeeklyShopEarningsRow[];
};

type PayrollSummary = {
  periodLabel?: string;
  // possible field names from different endpoints
  salary?: number; // alias for baseSalary
  baseSalary?: number;
  deductions?: number;
  chamaTotal?: number;
  latenessTotal?: number;
  disciplineTotal?: number;
  otherDeductionsTotal?: number;
  bonusTotal?: number;
  commissionTopUpTotal?: number;
  penalties?: number;
  commissionTotal?: number;
  salesCommission?: number;
  directCommission?: number;
  marketplaceCommission?: number;
  totalCommission?: number;
  grossCommission?: number;
  netPay?: number;
  commissionDirect?: number;
  commissionMarketplaceJumia?: number;
  commissionMarketplaceKilimall?: number;
  commissionBreakdown?: unknown | null;
};

type TradingWeek = {
  key: string;
  label: string;
  start: Date;
  end: Date;
};

const MARKETPLACE_ANCHOR_START = new Date("2025-11-24T00:00:00+03:00");

const randomId = () =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

const createItem = (): ReceiptItem => ({ id: randomId(), productName: "", buyingPrice: "" });
const createReceipt = (): ReceiptRow => ({
  id: randomId(),
  receiptNumber: "",
  sellingTotal: "",
  paymentMethod: "",
  items: [createItem()],
});

const formatKES = (value: number | null | undefined) =>
  `KES ${Number(value ?? 0).toLocaleString("en-KE", { maximumFractionDigits: 0 })}`;

const formatNairobiParam = (date: Date, endOfDay = false) => {
  const ymd = date.toLocaleDateString("en-CA", { timeZone: "Africa/Nairobi" });
  return endOfDay ? `${ymd}T23:59:59.999+03:00` : `${ymd}T00:00:00+03:00`;
};

function startOfWeekMonday(date: Date) {
  const copy = new Date(date);
  const day = copy.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diffToMonday);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function endOfWeekSunday(start: Date) {
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

function formatWeekLabel(start: Date, end: Date) {
  const fmt = (value: Date) => value.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
  return `${fmt(start)} - ${fmt(end)}`;
}

const MARKETPLACE_STEP_POINTS = [
  2_000_000,
  3_000_000,
  4_000_000,
  5_000_000,
  6_000_000,
  7_000_000,
  8_000_000,
  9_000_000,
  10_000_000,
];

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

type MarketplaceTierInfo = {
  target: number;
  remaining: number;
  progress: number;
  message: string;
};

function describeMarketplaceTier(sales: number): MarketplaceTierInfo {
  const normalized = Math.max(0, Math.round(sales));

  if (normalized < 500_000) {
    const remaining = 500_000 - normalized;
    return {
      target: 500_000,
      remaining,
      progress: clamp01(normalized / 500_000),
      message: `${formatKES(remaining)} to enter the ladder`,
    };
  }

  if (normalized < 1_000_000) {
    const remaining = 1_000_000 - normalized;
    return {
      target: 1_000_000,
      remaining,
      progress: clamp01((normalized - 500_000) / 500_000),
      message: `${formatKES(remaining)} to finish the 500k–1M band`,
    };
  }

  let previous = 1_000_000;
  for (const point of MARKETPLACE_STEP_POINTS) {
    if (normalized < point) {
      const remaining = point - normalized;
      const progress = clamp01((normalized - previous) / (point - previous));
      return {
        target: point,
        remaining,
        progress,
        message: `${formatKES(remaining)} to reach the ${point / 1_000_000}M tier`,
      };
    }
    previous = point;
  }

  return {
    target: MARKETPLACE_STEP_POINTS[MARKETPLACE_STEP_POINTS.length - 1],
    remaining: 0,
    progress: 1,
    message: "Top tier reached",
  };
}

function buildTradingWeeks(periodStart: Date) {
  const weeks: TradingWeek[] = [];
  for (let i = 0; i < 4; i += 1) {
    const start = new Date(periodStart);
    start.setDate(periodStart.getDate() + i * 7);
    start.setHours(0, 0, 0, 0);
    const end = endOfWeekSunday(start);
    weeks.push({
      key: `${start.toISOString().slice(0, 10)}`,
      label: `Week ${i + 1} (${formatWeekLabel(start, end)})`,
      start,
      end,
    });
  }
  return weeks;
}

function getReceiptsPayrollPeriodFor(date: Date) {
  const d = new Date(date);
  const day = d.getDate();
  const offsetMonth = day >= 25 ? 0 : -1;
  const start = new Date(d.getFullYear(), d.getMonth() + offsetMonth, 25, 0, 0, 0, 0);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 24, 23, 59, 59, 999);
  const label = `${start.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })} - ${end.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}`;
  return { start, end, label, key: `${start.toISOString()}_${end.toISOString()}` };
}

function getMarketplaceTradingPeriodFor(date: Date) {
  const DAY_MS = 24 * 60 * 60 * 1000;
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  const anchor = new Date(MARKETPLACE_ANCHOR_START);
  anchor.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((target.getTime() - anchor.getTime()) / DAY_MS);
  const periodIndex = diffDays >= 0 ? Math.floor(diffDays / 28) : 0;
  const start = new Date(anchor.getTime() + periodIndex * 28 * DAY_MS);
  const end = new Date(start.getTime() + 27 * DAY_MS);
  end.setHours(23, 59, 59, 999);
  const label = `${start.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })} - ${end.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}`;
  return { start, end, label, key: `MP_${periodIndex}` };
}

function pillClass(active: boolean) {
  return [
    "rounded-full border px-3 py-1 text-xs font-medium transition",
    active
      ? "border-emerald-500 bg-emerald-500/10 text-emerald-200"
      : "border-slate-800 bg-slate-950/40 text-slate-300 hover:border-slate-700",
  ].join(" ");
}

type TradingWeekPickerProps = {
  weeks: TradingWeek[];
  value: string;
  onChange: (key: string) => void;
  loading?: boolean;
};

function TradingWeekPicker({ weeks, value, onChange, loading }: TradingWeekPickerProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div>
        <p className="text-xs uppercase tracking-wide text-slate-400">Trading week</p>
        <p className="text-xs text-slate-500">Select which week to view</p>
      </div>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-xs text-slate-100 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
      >
        {weeks.map((week) => (
          <option key={week.key} value={week.key}>
            {week.label}
          </option>
        ))}
      </select>
      {loading && <span className="text-xs text-slate-500">Loading…</span>}
    </div>
  );
}

import AssignedShopsCard from "@/components/AssignedShopsCard";

type WeeklyEarningsPanelProps = {
  weekly: WeeklyEarningsResponse | null;
  loading: boolean;
  weekLabel?: string;
};

function WeeklyEarningsPanel({ weekly, loading, weekLabel }: WeeklyEarningsPanelProps) {
  const rows = weekly?.rows ?? [];
  const totals = weekly?.totals;

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">Weekly earnings</p>
            <p className="text-sm text-slate-200">{weekLabel ?? weekly?.rangeLabel ?? "Preview"}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <MiniKpi label="Shops" value={totals ? totals.shops : "-"} />
            <MiniKpi label="Sales" value={totals ? formatKES(totals.sales) : "-"} />
            <MiniKpi label="Commission" value={totals ? formatKES(totals.commission) : "-"} />
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/70">
        <div className="grid grid-cols-5 gap-2 border-b border-slate-800 bg-slate-900/70 px-4 py-2 text-[11px] uppercase tracking-wide text-slate-400">
          <span className="col-span-2">Shop</span>
          <span className="text-right">Sales</span>
          <span className="text-right">Commission</span>
          <span className="text-right">Channel</span>
        </div>

        {loading && (
          <div className="px-4 py-3 text-sm text-slate-400">Loading weekly earnings…</div>
        )}

        {!loading && rows.length === 0 && (
          <div className="px-4 py-3 text-sm text-slate-400">
            No weekly shop earnings yet. (Add the endpoint or confirm assignments.)
          </div>
        )}

        {rows.map((r) => (
          <div key={`${r.shopId}:${r.weekStart}`} className="grid grid-cols-5 gap-2 px-4 py-3 text-sm">
            <div className="col-span-2">
              <p className="font-semibold text-slate-100">{r.shopName}</p>
              <p className="text-[11px] text-slate-500">{r.weekLabel}</p>
            </div>
            <span className="text-right text-emerald-300">{formatKES(r.sales)}</span>
            <span className="text-right text-slate-200">{formatKES(r.commission)}</span>
            <span className="text-right text-slate-300">{r.platform}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MiniKpi({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/60 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-emerald-300">{value}</p>
    </div>
  );
}

export default function AttendantOnlineOpsClient() {
  const receiptsPeriod = useMemo(() => getReceiptsPayrollPeriodFor(new Date()), []);
  const marketplacePeriod = useMemo(() => getMarketplaceTradingPeriodFor(new Date()), []);
  const tradingWeeks = useMemo(() => buildTradingWeeks(marketplacePeriod.start), [marketplacePeriod.start]);

  const [selectedWeekKey, setSelectedWeekKey] = useState("");
  const selectedWeek = useMemo(
    () => tradingWeeks.find((week) => week.key === selectedWeekKey) ?? tradingWeeks[0] ?? null,
    [selectedWeekKey, tradingWeeks],
  );

  useEffect(() => {
    if (!selectedWeekKey && tradingWeeks[0]?.key) {
      setSelectedWeekKey(tradingWeeks[0].key);
    }
  }, [selectedWeekKey, tradingWeeks]);

  const [tab, setTab] = useState<"overview" | "shops" | "receipts" | "payroll">("overview");
  const [userId, setUserId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  // receipt totals removed (not used in simplified UI)
  const [receiptsEditorRows, setReceiptsEditorRows] = useState<ReceiptRow[]>([createReceipt()]);
  const [shopSalesRows, setShopSalesRows] = useState<ShopSalesRow[]>([]);
  const [shopSalesLoading, setShopSalesLoading] = useState(false);
  const [weeklyEarnings, setWeeklyEarnings] = useState<WeeklyEarningsResponse | null>(null);
  const [weeklyLoading, setWeeklyLoading] = useState(false);

  // Receipt stats & online summary for QuickStats
  const [receiptRows, setReceiptRows] = useState<ReceiptStatsRow[]>([]);
  const [receiptStatsLoading, setReceiptStatsLoading] = useState(false);

  const [onlineSummary, setOnlineSummary] = useState<OnlineSummaryResponse | null>(null);
  const [onlineSummaryLoading, setOnlineSummaryLoading] = useState(false);
  const [payrollSummary, setPayrollSummary] = useState<PayrollSummary | null>(null);
  const [payrollRows, setPayrollRows] = useState<PayrollRow[] | null>(null);
  const [payrollLoading, setPayrollLoading] = useState(false);

  const mapPayrollToEarningsSummary = (p: PayrollSummary | null) => mapToEarnings(p, receiptsCount);

  const mapPayrollToPayrollRow = (p: PayrollSummary | null): PayrollRow => mapToPayrollRow(p, userId);

  const fetchUser = useCallback(async () => {
    try {
      const res = await fetch("/api/attendants/me", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      if (data?.user?.id) setUserId(data.user.id);
    } catch (err) {
      console.warn("[attendant/online-ops] failed to load user", err);
    }
  }, []);

  const loadReceiptStats = useCallback(async () => {
    if (!userId) return;
    setReceiptStatsLoading(true);
    try {
      const params = new URLSearchParams({
        attendantId: userId,
        start: formatNairobiParam(receiptsPeriod.start, false),
        end: formatNairobiParam(receiptsPeriod.end, true),
        issuerOnly: "true",
        includeItems: "true",
        size: "200",
      });

      const res = await fetch(`/api/receipts?${params.toString()}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load receipts for payroll period");
      const data = (await res.json()) as { receipts?: ReceiptStatsRow[] };
      setReceiptRows(Array.isArray(data.receipts) ? data.receipts : []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unable to load receipt totals";
      showToast(msg, "error");
    } finally {
      setReceiptStatsLoading(false);
    }
  }, [userId, receiptsPeriod, userRole]);

  const loadOnlineSummary = useCallback(async () => {
    if (!userId) return;
    setOnlineSummaryLoading(true);
    try {
      const params = new URLSearchParams({
        attendantId: userId,
        start: formatNairobiParam(receiptsPeriod.start, false),
        end: formatNairobiParam(receiptsPeriod.end, true),
      });

      const res = await fetch(`/api/online/summary?${params.toString()}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load online summary for payroll period");
      const data = (await res.json()) as OnlineSummaryResponse;
      setOnlineSummary(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unable to load online totals";
      showToast(msg, "error");
    } finally {
      setOnlineSummaryLoading(false);
    }
  }, [userId, receiptsPeriod]);

  const loadPayrollSummary = useCallback(async () => {
    if (!userId) return;
    setPayrollLoading(true);
    try {
      const params = new URLSearchParams({
        attendantId: userId,
        start: formatNairobiParam(receiptsPeriod.start, false),
        end: formatNairobiParam(receiptsPeriod.end, true),
      });

      setPayrollRows(null);

      // If we're an admin, try the richer admin endpoint which returns many rows
      if (userRole === "ADMIN") {
        const adminRes = await fetch(`/api/admin/payroll/summary?${params.toString()}`, { cache: "no-store" });
        if (adminRes.ok) {
          const adminData = await adminRes.json();
          setPayrollRows(Array.isArray(adminData.rows) ? adminData.rows : []);
          setPayrollSummary(null);
          return;
        }
      }

      // Non-admin attendants should use the attendant earnings summary endpoint
      const res = await fetch(`/api/attendant/earnings/summary?${params.toString()}`, { cache: "no-store" });
      if (!res.ok) {
        // if endpoint missing, show placeholder by clearing summary
        setPayrollSummary(null);
        return;
      }
      const data = (await res.json()) as PayrollSummary;
      setPayrollSummary(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unable to load payroll summary";
      showToast(msg, "error");
      setPayrollSummary(null);
    } finally {
      setPayrollLoading(false);
    }
  }, [userId, receiptsPeriod]);

  // receipt totals loader removed — keeping receipts editor only

  const loadShopSales = useCallback(async () => {
    if (!userId || !selectedWeek) return;
    setShopSalesLoading(true);
    try {
      const params = new URLSearchParams({
        attendantId: userId,
        start: formatNairobiParam(selectedWeek.start, false),
        end: formatNairobiParam(selectedWeek.end, true),
      });

      const res = await fetch(`/api/online/shops/sales?${params.toString()}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load assigned shops");
      const data = (await res.json()) as { rows?: ShopSalesRow[] };
      setShopSalesRows(Array.isArray(data.rows) ? data.rows : []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load assigned shops";
      showToast(message, "error");
    } finally {
      setShopSalesLoading(false);
    }
  }, [selectedWeek, userId]);

  const loadWeeklyEarnings = useCallback(async () => {
    if (!userId || !selectedWeek) return;
    setWeeklyLoading(true);
    try {
      const params = new URLSearchParams({
        attendantId: userId,
        start: formatNairobiParam(selectedWeek.start, false),
        end: formatNairobiParam(selectedWeek.end, true),
      });

      const res = await fetch(`/api/online/weekly/shops/earnings?${params.toString()}`, {
        cache: "no-store",
      });

      if (!res.ok) {
        setWeeklyEarnings(null);
        return;
      }

      const data = (await res.json()) as WeeklyEarningsResponse;
      setWeeklyEarnings(data);
    } catch {
      setWeeklyEarnings(null);
    } finally {
      setWeeklyLoading(false);
    }
  }, [selectedWeek, userId]);

  const salesRecordsTotals = useMemo(() => {
    return receiptsEditorRows.reduce(
      (acc, receipt) => {
        const sale = Number(receipt.sellingTotal || 0);
        acc.totalSales += sale;
        acc.totalItems += receipt.items.length;
        acc.totalReceipts += 1;
        return acc;
      },
      { totalSales: 0, totalItems: 0, totalReceipts: 0 },
    );
  }, [receiptsEditorRows]);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  // receipt totals loader previously triggered here; removed

  useEffect(() => {
    if (!userId || !selectedWeek) return;
    void loadShopSales();
    void loadWeeklyEarnings();
    void loadReceiptStats();
    void loadOnlineSummary();
    void loadPayrollSummary();
  }, [loadShopSales, loadWeeklyEarnings, loadReceiptStats, loadOnlineSummary, loadPayrollSummary, selectedWeek, userId]);

  const directSales = useMemo(() => {
    return receiptRows.reduce((sum, r) => sum + (Number(r.total) || 0), 0);
  }, [receiptRows]);

  const receiptsCount = receiptRows.length;

  const platformTotals = useMemo(() => {
    const platforms = onlineSummary?.platforms ?? [];
    const jumia = platforms.find((p) => String(p.key).toUpperCase() === "JUMIA");
    const kilimall = platforms.find((p) => String(p.key).toUpperCase() === "KILIMALL");

    return {
      jumiaSales: Number(jumia?.sales || 0),
      kilimallSales: Number(kilimall?.sales || 0),
      marketplaceCommission: Number(onlineSummary?.totals?.commission || 0),
    };
  }, [onlineSummary]);

  const totalSales = directSales + platformTotals.jumiaSales + platformTotals.kilimallSales;
  // Prefer server-calculated marketplace sales when available (includes payout weeks and weekly manual)
  const marketplaceSales = Number(onlineSummary?.totals?.marketplaceSales ?? platformTotals.jumiaSales + platformTotals.kilimallSales);
  const tierInfo = useMemo(() => describeMarketplaceTier(marketplaceSales), [marketplaceSales]);

  const quickStatsCommission = useMemo(() => {
    const payrollValue =
      payrollSummary?.commissionTotal ??
      payrollSummary?.grossCommission ??
      payrollSummary?.salesCommission ??
      ((payrollSummary?.commissionDirect ?? 0) +
        (payrollSummary?.commissionMarketplaceJumia ?? 0) +
        (payrollSummary?.commissionMarketplaceKilimall ?? 0));

    if (payrollValue > 0) {
      return Math.round(payrollValue);
    }

    return Math.round(Number(onlineSummary?.totals?.commission ?? 0));
  }, [onlineSummary, payrollSummary]);

  const quickStatsData = {
    periodLabel: receiptsPeriod.label,
    jumiaSales: platformTotals.jumiaSales,
    kilimallSales: platformTotals.kilimallSales,
    directSales,
    receiptsCount,
    totalSales,
    commission: quickStatsCommission,
    marketplaceSales,
    tierProgress: tierInfo.progress,
    toNextTier: tierInfo.remaining,
    tierMessage: undefined,
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <main className="mx-auto max-w-7xl space-y-6 p-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-semibold">Online Ops</h1>
            <p className="text-sm text-slate-300">
              One dashboard for <span className="text-emerald-200">Direct Sales</span> and{" "}
              <span className="text-emerald-200">Jumia/Kilimall</span> shops.
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              <button className={pillClass(tab === "overview")} onClick={() => setTab("overview")}>
                Overview
              </button>
              <button className={pillClass(tab === "shops")} onClick={() => setTab("shops")}>
                Weekly earnings
              </button>
              <button className={pillClass(tab === "receipts")} onClick={() => setTab("receipts")}>
                Receipts
              </button>
              <button className={pillClass(tab === "payroll")} onClick={() => setTab("payroll")}>
                Payroll
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              className="px-5"
              onClick={() => (window.location.href = "/attendant/daily-report")}
            >
              Open Daily Report
            </Button>
          </div>
        </header>

        {tab === "overview" && (
          <div className="grid gap-6 lg:grid-cols-12">
            <div className="space-y-6 lg:col-span-8">
              <AssignedShopsCard
                rows={shopSalesRows}
                loading={shopSalesLoading}
                weekLabel={selectedWeek?.label ?? "Week view"}
              />
              <Card className="space-y-4 border-slate-800 bg-slate-900/80 shadow-xl shadow-black/40">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-400">Weekly earnings</p>
                    <h2 className="text-lg font-semibold">Your shops &amp; marketplace</h2>
                  </div>
                  <TradingWeekPicker
                    weeks={tradingWeeks}
                    value={selectedWeekKey}
                    onChange={setSelectedWeekKey}
                    loading={weeklyLoading}
                  />
                </div>
                <WeeklyEarningsPanel weekly={weeklyEarnings} loading={weeklyLoading} weekLabel={selectedWeek?.label} />
              </Card>
            </div>

            <div className="space-y-4 lg:col-span-4">
              <QuickStatsCard
                variant="onlineOps"
                loading={receiptStatsLoading || onlineSummaryLoading}
                onlineOps={quickStatsData}
              />

              <EarningsCard summary={mapPayrollToEarningsSummary(payrollSummary)} />

              <Card className="space-y-6 border-slate-800 bg-slate-900/80 shadow-xl shadow-black/40">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Direct sales</p>
                  <h2 className="text-xl font-semibold">Add receipts for today</h2>
                  <p className="text-sm text-slate-400">
                    Totals are calculated within your payroll period ({receiptsPeriod.label}).
                  </p>
                </div>

                <ReceiptsEditor
                  receipts={receiptsEditorRows}
                  setReceipts={setReceiptsEditorRows}
                  totals={{
                    totalSales: salesRecordsTotals.totalSales,
                    totalProfit: 0,
                    totalItems: salesRecordsTotals.totalItems,
                  }}
                  hideBuyingPrice
                />

                <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3 text-sm text-slate-300">
                  <p>
                    Total receipts:{" "}
                    <span className="font-semibold text-emerald-300">{salesRecordsTotals.totalReceipts}</span>
                  </p>
                  <p>
                    Total sales (KES):{" "}
                    <span className="font-semibold text-emerald-300">{formatKES(salesRecordsTotals.totalSales)}</span>
                  </p>
                  <p>
                    Total items:{" "}
                    <span className="font-semibold text-emerald-300">{salesRecordsTotals.totalItems}</span>
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    className="px-4"
                    onClick={() => (window.location.href = "/receipts")}
                  >
                    Open receipts desk
                  </Button>
                </div>
              </Card>
            </div>
          </div>
        )}

        {tab === "shops" && (
          <div className="grid gap-6 lg:grid-cols-12">
            <div className="space-y-6 lg:col-span-8">
              <Card className="space-y-4 border-slate-800 bg-slate-900/80 shadow-xl shadow-black/40">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-400">Weekly breakdown</p>
                    <h2 className="text-lg font-semibold">Shops this week</h2>
                    <p className="text-sm text-slate-400">Refresh to sync the latest statements.</p>
                  </div>
                  <TradingWeekPicker
                    weeks={tradingWeeks}
                    value={selectedWeekKey}
                    onChange={setSelectedWeekKey}
                    loading={weeklyLoading}
                  />
                </div>
                <WeeklyEarningsPanel weekly={weeklyEarnings} loading={weeklyLoading} weekLabel={selectedWeek?.label} />
              </Card>
            </div>

            <div className="space-y-4 lg:col-span-4">
              {/* right column removed for Shops tab (Assigned shops shown in Overview) */}
            </div>
          </div>
        )}

        {tab === "receipts" && (
          <div className="space-y-6">
            <Card className="space-y-6 border-slate-800 bg-slate-900/80 shadow-xl shadow-black/40">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Direct sales</p>
                <h2 className="text-xl font-semibold">Add receipts for today</h2>
                <p className="text-sm text-slate-400">
                  Totals are calculated automatically within your payroll period ({receiptsPeriod.label}).
                </p>
              </div>

              <ReceiptsEditor
                receipts={receiptsEditorRows}
                setReceipts={setReceiptsEditorRows}
                totals={{
                  totalSales: salesRecordsTotals.totalSales,
                  totalProfit: 0,
                  totalItems: salesRecordsTotals.totalItems,
                }}
                hideBuyingPrice
              />

              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3 text-sm text-slate-300">
                <p>
                  Total receipts:{" "}
                  <span className="font-semibold text-emerald-300">{salesRecordsTotals.totalReceipts}</span>
                </p>
                <p>
                  Total sales (KES):{" "}
                  <span className="font-semibold text-emerald-300">{formatKES(salesRecordsTotals.totalSales)}</span>
                </p>
                <p>
                  Total items:{" "}
                  <span className="font-semibold text-emerald-300">{salesRecordsTotals.totalItems}</span>
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  className="px-4"
                  onClick={() => (window.location.href = "/receipts")}
                >
                  Open receipts desk
                </Button>
              </div>
            </Card>
          </div>
        )}

        {tab === "payroll" && (
          <div className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-12">
              <div className="space-y-6 lg:col-span-12">
                {payrollLoading && !payrollSummary && !payrollRows ? (
                  <Card className="p-6 text-center">Loading payroll summary…</Card>
                ) : payrollRows && payrollRows.length > 0 ? (
                  <PayrollTableClient rows={payrollRows} periodLabel={receiptsPeriod.label} />
                ) : payrollSummary ? (
                  <PayrollTableClient rows={[mapPayrollToPayrollRow(payrollSummary)]} periodLabel={receiptsPeriod.label} />
                ) : (
                  <Card className="p-6 text-center">Payroll data not available for this period.</Card>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
