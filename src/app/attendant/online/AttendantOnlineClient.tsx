"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Card from "@/app/_components/Card";
import Button from "@/app/_components/Button";
import ReceiptsEditor from "@/app/_components/ReceiptsEditor";
// SensitiveValue and card-lock helpers removed (cards cleaned up)
import QuickStatsCard from "@/components/QuickStatsCard";
import EarningsCard from "@/app/_components/EarningsCard";
import { mapPayrollToEarningsSummary as mapToEarnings } from "@/lib/payrollMapping";
import { getTradingPeriodFor } from "@/lib/tradingPeriod";
import { showToast } from "@/lib/ui/toast";

// Marketplace trading weeks anchor (kept in sync with other clients)
const MARKETPLACE_ANCHOR_START = new Date("2025-11-24T00:00:00+03:00");

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

function buildTradingWeeks(periodStart: Date) {
  const weeks: { key: string; label: string; start: Date; end: Date }[] = [];
  for (let i = 0; i < 4; i += 1) {
    const start = new Date(periodStart);
    start.setDate(periodStart.getDate() + i * 7);
    start.setHours(0, 0, 0, 0);
    const end = endOfWeekSunday(start);
    weeks.push({ key: `${start.toISOString().slice(0, 10)}`, label: `Week ${i + 1} (${formatWeekLabel(start, end)})`, start, end });
  }
  return weeks;
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
  const label = `${start.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })} - ${end.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}`;
  return { start, end, label, key: `MP_${periodIndex}` };
}

