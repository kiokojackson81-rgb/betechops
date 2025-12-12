"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Card from "@/app/_components/Card";
import Button from "@/app/_components/Button";
import ReceiptsEditor from "@/app/_components/ReceiptsEditor";
import SensitiveValue from "@/components/SensitiveValue";
import { useCardLock, LockButton } from "@/app/_components/useCardLock";
import { getTradingPeriodFor } from "@/lib/tradingPeriod";
import { showToast } from "@/lib/ui/toast";

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

  const [receiptRows, setReceiptRows] = useState<ReceiptStatsRow[]>([]);
  const [statsLoading, setStatsLoading] = useState(false);

  const [receiptsEditorRows, setReceiptsEditorRows] = useState<ReceiptRow[]>([
    createReceipt(),
  ]);

  const [onlineSummary, setOnlineSummary] = useState<OnlineSummaryResponse | null>(
    null,
  );
  const [summaryLoading, setSummaryLoading] = useState(false);

  const [shopSalesRows, setShopSalesRows] = useState<ShopSalesRow[]>([]);
  const [shopSalesLoading, setShopSalesLoading] = useState(false);
  const [shopRange, setShopRange] = useState<"period" | "this-week" | "all">(
    "period",
  );
  const [shopPeriodLabel, setShopPeriodLabel] = useState(period.label);
  const [shopPeriodTotal, setShopPeriodTotal] = useState(0);
  const [shopAllTimeTotal, setShopAllTimeTotal] = useState(0);

  const [earningsSummary, setEarningsSummary] =
    useState<OnlineEarningsSummary | null>(null);

  const fetchUser = useCallback(async () => {
    try {
      const res = await fetch("/api/attendants/me", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      if (data?.user?.id) setUserId(data.user.id);
    } catch (err) {
      console.warn("[attendant/online] failed to load user", err);
    }
  }, []);

  const loadReceiptStats = useCallback(async () => {
    if (!userId) return;
    setStatsLoading(true);
    try {
        const params = new URLSearchParams({
          start: formatNairobiParam(period.start, false),
          end: formatNairobiParam(period.end, true),
          includeItems: "true",
          size: "200",
        });
      params.set("attendantId", userId);
      const res = await fetch(`/api/receipts?${params.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to load receipts for this period");
      const data = (await res.json()) as { receipts?: ReceiptStatsRow[] };
      setReceiptRows(Array.isArray(data.receipts) ? data.receipts : []);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unable to load receipt totals";
      showToast(message, "error");
    } finally {
      setStatsLoading(false);
    }
  }, [period, userId]);

  const loadOnlineSummary = useCallback(async () => {
    if (!userId) return;
    setSummaryLoading(true);
    try {
      const params = new URLSearchParams({
        start: formatNairobiParam(period.start, false),
        end: formatNairobiParam(period.end, true),
      });
      params.set("attendantId", userId);
      const res = await fetch(`/api/online/summary?${params.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to load online sales summary");
      const data = (await res.json()) as OnlineSummaryResponse;
      setOnlineSummary(data);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Unable to load online sales summary";
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

  const loadEarnings = useCallback(async () => {
    try {
      const res = await fetch("/api/online/earnings/summary", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as OnlineEarningsSummary;
      setEarningsSummary(data);
    } catch (err) {
      console.warn("[attendant/online] earnings summary error", err);
    }
  }, []);

  const receiptTotals = useMemo(() => {
    const totalSales = receiptRows.reduce(
      (sum, receipt) => sum + (Number(receipt.total) || 0),
      0,
    );
    const totalItems = receiptRows.reduce(
      (sum, receipt) => sum + (Array.isArray(receipt.items) ? receipt.items.length : 0),
      0,
    );
    // compute profit: if any item in a receipt lacks a buyingPrice, treat profit for that receipt as 0
    let totalProfit = 0;
    for (const receipt of receiptRows) {
      const items = Array.isArray(receipt.items) ? receipt.items : [];
      if (items.length === 0) continue;
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
        const sale = Number(receipt.total ?? 0);
        totalProfit += Math.max(0, sale - buyingSum);
      }
    }

    return {
      totalSales,
      totalItems,
      totalReceipts: receiptRows.length,
      commission: totalSales * COMMISSION_RATE,
      totalProfit,
    };
  }, [receiptRows]);

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

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  useEffect(() => {
    if (!userId) return;
    void loadReceiptStats();
    void loadOnlineSummary();
    void loadShopSales();
  }, [loadOnlineSummary, loadReceiptStats, loadShopSales, userId]);

  useEffect(() => {
    void loadEarnings();
  }, [loadEarnings]);

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

        <Card className="border-slate-800 bg-slate-950/70">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">
                Earnings period
              </p>
              <p className="mt-1 text-sm text-slate-200">{periodLabel}</p>
              <p className="text-xs text-slate-400">
                Attached to payroll. Marketplace totals and shop sales are
                calculated within this window.
              </p>
            </div>
              <div className="text-right text-sm text-slate-300">
                <p>
                  Marketplace orders:{" "}
                  <span className="font-semibold text-emerald-300">
                    {safeNumber(onlineTotals.orders).toLocaleString()}
                  </span>
                </p>
              <p>
                Marketplace sales:{" "}
                <span className="font-semibold text-emerald-300">
                  {formatKES(onlineTotals.sales)}
                </span>
              </p>
              <p className="text-xs text-slate-500">
                {summaryLoading ? "Refreshing online summary…" : "Up to date"}
              </p>
            </div>
          </div>
        </Card>

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
                <div className="grid grid-cols-4 gap-2 border-b border-slate-800 bg-slate-900/70 px-4 py-2 text-[11px] uppercase tracking-wide text-slate-400">
                  <span>Platform</span>
                  <span className="text-right">Orders</span>
                  <span className="text-right">Sales (KES)</span>
                  <span className="text-right">Commission</span>
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
              statsLoading={statsLoading}
              periodLabel={periodLabel}
              totals={receiptTotals}
            />
            <OnlineEarningsCard summary={earningsSummary} />
            <ShopSalesCard
              rows={shopSalesRows}
              total={shopRange === "all" ? shopAllTimeTotal : shopPeriodTotal}
              loading={shopSalesLoading}
              range={shopRange}
              onRangeChange={(value) => setShopRange(value)}
              onRefresh={loadShopSales}
              periodLabel={shopPeriodLabel}
            />
          </div>
        </div>
      </main>
    </div>
  );
}

function QuickStatsCard({
  statsLoading,
  periodLabel,
  totals,
}: {
  statsLoading: boolean;
  periodLabel: string;
  totals: {
    totalReceipts: number;
    totalSales: number;
    totalItems: number;
    commission: number;
    totalProfit?: number;
  };
}) {
  const { locked, toggle } = useCardLock("online:quickstats");
  const mask = (value: ReactNode) => (locked ? "•••" : value);

  const stats = [
    {
      label: "Receipts",
      value: safeNumber(totals.totalReceipts).toLocaleString(),
    },
    { label: "Sales (KES)", value: formatKES(totals.totalSales) },
    { label: "Profit (KES)", value: formatKES(totals.totalProfit ?? 0) },
    {
      label: "Items sold",
      value: safeNumber(totals.totalItems).toLocaleString(),
    },
    {
      label: "Commission (KES)",
      value: (
        <SensitiveValue
          value={totals.commission}
          format={(v) => `KES ${safeNumber(Number(v)).toLocaleString()}`}
          storageKey="online:commission"
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
            {periodLabel} •{" "}
            {statsLoading ? "Refreshing receipt totals…" : "Receipts summary"}
          </p>
        </div>
        <LockButton locked={locked} onToggle={toggle} />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-2xl bg-slate-950/60 px-3 py-2 text-left"
          >
            <p className="text-[10px] uppercase tracking-wide text-slate-400">
              {stat.label}
            </p>
            <p className="mt-1 text-lg font-semibold text-emerald-400">
              {typeof stat.value === "string" || typeof stat.value === "number"
                ? mask(stat.value)
                : stat.value}
            </p>
          </div>
        ))}
      </div>
    </Card>
  );
}

function OnlineEarningsCard({ summary }: { summary: OnlineEarningsSummary | null }) {
  const { locked, toggle } = useCardLock("online:earnings");
  if (!summary) return null;
  const mask = (value: ReactNode) => (locked ? "•••" : value);
  const formatCurrency = (value: number) => `KES ${safeNumber(value).toLocaleString()}`;

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
          <p className="text-[11px] uppercase tracking-wide text-slate-400">
            Net pay
          </p>
          <p className="text-2xl font-semibold text-emerald-300">
            {mask(formatCurrency(summary.netPay))}
          </p>
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
          <p className="text-xs uppercase tracking-wide text-emerald-400">
            Shop sales
          </p>
          <p className="text-sm text-slate-400">
            Manual entries from <span className="font-semibold">/admin/online/manual</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={range}
            onChange={(event) =>
              onRangeChange(event.target.value as "period" | "this-week" | "all")
            }
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

      <div className="space-y-2 overflow-y-auto rounded-2xl border border-slate-800 bg-slate-950/70 p-3 text-sm max-h-80">
        {rows.length === 0 && !loading && (
          <p className="text-xs text-slate-400">
            No shop sales were reported for this range.
          </p>
        )}
        {rows.map((shop) => (
          <div
            key={shop.id}
            className="space-y-1 rounded-xl bg-slate-900/80 px-3 py-2"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-100">{shop.name}</p>
                <p className="text-[11px] text-slate-400">
                  {shop.country} • {shop.currency} • {shop.status} •{" "}
                  {shop.platform.toLowerCase()}
                </p>
              </div>
              <p className="text-sm font-semibold text-emerald-300">
                {formatKES(shop.totalSales)}
              </p>
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

function computeRangeDates(
  range: "period" | "this-week" | "all",
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
  return { start: "", end: "" };
}
