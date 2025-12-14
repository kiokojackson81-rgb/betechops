"use client";

import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import Card from "@/app/_components/Card";
import Button from "@/app/_components/Button";
import ReceiptsEditor from "@/app/_components/ReceiptsEditor";
import SensitiveValue from "@/components/SensitiveValue";
import { useCardLock, LockButton } from "@/app/_components/useCardLock";
import { getTradingPeriodFor } from "@/lib/tradingPeriod";
import { showToast } from "@/lib/ui/toast";

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
  totals: { orders: number; sales: number; commission: number };
  platforms: OnlinePlatformSummary[];
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

type OnlineEarningsSummary = {
  periodLabel: string;
  salesCommission: number;
  otherBonuses: number;
  netPay: number;
};

type ReceiptItem = { id: string; productName: string; buyingPrice: number | "" };
type ReceiptRow = {
  id: string;
  receiptNumber: string;
  sellingTotal: number | "";
  paymentMethod: PaymentMethod;
  items: ReceiptItem[];
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

const COMMISSION_RATE_DIRECT = 0.02;

const safeNumber = (value?: number | null) => Number(value ?? 0);
const formatKES = (value: number | null | undefined) =>
  `KES ${Number(value ?? 0).toLocaleString("en-KE", { maximumFractionDigits: 0 })}`;

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

const formatNairobiParam = (date: Date, endOfDay = false) => {
  const ymd = date.toLocaleDateString("en-CA", { timeZone: "Africa/Nairobi" });
  return endOfDay ? `${ymd}T23:59:59.999+03:00` : `${ymd}T00:00:00+03:00`;
};

function computeRangeDates(
  range: "period" | "this-week" | "last-week" | "month-to-date",
  period: { start: Date; end: Date; label: string },
) {
  const now = new Date();

  const asWeek = (offsetWeeks: number) => {
    const d = new Date(now);
    const day = d.getDay();
    const diffToMonday = day === 0 ? 6 : day - 1;
    const weekStart = new Date(d);
    weekStart.setDate(d.getDate() - diffToMonday + offsetWeeks * 7);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);
    return { start: weekStart, end: weekEnd };
  };

  if (range === "period") {
    return { start: period.start, end: period.end };
  }
  if (range === "this-week") {
    return asWeek(0);
  }
  if (range === "last-week") {
    return asWeek(-1);
  }
  if (range === "month-to-date") {
    const start = new Date(now);
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  return { start: period.start, end: period.end };
}

function pillClass(active: boolean) {
  return [
    "rounded-full border px-3 py-1 text-xs font-medium transition",
    active
      ? "border-emerald-500 bg-emerald-500/10 text-emerald-200"
      : "border-slate-800 bg-slate-950/40 text-slate-300 hover:border-slate-700",
  ].join(" ");
}

export default function AttendantOnlineOpsClient() {
  const [period] = useState(() => getTradingPeriodFor(new Date()));
  const [userId, setUserId] = useState<string | null>(null);
  const [tab, setTab] = useState<"overview" | "shops" | "receipts" | "payroll">("overview");
  const [range, setRange] = useState<"period" | "this-week" | "last-week" | "month-to-date">(
    "this-week",
  );

  const [receiptRows, setReceiptRows] = useState<ReceiptStatsRow[]>([]);
  const [statsLoading, setStatsLoading] = useState(false);

  const [receiptsEditorRows, setReceiptsEditorRows] = useState<ReceiptRow[]>([createReceipt()]);
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

  const [onlineSummary, setOnlineSummary] = useState<OnlineSummaryResponse | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  const [shopSalesRows, setShopSalesRows] = useState<ShopSalesRow[]>([]);
  const [shopSalesLoading, setShopSalesLoading] = useState(false);
  const [shopRange, setShopRange] = useState<"period" | "this-week" | "all">("period");
  const [shopPeriodLabel, setShopPeriodLabel] = useState(period.label);
  const [shopPeriodTotal, setShopPeriodTotal] = useState(0);
  const [shopAllTimeTotal, setShopAllTimeTotal] = useState(0);

  const [earningsSummary, setEarningsSummary] = useState<OnlineEarningsSummary | null>(null);
  const [earningsLoading, setEarningsLoading] = useState(false);

  const [weeklyEarnings, setWeeklyEarnings] = useState<WeeklyEarningsResponse | null>(null);
  const [weeklyLoading, setWeeklyLoading] = useState(false);

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
    setStatsLoading(true);
    try {
      const { start, end } = computeRangeDates(range, period);
      const params = new URLSearchParams({
        start: formatNairobiParam(start, false),
        end: formatNairobiParam(end, true),
        includeItems: "true",
        size: "200",
      });
      params.set("attendantId", userId);

      const res = await fetch(`/api/receipts?${params.toString()}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load receipts for selected range");
      const data = (await res.json()) as { receipts?: ReceiptStatsRow[] };
      setReceiptRows(Array.isArray(data.receipts) ? data.receipts : []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load receipt totals";
      showToast(message, "error");
    } finally {
      setStatsLoading(false);
    }
  }, [period, range, userId]);

  const loadOnlineSummary = useCallback(async () => {
    if (!userId) return;
    setSummaryLoading(true);
    try {
      const { start, end } = computeRangeDates(range, period);
      const params = new URLSearchParams({
        start: formatNairobiParam(start, false),
        end: formatNairobiParam(end, true),
      });
      params.set("attendantId", userId);

      const res = await fetch(`/api/online/summary?${params.toString()}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load online sales summary");
      const data = (await res.json()) as OnlineSummaryResponse;
      setOnlineSummary(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load online sales summary";
      showToast(message, "error");
    } finally {
      setSummaryLoading(false);
    }
  }, [period, range, userId]);

  const loadShopSales = useCallback(async () => {
    if (!userId) return;
    setShopSalesLoading(true);
    try {
      const params = new URLSearchParams({ range: shopRange, attendantId: userId });

      if (shopRange !== "all") {
        const { start, end } =
          shopRange === "period"
            ? computeRangeDates("period", period)
            : computeRangeDates("this-week", period);
        params.set("start", formatNairobiParam(start, false));
        params.set("end", formatNairobiParam(end, true));
      }

      const res = await fetch(`/api/online/shops/sales?${params.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to load shop sales");
      const data = await res.json();

      setShopSalesRows(Array.isArray(data.rows) ? data.rows : []);
      setShopPeriodLabel(data.periodLabel ?? period.label);
      setShopPeriodTotal(data.periodTotal ?? 0);
      setShopAllTimeTotal(data.totalToDate ?? 0);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load shop sales";
      showToast(message, "error");
    } finally {
      setShopSalesLoading(false);
    }
  }, [period, shopRange, userId]);

  const loadEarnings = useCallback(async () => {
    setEarningsLoading(true);
    try {
      const res = await fetch("/api/online/earnings/summary", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as OnlineEarningsSummary;
      setEarningsSummary(data);
    } catch (err) {
      console.warn("[attendant/online-ops] earnings summary error", err);
    } finally {
      setEarningsLoading(false);
    }
  }, []);

  const loadWeeklyEarnings = useCallback(async () => {
    if (!userId) return;
    setWeeklyLoading(true);
    try {
      const { start, end } = computeRangeDates("this-week", period);
      const params = new URLSearchParams({
        attendantId: userId,
        start: formatNairobiParam(start, false),
        end: formatNairobiParam(end, true),
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
    } catch (err) {
      setWeeklyEarnings(null);
    } finally {
      setWeeklyLoading(false);
    }
  }, [period, userId]);

  const receiptTotals = useMemo(() => {
    const totalSales = receiptRows.reduce((sum, r) => sum + (Number(r.total) || 0), 0);
    const totalItems = receiptRows.reduce(
      (sum, r) => sum + (Array.isArray(r.items) ? r.items.length : 0),
      0,
    );

    let totalProfit = 0;
    let awaitingPricingCount = 0;

    for (const receipt of receiptRows) {
      const items = Array.isArray(receipt.items) ? receipt.items : [];
      if (items.length === 0) {
        awaitingPricingCount += 1;
        continue;
      }

      let anyMissing = false;
      let buyingSum = 0;

      for (const it of items) {
        const bp = it?.buyingPrice;
        if (bp === "" || bp === null || bp === undefined) {
          anyMissing = true;
          break;
        }
        const n = Number(bp ?? 0);
        if (Number.isNaN(n)) {
          anyMissing = true;
          break;
        }
        buyingSum += n;
      }

      if (anyMissing) {
        awaitingPricingCount += 1;
        continue;
      }

      const sale = Number(receipt.total ?? 0);
      totalProfit += Math.max(0, sale - buyingSum);
    }

    return {
      totalSales,
      totalItems,
      totalReceipts: receiptRows.length,
      commission: totalSales * COMMISSION_RATE_DIRECT,
      totalProfit,
      awaitingPricingCount,
    };
  }, [receiptRows]);

  const onlineTotals = onlineSummary?.totals ?? { orders: 0, sales: 0, commission: 0 };
  const onlinePlatforms =
    onlineSummary?.platforms?.length &&
    onlineSummary.platforms.length > 0
      ? onlineSummary.platforms
      : [
          { key: "JUMIA", name: "Jumia", orders: 0, sales: 0, commission: 0 },
          { key: "KILIMALL", name: "Kilimall", orders: 0, sales: 0, commission: 0 },
        ];

  const combined = useMemo(() => {
    const directSales = receiptTotals.totalSales;
    const onlineSales = safeNumber(onlineTotals.sales);
    const totalSales = directSales + onlineSales;

    const directCommission = receiptTotals.commission;
    const marketplaceCommission = safeNumber(onlineTotals.commission);
    const totalCommission = directCommission + marketplaceCommission;

    const shopsCount = weeklyEarnings?.totals?.shops ?? 0;

    return {
      directSales,
      onlineSales,
      totalSales,
      directCommission,
      marketplaceCommission,
      totalCommission,
      shopsCount,
    };
  }, [receiptTotals, onlineTotals, weeklyEarnings]);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  useEffect(() => {
    if (!userId) return;
    void loadReceiptStats();
    void loadOnlineSummary();
  }, [loadOnlineSummary, loadReceiptStats, userId]);

  useEffect(() => {
    if (!userId) return;
    void loadShopSales();
  }, [loadShopSales, userId]);

  useEffect(() => {
    void loadEarnings();
  }, [loadEarnings]);

  useEffect(() => {
    if (!userId) return;
    void loadWeeklyEarnings();
  }, [loadWeeklyEarnings, userId]);

  const headerLabel = onlineSummary?.period?.label ?? period.label;
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <main className="mx-auto max-w-7xl space-y-6 p-6">
        {/* ===== Header ===== */}
        <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-semibold">Online Ops</h1>
            <p className="text-sm text-slate-300">
              One dashboard for <span className="text-emerald-200">Direct Sales</span>, 
              <span className="text-emerald-200">Jumia/Kilimall</span>, shops, and payroll-linked earnings.
            </p>

            {/* Tabs */}
            <div className="mt-3 flex flex-wrap gap-2">
              <button className={pillClass(tab === "overview")} onClick={() => setTab("overview")}>
                Overview
              </button>
              <button className={pillClass(tab === "shops")} onClick={() => setTab("shops")}>
                Shops & Weekly Earnings
              </button>
              <button className={pillClass(tab === "receipts")} onClick={() => setTab("receipts")}>
                Receipts & Direct Sales
              </button>
              <button className={pillClass(tab === "payroll")} onClick={() => setTab("payroll")}>
                Payroll
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {/* Range pills */}
            <button
              className={pillClass(range === "this-week")}
              onClick={() => setRange("this-week")}
            >
              This week
            </button>
            <button
              className={pillClass(range === "last-week")}
              onClick={() => setRange("last-week")}
            >
              Last week
            </button>
            <button
              className={pillClass(range === "month-to-date")}
              onClick={() => setRange("month-to-date")}
            >
              Month-to-date
            </button>
            <button className={pillClass(range === "period")} onClick={() => setRange("period")}>
              Payroll period
            </button>

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

        {/* ===== Payroll period banner (always visible) ===== */}
        <Card className="border-slate-800 bg-slate-950/70">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Payroll earnings period</p>
              <p className="mt-1 text-sm text-slate-200">{headerLabel}</p>
              <p className="text-xs text-slate-400">
                Payroll uses this window. Your “This week” range is just for performance tracking.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <MiniKpi label="Direct sales" value={formatKES(combined.directSales)} />
              <MiniKpi label="Online sales" value={formatKES(combined.onlineSales)} />
              <MiniKpi
                label="Total commission"
                value={
                  <SensitiveValue
                    value={combined.totalCommission}
                    format={(v) => `KES ${safeNumber(Number(v)).toLocaleString("en-KE")}`}
                    storageKey="onlineOps:totalCommission"
                  />
                }
              />
              <MiniKpi label="Marketplace orders" value={safeNumber(onlineTotals.orders).toLocaleString()} />
            </div>
          </div>
        </Card>

        {/* ===== BODY ===== */}
        {tab === "overview" && (
          <div className="grid gap-6 lg:grid-cols-12">
            <div className="space-y-6 lg:col-span-8">
              {/* Marketplace block */}
              <Card className="space-y-4 border-slate-800 bg-slate-900/80 shadow-xl shadow-black/40">
                <div className="flex flex-col gap-1">
                  <p className="text-xs uppercase tracking-wide text-slate-400">
                    Jumia / Kilimall / Online channels
                  </p>
                  <h2 className="text-lg font-semibold">Marketplace performance</h2>
                  <p className="text-sm text-slate-400">
                    Orders, sales, and commissions for the selected range.
                  </p>
                </div>

                <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/70">
                  <div className="grid grid-cols-4 gap-2 border-b border-slate-800 bg-slate-900/70 px-4 py-2 text-[11px] uppercase tracking-wide text-slate-400">
                    <span>Platform</span>
                    <span className="text-right">Orders</span>
                    <span className="text-right">Sales (KES)</span>
                    <span className="text-right">Commission</span>
                  </div>
                  {onlinePlatforms.map((p) => (
                    <div key={p.key} className="grid grid-cols-4 gap-2 px-4 py-3 text-sm">
                      <span className="font-medium text-slate-100">{p.name}</span>
                      <span className="text-right text-slate-200">
                        {safeNumber(p.orders).toLocaleString()}
                      </span>
                      <span className="text-right text-emerald-300">{formatKES(p.sales)}</span>
                      <span className="text-right text-slate-200">{formatKES(p.commission)}</span>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-300">
                  <div>
                    <p>
                      Marketplace sales: 
                      <span className="font-semibold text-emerald-300">
                        {formatKES(onlineTotals.sales)}
                      </span>
                    </p>
                    <p className="text-xs text-slate-500">
                      {summaryLoading ? "Refreshing…" : "Up to date"}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    className="px-4"
                    onClick={() => void loadOnlineSummary()}
                    disabled={summaryLoading}
                  >
                    {summaryLoading ? "Refreshing…" : "Refresh marketplace"}
                  </Button>
                </div>
              </Card>

              {/* Weekly per-shop earnings */}
              <Card className="space-y-4 border-slate-800 bg-slate-900/80 shadow-xl shadow-black/40">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-400">Weekly earnings</p>
                    <h2 className="text-lg font-semibold">Your shops this week</h2>
                    <p className="text-sm text-slate-400">
                      Per-shop totals for the week (commission + sales). If sync fails, admin can
                      override in manual weekly sales desk.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    className="px-3"
                    onClick={() => void loadWeeklyEarnings()}
                    disabled={weeklyLoading}
                  >
                    {weeklyLoading ? "Refreshing…" : "Refresh"}
                  </Button>
                </div>

                <WeeklyEarningsPanel weekly={weeklyEarnings} loading={weeklyLoading} />
              </Card>
            </div>

            <div className="space-y-4 lg:col-span-4">
              <QuickStatsCard
                statsLoading={statsLoading}
                label={`Selected range • ${range.replaceAll("-", " ")}`}
                totals={receiptTotals}
                onlineCommission={onlineTotals.commission}
              />
              <PayrollCard summary={earningsSummary} loading={earningsLoading} />
              <ShopSalesCard
                rows={shopSalesRows}
                total={shopRange === "all" ? shopAllTimeTotal : shopPeriodTotal}
                loading={shopSalesLoading}
                range={shopRange}
                onRangeChange={(v) => setShopRange(v)}
                onRefresh={loadShopSales}
                periodLabel={shopPeriodLabel}
              />
            </div>
          </div>
        )}

        {/* ===== Shops tab ===== */}
        {tab === "shops" && (
          <div className="grid gap-6 lg:grid-cols-12">
            <div className="space-y-6 lg:col-span-8">
              <Card className="space-y-4 border-slate-800 bg-slate-900/80 shadow-xl shadow-black/40">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-400">
                      Weekly breakdown
                    </p>
                    <h2 className="text-xl font-semibold">Earnings per shop</h2>
                    <p className="text-sm text-slate-400">
                      See shops assigned to you and what each contributed this week.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    className="px-3"
                    onClick={() => void loadWeeklyEarnings()}
                    disabled={weeklyLoading}
                  >
                    {weeklyLoading ? "Refreshing…" : "Refresh"}
                  </Button>
                </div>

                <WeeklyEarningsPanel weekly={weeklyEarnings} loading={weeklyLoading} />
              </Card>
            </div>

            <div className="space-y-4 lg:col-span-4">
              <Card className="space-y-3 border-slate-800 bg-slate-900/80 shadow-xl shadow-black/40">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-400">Manual weekly desk</p>
                    <p className="text-sm text-slate-300">
                      If statements fail to sync, admin uses overrides to keep the truth.
                    </p>
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3 text-xs text-slate-300">
                  <p className="font-semibold text-emerald-200">Where to fix mismatch:</p>
                  <p className="mt-1 text-slate-400">/admin/online/manual</p>
                  <p className="mt-2 text-slate-500">
                    (Attendants view only; admin approves weekly entries.)
                  </p>
                </div>
              </Card>

              <ShopSalesCard
                rows={shopSalesRows}
                total={shopRange === "all" ? shopAllTimeTotal : shopPeriodTotal}
                loading={shopSalesLoading}
                range={shopRange}
                onRangeChange={(v) => setShopRange(v)}
                onRefresh={loadShopSales}
                periodLabel={shopPeriodLabel}
              />
            </div>
          </div>
        )}

        {/* ===== Receipts tab ===== */}
        {tab === "receipts" && (
          <div className="grid gap-6 lg:grid-cols-12">
            <div className="space-y-6 lg:col-span-8">
              <Card className="space-y-6 border-slate-800 bg-slate-900/80 shadow-xl shadow-black/40">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Direct sales</p>
                  <h2 className="text-xl font-semibold">Add receipts for today</h2>
                  <p className="text-sm text-slate-400">
                    Use this for walk-in/direct sales. Totals update instantly.
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
                    Total receipts: 
                    <span className="font-semibold text-emerald-300">
                      {salesRecordsTotals.totalReceipts}
                    </span>
                  </p>
                  <p>
                    Total sales (KES): 
                    <span className="font-semibold text-emerald-300">
                      {formatKES(salesRecordsTotals.totalSales)}
                    </span>
                  </p>
                  <p>
                    Total items: 
                    <span className="font-semibold text-emerald-300">
                      {salesRecordsTotals.totalItems}
                    </span>
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
                  <Button
                    type="button"
                    variant="secondary"
                    className="px-4"
                    onClick={() => void loadReceiptStats()}
                    disabled={statsLoading}
                  >
                    {statsLoading ? "Refreshing…" : "Refresh receipt totals"}
                  </Button>
                </div>
              </Card>
            </div>

            <div className="space-y-4 lg:col-span-4">
              <QuickStatsCard
                statsLoading={statsLoading}
                label={`Selected range • ${range.replaceAll("-", " ")}`}
                totals={receiptTotals}
                onlineCommission={onlineTotals.commission}
              />
            </div>
          </div>
        )}

        {/* ===== Payroll tab ===== */}
        {tab === "payroll" && (
          <div className="grid gap-6 lg:grid-cols-12">
            <div className="space-y-6 lg:col-span-8">
              <Card className="space-y-4 border-slate-800 bg-slate-900/80 shadow-xl shadow-black/40">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-400">
                      Payroll-linked earnings
                    </p>
                    <h2 className="text-xl font-semibold">Your pay this period</h2>
                    <p className="text-sm text-slate-400">
                      Net pay + commission (Jumia/Kilimall commissions show clearly here).
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    className="px-3"
                    onClick={() => void loadEarnings()}
                    disabled={earningsLoading}
                  >
                    {earningsLoading ? "Refreshing…" : "Refresh"}
                  </Button>
                </div>

                <PayrollCard summary={earningsSummary} loading={earningsLoading} />
              </Card>
            </div>

            <div className="space-y-4 lg:col-span-4">
              <Card className="space-y-3 border-slate-800 bg-slate-900/80 shadow-xl shadow-black/40">
                <p className="text-xs uppercase tracking-wide text-slate-400">What counts</p>
                <div className="space-y-2 text-sm text-slate-300">
                  <Bullet label="Direct sales commission" value={`${(COMMISSION_RATE_DIRECT * 100).toFixed(0)}%`} />
                  <Bullet label="Marketplace commission" value="From synced statements" />
                  <Bullet label="Manual weekly overrides" value="Approved by admin" />
                </div>
              </Card>
            </div>
          </div>
        )}
      </main>
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

function Bullet({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-slate-950/60 px-3 py-2">
      <span className="text-slate-300">{label}</span>
      <span className="font-semibold text-emerald-200">{value}</span>
    </div>
  );
}

function WeeklyEarningsPanel({
  weekly,
  loading,
}: {
  weekly: WeeklyEarningsResponse | null;
  loading: boolean;
}) {
  const rows = weekly?.rows ?? [];
  const totals = weekly?.totals;

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">This week</p>
            <p className="text-sm text-slate-200">{weekly?.rangeLabel ?? "Week view"}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <MiniKpi label="Shops" value={totals ? totals.shops : "—"} />
            <MiniKpi label="Sales" value={totals ? formatKES(totals.sales) : "—"} />
            <MiniKpi label="Commission" value={totals ? formatKES(totals.commission) : "—"} />
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

function QuickStatsCard({
  statsLoading,
  label,
  totals,
  onlineCommission,
}: {
  statsLoading: boolean;
  label: string;
  totals: {
    totalReceipts: number;
    totalSales: number;
    totalItems: number;
    commission: number;
    totalProfit?: number;
    awaitingPricingCount?: number;
  };
  onlineCommission: number;
}) {
  const { locked, toggle } = useCardLock("onlineOps:quickstats");
  const mask = (value: ReactNode) => (locked ? "•••" : value);

  const combinedCommission = safeNumber(totals.commission) + safeNumber(onlineCommission);

  const stats = [
    {
      label: "Direct receipts",
      value:
        typeof totals.awaitingPricingCount === "number" && totals.awaitingPricingCount > 0
          ? `${safeNumber(totals.totalReceipts).toLocaleString()} • ${totals.awaitingPricingCount} awaiting pricing`
          : safeNumber(totals.totalReceipts).toLocaleString(),
    },
    { label: "Direct sales (KES)", value: formatKES(totals.totalSales) },
    { label: "Profit (KES)", value: formatKES(totals.totalProfit ?? 0) },
    { label: "Items sold", value: safeNumber(totals.totalItems).toLocaleString() },
    {
      label: "Direct commission (KES)",
      value: (
        <SensitiveValue
          value={totals.commission}
          format={(v) => `KES ${safeNumber(Number(v)).toLocaleString("en-KE")}`}
          storageKey="onlineOps:directCommission"
          forceHidden={locked}
          forceVisible={!locked}
        />
      ),
    },
    {
      label: "Total commission (KES)",
      value: (
        <SensitiveValue
          value={combinedCommission}
          format={(v) => `KES ${safeNumber(Number(v)).toLocaleString("en-KE")}`}
          storageKey="onlineOps:combinedCommission"
          forceHidden={locked}
          forceVisible={!locked}
        />
      ),
    },
  ];

  return (
    <Card className="space-y-5 border-slate-800 bg-slate-900/80 shadow-xl shadow-black/40">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-100">Quick stats</h2>
          <p className="text-xs text-slate-400">
            {label} • {statsLoading ? "Refreshing…" : "Direct + online snapshot"}
          </p>
        </div>
        <LockButton locked={locked} onToggle={toggle} />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-2xl bg-slate-950/60 px-3 py-2 text-left">
            <p className="text-[10px] uppercase tracking-wide text-slate-400">{stat.label}</p>
            <p className="mt-1 text-lg font-semibold text-emerald-400">
              {typeof stat.value === "string" || typeof stat.value === "number" ? mask(stat.value) : stat.value}
            </p>
          </div>
        ))}
      </div>
    </Card>
  );
}

function PayrollCard({
  summary,
  loading,
}: {
  summary: OnlineEarningsSummary | null;
  loading: boolean;
}) {
  const { locked, toggle } = useCardLock("onlineOps:payroll");
  const mask = (value: ReactNode) => (locked ? "•••" : value);
  const formatCurrency = (value: number) => `KES ${safeNumber(value).toLocaleString("en-KE")}`;

  if (!summary) {
    return (
      <Card className="space-y-3 border-slate-800 bg-slate-900/80 shadow-xl shadow-black/40">
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-300">Payroll</p>
          <LockButton locked={locked} onToggle={toggle} />
        </div>
        <p className="text-xs text-slate-400">
          {loading ? "Loading payroll summary…" : "No payroll summary available."}
        </p>
      </Card>
    );
  }

  return (
    <Card className="space-y-4 border-slate-800 bg-slate-900/80 shadow-xl shadow-black/40">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
              Earnings this period
            </p>
            <p className="text-sm text-slate-400">{summary.periodLabel}</p>
          </div>
          <LockButton locked={locked} onToggle={toggle} />
        </div>
        <div className="text-right">
          <p className="text-[11px] uppercase tracking-wide text-slate-400">Net pay</p>
          <p className="text-2xl font-semibold text-emerald-300">{mask(formatCurrency(summary.netPay))}</p>
        </div>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex items-center justify-between rounded-xl bg-slate-950/60 px-3 py-2">
          <span className="text-slate-300">Sales commission</span>
          <span className="font-semibold text-emerald-300">
            {mask(formatCurrency(summary.salesCommission))}
          </span>
        </div>
        {summary.otherBonuses !== 0 && (
          <div className="flex items-center justify-between rounded-xl bg-slate-950/40 px-3 py-2">
            <span className="text-slate-300">Other bonuses</span>
            <span className="font-semibold text-emerald-300">
              {mask(formatCurrency(summary.otherBonuses))}
            </span>
          </div>
        )}
      </div>
    </Card>
  );
}

function ShopSalesCard({
  rows,
  total,
  loading,
  range,
  onRangeChange,
  onRefresh,
  periodLabel,
}: {
  rows: ShopSalesRow[];
  total: number;
  loading: boolean;
  range: "period" | "this-week" | "all";
  onRangeChange: (value: "period" | "this-week" | "all") => void;
  onRefresh: () => void;
  periodLabel: string;
}) {
  return (
    <Card className="space-y-4 border-slate-800 bg-slate-900/80 shadow-xl shadow-black/40">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-emerald-400">Shop sales</p>
          <p className="text-sm text-slate-400">
            Manual entries from <span className="font-semibold">/admin/online/manual</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={range}
            onChange={(e) => onRangeChange(e.target.value as "period" | "this-week" | "all")}
            className="rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-1 text-xs text-slate-100 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
          >
            <option value="period">This earnings period</option>
            <option value="this-week">This week</option>
            <option value="all">All time up to period</option>
          </select>

          <Button
            type="button"
            variant="secondary"
            className="px-3 py-1 text-xs"
            onClick={onRefresh}
            disabled={loading}
          >
            {loading ? "Refreshing…" : "Refresh"}
          </Button>
        </div>
      </div>

      <div className="max-h-80 space-y-2 overflow-y-auto rounded-2xl border border-slate-800 bg-slate-950/70 p-3 text-sm">
        {rows.length === 0 && !loading && (
          <p className="text-xs text-slate-400">No shop sales were reported for this range.</p>
        )}

        {rows.map((shop) => (
          <div key={shop.id} className="space-y-1 rounded-xl bg-slate-900/80 px-3 py-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-100">{shop.name}</p>
                <p className="text-[11px] text-slate-400">
                  {shop.country} • {shop.currency} • {shop.status} • {String(shop.platform).toLowerCase()}
                </p>
              </div>
              <p className="text-sm font-semibold text-emerald-300">{formatKES(shop.totalSales)}</p>
            </div>

            <p className="text-[11px] text-slate-400">{shop.codeLabel}</p>
            <p className="text-[11px] text-slate-400">
              {shop.handlerName} • {shop.handlerRole}
            </p>
            <p className="text-[11px] text-slate-500">{shop.periodLabel}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between text-xs text-slate-300">
        <span>{periodLabel}</span>
        <span className="font-semibold text-emerald-300">{formatKES(total)}</span>
      </div>
    </Card>
  );
}