type ReceiptStatsRow = {
  id: string;
  total?: number | null;
  items?: any[];
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
  totals: {
    orders: number;
    sales: number;
    commission: number;
  };
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

type PaymentMethod = "MPESA" | "CASH" | "";

type ReceiptItem = {
  id: string;
  productName: string;
  buyingPrice: number | "";
};

type ReceiptRow = {
  id: string;
  receiptNumber: string;
  sellingTotal: number | "";
  paymentMethod: PaymentMethod;
  items: ReceiptItem[];
};

const COMMISSION_RATE = 0.02;

const formatKES = (value: number | null | undefined) =>
  `KES ${Number(value ?? 0).toLocaleString("en-KE", { maximumFractionDigits: 0 })}`;

const safeNumber = (value?: number | null) => Number(value ?? 0);

const randomId = () =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

const createItem = (): ReceiptItem => ({
  id: randomId(),
  productName: "",
  buyingPrice: "",
});

const createReceipt = (): ReceiptRow => ({
  id: randomId(),
  receiptNumber: "",
  sellingTotal: "",
  paymentMethod: "",
  items: [createItem()],
});

const toInputDate = (date: Date) =>
  // produce a YYYY-MM-DD string in Nairobi local date so inputs and
  // range builders are consistent with server-side Nairobi midnights
  date.toLocaleDateString("en-CA", { timeZone: "Africa/Nairobi" });

const formatNairobiParam = (date: Date, endOfDay = false) => {
  const ymd = date.toLocaleDateString("en-CA", { timeZone: "Africa/Nairobi" });
  return endOfDay ? `${ymd}T23:59:59.999+03:00` : `${ymd}T00:00:00+03:00`;
};

export default function AttendantOnlineClient() {
  const [period] = useState(() => getTradingPeriodFor(new Date()));
  const [userId, setUserId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);

  // receipt totals & quick stats removed from right column

  const [receiptsEditorRows, setReceiptsEditorRows] = useState<ReceiptRow[]>([
    createReceipt(),
  ]);

  const [onlineSummary, setOnlineSummary] = useState<OnlineSummaryResponse | null>(
    null,
  );
  const [summaryLoading, setSummaryLoading] = useState(false);

  const [shopSalesRows, setShopSalesRows] = useState<ShopSalesRow[]>([]);
  const [shopSalesLoading, setShopSalesLoading] = useState(false);
  const [shopRange, setShopRange] = useState<"period" | "this-week" | "last-week" | "all">(
    "period",
  );
  const [shopPeriodLabel, setShopPeriodLabel] = useState(period.label);
  const [shopPeriodTotal, setShopPeriodTotal] = useState(0);
  const [shopAllTimeTotal, setShopAllTimeTotal] = useState(0);

  // Assigned shops + weekly earnings/trading weeks for marketplace overview
  const [assignedShops, setAssignedShops] = useState<ShopSalesRow[]>([]);
  const marketplacePeriod = useMemo(() => getMarketplaceTradingPeriodFor(new Date()), []);
  const [tradingWeeks, setTradingWeeks] = useState(() => buildTradingWeeks(marketplacePeriod.start));
  const [selectedWeekKey, setSelectedWeekKey] = useState<string>("");
  const [weeklyEarnings, setWeeklyEarnings] = useState<any | null>(null);
  const [weeklyLoading, setWeeklyLoading] = useState(false);

  // receipt totals & payroll (quick stats + earnings) re-enabled
  const [receiptRows, setReceiptRows] = useState<ReceiptStatsRow[]>([]);
  const [receiptStatsLoading, setReceiptStatsLoading] = useState(false);

  const [payrollSummary, setPayrollSummary] = useState<any | null>(null);
  const [payrollLoading, setPayrollLoading] = useState(false);

  const fetchUser = useCallback(async () => {
    try {
      const res = await fetch("/api/attendants/me", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      if (data?.user?.id) setUserId(data.user.id);
      if (data?.user?.role) setUserRole(data.user.role);
    } catch (err) {
      console.warn("[attendant/online] failed to load user", err);
    }
  }, []);

  const loadAssignedShops = useCallback(async () => {
    try {
      const res = await fetch("/api/attendants/shops", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setAssignedShops(Array.isArray(data) ? data : []);
    } catch (err) {
      // ignore
    }
  }, []);

  const loadWeeklyEarnings = useCallback(async (weekKey?: string) => {
    if (!userId) return;
    const week = (tradingWeeks || []).find((w) => w.key === (weekKey ?? selectedWeekKey));
    if (!week) return;
    setWeeklyLoading(true);
    try {
      const params = new URLSearchParams({
        attendantId: userId,
        start: formatNairobiParam(week.start, false),
        end: formatNairobiParam(week.end, true),
      });
      const res = await fetch(`/api/online/weekly/shops/earnings?${params.toString()}`, { cache: "no-store" });
      if (!res.ok) {
        setWeeklyEarnings(null);
        return;
      }
      const data = await res.json();
      setWeeklyEarnings(data);
    } catch (err) {
      setWeeklyEarnings(null);
    } finally {
      setWeeklyLoading(false);
    }
  }, [tradingWeeks, selectedWeekKey, userId]);

  const loadReceiptStats = useCallback(async () => {
    if (!userId) return;
    setReceiptStatsLoading(true);
    try {
      const params = new URLSearchParams({
        attendantId: userId,
        start: formatNairobiParam(period.start, false),
        end: formatNairobiParam(period.end, true),
        includeItems: "true",
        size: "200",
      });

      const res = await fetch(`/api/receipts?${params.toString()}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load receipts for payroll period");
      const data = await res.json();
      setReceiptRows(Array.isArray(data.receipts) ? data.receipts : []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unable to load receipt totals";
      showToast(msg, "error");
    } finally {
      setReceiptStatsLoading(false);
    }
  }, [userId, period]);

  const loadPayrollSummary = useCallback(async () => {
    if (!userId) return;
    setPayrollLoading(true);
    try {
      const params = new URLSearchParams({
        attendantId: userId,
        start: formatNairobiParam(period.start, false),
        end: formatNairobiParam(period.end, true),
      });

      // If user is an admin, prefer the richer admin endpoint which may return multiple rows
      if (userRole === "ADMIN") {
        try {
          const adminRes = await fetch(`/api/admin/payroll/summary?${params.toString()}`, { cache: "no-store" });
          if (adminRes.ok) {
            const adminData = await adminRes.json();
            // Admin endpoint returns rows — pick the first row as the summary if available
            if (Array.isArray(adminData.rows) && adminData.rows.length > 0) {
              setPayrollSummary(adminData.rows[0]);
              return;
            }
          }
        } catch (e) {
          // fall through to normal endpoint on error
        }
      }

      const res = await fetch(`/api/payroll/summary?${params.toString()}`, { cache: "no-store" });
      if (!res.ok) {
        setPayrollSummary(null);
        return;
      }
      const data = await res.json();
      setPayrollSummary(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unable to load payroll summary";
      showToast(msg, "error");
      setPayrollSummary(null);
    } finally {
      setPayrollLoading(false);
    }
  }, [userId, period]);

  // receiptTotals loader removed

  const loadOnlineSummary = useCallback(async (overrides?: { start?: string; end?: string }) => {
    if (!userId) return;
    setSummaryLoading(true);
    try {
      const params = new URLSearchParams({
        start: overrides?.start ?? formatNairobiParam(period.start, false),
        end: overrides?.end ?? formatNairobiParam(period.end, true),
      });
      params.set("attendantId", userId);
      const res = await fetch(`/api/online/summary?${params.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to load online sales summary");
      const data = (await res.json()) as OnlineSummaryResponse;
      setOnlineSummary(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load online sales summary";
      showToast(message, "error");
    } finally {
      setSummaryLoading(false);
    }
  }, [period, userId]);

  const loadShopSales = useCallback(async () => {
    if (!userId) return;
    setShopSalesLoading(true);
    try {
      const { start, end } = computeRangeDates(shopRange, period);
      const params = new URLSearchParams({
        range: shopRange,
        attendantId: userId,
      });
      if (start) params.set("start", start);
      if (end) params.set("end", end);

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
      const message =
        err instanceof Error ? err.message : "Unable to load shop sales";
      showToast(message, "error");
    } finally {
      setShopSalesLoading(false);
    }
  }, [period, shopRange, userId]);


  // receiptTotals derived state removed (Quick stats removed)

  const salesRecordsTotals = useMemo(
    () =>
      receiptsEditorRows.reduce(
        (acc, receipt) => {
          const sale = Number(receipt.sellingTotal || 0);
          acc.totalSales += sale;
          acc.totalItems += receipt.items.length;
          // compute profit for editor rows: if any buyingPrice missing, treat profit as 0
          const items = receipt.items ?? [];
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
          if (!anyMissing) {
            acc.totalProfit += Math.max(0, sale - buyingSum);
          }
          acc.totalReceipts += 1;
          return acc;
        },
        { totalSales: 0, totalItems: 0, totalReceipts: 0, totalProfit: 0 },
      ),
    [receiptsEditorRows],
  );

  const onlineTotals = onlineSummary?.totals ?? {
    orders: 0,
    sales: 0,
    commission: 0,
  };
  const onlinePlatforms = onlineSummary?.platforms.length
    ? onlineSummary.platforms
    : [
        { key: "JUMIA", name: "Jumia", orders: 0, sales: 0, commission: 0 },
        { key: "KILIMALL", name: "Kilimall", orders: 0, sales: 0, commission: 0 },
      ];
  const averageOrderValue =
    onlineTotals.orders > 0 ? onlineTotals.sales / onlineTotals.orders : 0;

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

  const directSales = useMemo(() => {
    return receiptRows.reduce((sum, r) => sum + (Number(r.total) || 0), 0);
  }, [receiptRows]);

  const receiptsCount = receiptRows.length;

  const totalSales = directSales + (onlineSummary?.totals?.sales ?? 0);

  const commission = directSales * COMMISSION_RATE + platformTotals.marketplaceCommission;

  // helper values for UI
  const assignedShopNames = assignedShops.map((s) => `${s.name}${s.platform ? ` (${s.platform})` : ""}`).join(", ");
  const weeklyTotals = weeklyEarnings?.totals ?? null;

  useEffect(() => {
    fetchUser();
    void loadAssignedShops();
    // choose default week: previous week to the one containing today (if available)
    const today = new Date();
    const idx = tradingWeeks.findIndex((w) => today >= w.start && today <= w.end);
    const defaultIdx = idx > 0 ? idx - 1 : idx >= 0 ? idx : 0;
    if (tradingWeeks[defaultIdx]) {
      setSelectedWeekKey(tradingWeeks[defaultIdx].key);
    } else if (tradingWeeks[0]) {
      setSelectedWeekKey(tradingWeeks[0].key);
    }
  }, [fetchUser, tradingWeeks]);

  useEffect(() => {
    if (!userId) return;
    void loadOnlineSummary();
    void loadShopSales();
    void loadReceiptStats();
    void loadPayrollSummary();
    void loadWeeklyEarnings();
  }, [loadOnlineSummary, loadShopSales, userId]);

  // earnings summary loader removed

  const periodLabel = onlineSummary?.period.label ?? period.label;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <main className="mx-auto max-w-6xl space-y-6 p-6">
        <header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold">Online Operations</h1>
            <p className="text-sm text-slate-300">
              Track marketplace shop sales, receipt activity, and payroll-linked
              earnings in one place.
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            className="px-5"
            onClick={() => {
              window.location.href = "/receipts";
            }}
          >
            Open receipts desk
          </Button>
        </header>

        {/* Payroll earnings period banner removed */}

        <div className="grid gap-6 lg:grid-cols-12">
          <div className="space-y-6 lg:col-span-8">
            <Card className="space-y-6 border-slate-800 bg-slate-900/80 shadow-xl shadow-black/40">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  Sales records
                </p>
                <h2 className="text-xl font-semibold">Add each receipt for today</h2>
                <p className="text-sm text-slate-400">
                  Totals are calculated automatically. This mirrors the receipts
                  capture form at{" "}
                  <span className="font-semibold text-emerald-300">
                    ops.betech.co.ke/receipts
                  </span>
                  .
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
                  <span className="font-semibold text-emerald-300">
                    {salesRecordsTotals.totalReceipts}
                  </span>
                </p>
                <p>
                  Total sales (KES):{" "}
                  <span className="font-semibold text-emerald-300">
                    {formatKES(salesRecordsTotals.totalSales)}
                  </span>
                </p>
                <p>
                  Total items:{" "}
                  <span className="font-semibold text-emerald-300">
                    {salesRecordsTotals.totalItems}
                  </span>
                </p>
              </div>
            </Card>

            <Card className="space-y-4 border-slate-800 bg-slate-900/80 shadow-xl shadow-black/40">
              <div className="flex flex-col gap-1">
                <p className="text-xs uppercase tracking-wide text-slate-400">
                  Online orders &amp; channels
                </p>
                <h2 className="text-lg font-semibold">Marketplace overview</h2>
                <p className="text-sm text-slate-400">
                  See how your sales are distributed across marketplaces.
                </p>
              </div>

              <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/70">
                <div className="flex items-center justify-between px-4 py-2">
                  <div>
                    <div className="text-[11px] uppercase tracking-wide text-slate-400">Platform</div>
                    <div className="text-xs text-slate-400">Assigned: <span className="text-emerald-300">{assignedShopNames || "—"}</span></div>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={selectedWeekKey}
                      onChange={(e) => {
                        const v = e.target.value;
                        setSelectedWeekKey(v);
                        void loadWeeklyEarnings(v);
                        // refresh online summary for the week range as well
                        const wk = tradingWeeks.find((w) => w.key === v);
                        if (wk) void loadOnlineSummary({ start: formatNairobiParam(wk.start, false), end: formatNairobiParam(wk.end, true) });
                      }}
                      className="rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-1 text-xs text-slate-100 outline-none"
                    >
                      {tradingWeeks.map((w) => (
                        <option key={w.key} value={w.key}>{w.label}</option>
                      ))}
                      <option value="period">This marketplace period</option>
                    </select>
                    <button
                      className="rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-1 text-xs text-slate-100"
                      onClick={() => void loadOnlineSummary()}
                    >
                      Refresh online stats
                    </button>
                  </div>
                </div>
                {onlinePlatforms.map((platform) => (
                  <div
                    key={platform.key}
                    className="grid grid-cols-4 gap-2 px-4 py-3 text-sm"
                  >
                    <span className="font-medium text-slate-100">
                      {platform.name}
                    </span>
                  <span className="text-right text-slate-200">
                    {safeNumber(platform.orders).toLocaleString()}
                  </span>
                    <span className="text-right text-emerald-300">
                      {formatKES(platform.sales)}
                    </span>
                    <span className="text-right text-slate-200">
                      {formatKES(platform.commission)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-300">
                <div>
                  <p>
                    Average order value:{" "}
                    <span className="font-semibold text-emerald-300">
                      {formatKES(averageOrderValue || 0)}
                    </span>
                  </p>
                  <p className="text-xs text-slate-500">
                    Helpful for comparing walk-in vs online performance.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  className="px-4"
                  onClick={() => void loadOnlineSummary()}
                  disabled={summaryLoading}
                >
                  {summaryLoading ? "Refreshing…" : "Refresh online stats"}
                </Button>
              </div>
            </Card>
          </div>

          <div className="space-y-4 lg:col-span-4">
            <QuickStatsCard
              variant="onlineOps"
              loading={receiptStatsLoading || summaryLoading}
              onlineOps={{
                periodLabel: periodLabel,
                jumiaSales: platformTotals.jumiaSales,
                kilimallSales: platformTotals.kilimallSales,
                directSales,
                receiptsCount,
                totalSales,
                commission,
              }}
            />

            <EarningsCard summary={mapToEarnings(payrollSummary, receiptsCount)} />

            {/* Marketplace Assigned shops card removed as requested */}
          </div>
        </div>
      </main>
    </div>
  );
}
// Marketplace Assigned shops card removed per request

function computeRangeDates(
  range: "period" | "this-week" | "last-week" | "all",
  period: { start: Date; end: Date; label: string },
) {
  if (range === "period") {
    return {
      start: formatNairobiParam(period.start, false),
      end: formatNairobiParam(period.end, true),
    };
  }
  if (range === "this-week") {
    const now = new Date();
    const day = now.getDay();
    const diffToMonday = day === 0 ? 6 : day - 1;
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - diffToMonday);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);
    return { start: formatNairobiParam(weekStart, false), end: formatNairobiParam(weekEnd, true) };
  }
  if (range === "last-week") {
    const now = new Date();
    const day = now.getDay();
    const diffToMonday = day === 0 ? 6 : day - 1;
    const thisWeekStart = new Date(now);
    thisWeekStart.setDate(now.getDate() - diffToMonday);
    thisWeekStart.setHours(0, 0, 0, 0);
    const lastWeekStart = new Date(thisWeekStart);
    lastWeekStart.setDate(thisWeekStart.getDate() - 7);
    const lastWeekEnd = new Date(lastWeekStart);
    lastWeekEnd.setDate(lastWeekStart.getDate() + 6);
    lastWeekEnd.setHours(23, 59, 59, 999);
    return { start: formatNairobiParam(lastWeekStart, false), end: formatNairobiParam(lastWeekEnd, true) };
  }
  return { start: "", end: "" };
}
