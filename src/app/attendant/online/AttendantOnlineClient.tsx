"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Card from "@/app/_components/Card";
import Button from "@/app/_components/Button";
import { getTradingPeriodFor } from "@/lib/tradingPeriod";
import { showToast } from "@/lib/ui/toast";
import { useCardLock, LockButton } from "@/app/_components/useCardLock";

type ShopSummary = {
  id: string;
  name?: string | null;
  platform?: string | null;
};

type OnlinePlatformKey = "JUMIA" | "KILIMALL" | "WEBSITE" | "OTHER";

type OnlinePlatformSummary = {
  key: OnlinePlatformKey;
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

type ReceiptStatsRow = {
  id: string;
  total?: number | null;
  items?: any[];
};

type ReceiptTotals = {
  totalReceipts: number;
  totalSales: number;
  totalItems: number;
};

type ManualSaleRow = {
  id: string;
  shopId: string | null;
  amount: number;
  weekStart: string;
  weekEnd: string;
  platform: string | null;
  status: string | null;
  shop?: { id: string; name: string | null; platform: string | null };
};

type TradingWeek = {
  key: string;
  label: string;
  display: string;
  startInput: string;
  endInput: string;
  start: Date;
  end: Date;
};

const COMMISSION_RATE = 0.02;

const formatKES = (value: number | null | undefined) =>
  `KES ${Number(value ?? 0).toLocaleString("en-KE", { maximumFractionDigits: 0 })}`;

const toInputDate = (date: Date) => date.toISOString().slice(0, 10);
const formatShort = (date: Date) =>
  date.toLocaleDateString("en-KE", { day: "2-digit", month: "short" });

function buildTradingWeeks(reference = new Date()) {
  const now = new Date(reference);
  now.setHours(0, 0, 0, 0);

  const weeks: TradingWeek[] = [];
  const offsets = [
    { label: "Week 1", start: -30, end: -26 },
    { label: "Week 2", start: -25, end: -18 },
    { label: "Week 3", start: -17, end: -10 },
    { label: "Week 4", start: -9, end: -2 },
  ];

  for (const { label, start, end } of offsets) {
    const startDate = new Date(now);
    startDate.setDate(now.getDate() + start);
    const endDate = new Date(now);
    endDate.setDate(now.getDate() + end);
    weeks.push({
      key: `${label.toLowerCase().replace(" ", "-")}-${toInputDate(startDate)}`,
      label,
      display: `${formatShort(startDate)} - ${formatShort(endDate)}`,
      startInput: toInputDate(startDate),
      endInput: toInputDate(endDate),
      start: startDate,
      end: endDate,
    });
  }

  let defaultWeek = weeks[weeks.length - 1];
  for (const wk of weeks) {
    if (wk.end.getTime() < now.getTime()) {
      defaultWeek = wk;
    }
  }

  return { weeks, defaultWeek };
}

export default function AttendantOnlineClient({ initial = [] as any[] }) {
  const [period] = useState(() => getTradingPeriodFor(new Date()));
  const [shops, setShops] = useState<ShopSummary[]>([]);
  const [shopsLoading, setShopsLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [onlineSummary, setOnlineSummary] = useState<OnlineSummaryResponse | null>(
    null,
  );
  const [summaryLoading, setSummaryLoading] = useState(false);

  const [receiptTotals, setReceiptTotals] = useState<ReceiptTotals>({
    totalReceipts: 0,
    totalSales: 0,
    totalItems: 0,
  });
  const [receiptLoading, setReceiptLoading] = useState(false);

  const [manualSales, setManualSales] = useState<ManualSaleRow[]>([]);
  const [manualLoading, setManualLoading] = useState(false);
  const [manualPeriodTotal, setManualPeriodTotal] = useState(0);
  const [manualAllTimeTotal, setManualAllTimeTotal] = useState(0);

  const tradingWeeks = useMemo(() => buildTradingWeeks(), []);
  const defaultWeekKey =
    tradingWeeks.defaultWeek?.key ?? tradingWeeks.weeks[0]?.key ?? "";
  const [selectedWeekKey, setSelectedWeekKey] = useState(defaultWeekKey);
  const selectedWeek = useMemo(
    () =>
      tradingWeeks.weeks.find((week) => week.key === selectedWeekKey) ??
      tradingWeeks.defaultWeek ??
      tradingWeeks.weeks[0],
    [tradingWeeks, selectedWeekKey],
  );

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

  const loadShops = useCallback(async () => {
    setShopsLoading(true);
    try {
      const res = await fetch("/api/attendants/shops", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load assigned shops");
      const data = (await res.json()) as ShopSummary[];
      setShops(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("[attendant/online] failed to load shops", err);
    } finally {
      setShopsLoading(false);
    }
  }, []);

  const loadOnlineSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const params = new URLSearchParams({
        start: period.start.toISOString(),
        end: period.end.toISOString(),
      });
      if (userId) params.set("attendantId", userId);

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
      console.warn("[attendant/online] summary error", err);
      showToast(message, "error");
    } finally {
      setSummaryLoading(false);
    }
  }, [period, userId]);

  const loadReceiptStats = useCallback(async () => {
    if (!userId) return;
    setReceiptLoading(true);
    try {
      const params = new URLSearchParams({
        start: period.start.toISOString(),
        end: period.end.toISOString(),
        includeItems: "true",
        size: "200",
      });
      if (userId) params.set("attendantId", userId);

      const res = await fetch(`/api/receipts?${params.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to load receipt totals");
      const data = (await res.json()) as { receipts?: ReceiptStatsRow[] };
      const receipts = Array.isArray(data.receipts) ? data.receipts : [];
      const totalSales = receipts.reduce((sum, receipt) => sum + (Number(receipt.total) || 0), 0);
      const totalItems = receipts.reduce(
        (sum, receipt) => sum + (Array.isArray(receipt.items) ? receipt.items.length : 0),
        0,
      );
      setReceiptTotals({
        totalReceipts: receipts.length,
        totalSales,
        totalItems,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unable to load receipt totals";
      showToast(message, "error");
      console.error("[attendant/online] receipt totals error", err);
    } finally {
      setReceiptLoading(false);
    }
  }, [period, userId]);

  const loadManualSales = useCallback(
    async (week: TradingWeek | null) => {
      if (!userId) return;
      setManualLoading(true);
      try {
        const params = new URLSearchParams();
        if (week?.startInput) params.set("weekStart", week.startInput);
        if (week?.endInput) params.set("weekEnd", week.endInput);

        const query = params.toString();
        const suffix = query ? `?${query}` : "";
        const res = await fetch(`/api/attendant/online/manual-sales${suffix}`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error("Failed to load shop sales");
        const data = (await res.json()) as {
          entries?: ManualSaleRow[];
          periodTotal?: number;
          totalToDate?: number;
        };
        setManualSales(Array.isArray(data.entries) ? data.entries : []);
        setManualPeriodTotal(data.periodTotal ?? 0);
        setManualAllTimeTotal(data.totalToDate ?? 0);
      } catch (err) {
        console.error("[attendant/online] manual sales error", err);
      } finally {
        setManualLoading(false);
      }
    },
    [userId],
  );

  useEffect(() => {
    fetchUser();
    loadShops();
  }, [fetchUser, loadShops]);

  useEffect(() => {
    if (!userId) return;
    void loadOnlineSummary();
    void loadReceiptStats();
  }, [loadOnlineSummary, loadReceiptStats, userId]);

  useEffect(() => {
    if (!userId) return;
    void loadManualSales(selectedWeek ?? null);
  }, [loadManualSales, selectedWeek, userId]);

  const periodLabel = onlineSummary?.period.label ?? period.label;
  const totals = onlineSummary?.totals ?? {
    orders: 0,
    sales: 0,
    commission: 0,
  };
  const platforms = onlineSummary?.platforms ?? [];

  const averageOrderValue = useMemo(
    () => (totals.orders > 0 ? totals.sales / totals.orders : 0),
    [totals.orders, totals.sales],
  );

  const manualSalesByShop = useMemo(() => {
    const map = new Map<string, { amount: number; entries: ManualSaleRow[] }>();
    manualSales.forEach((entry) => {
      if (!entry.shopId) return;
      const existing = map.get(entry.shopId) ?? { amount: 0, entries: [] };
      existing.amount += entry.amount;
      existing.entries.push(entry);
      map.set(entry.shopId, existing);
    });
    return map;
  }, [manualSales]);

  const shopSummaries = useMemo(() => {
    const summary = shops.map((shop) => {
      const manual = manualSalesByShop.get(shop.id);
      return {
        ...shop,
        amount: manual?.amount ?? 0,
      };
    });
    return [...summary].sort((a, b) => b.amount - a.amount);
  }, [shops, manualSalesByShop]);

  const mainPlatforms = useMemo(
    () =>
      platforms.length > 0
        ? platforms
        : [
            {
              key: "JUMIA" as OnlinePlatformKey,
              name: "Jumia",
              orders: 0,
              sales: 0,
              commission: 0,
            },
            {
              key: "KILIMALL" as OnlinePlatformKey,
              name: "Kilimall",
              orders: 0,
              sales: 0,
              commission: 0,
            },
          ],
    [platforms],
  );

  const { locked, toggle } = useCardLock("online:quickstats");
  const mask = (value: ReactNode) => (locked ? "•••" : value);

  const quickStats = [
    { label: "Orders", value: totals.orders.toLocaleString() },
    { label: "Sales (KES)", value: formatKES(totals.sales) },
    { label: "Commission (KES)", value: formatKES(totals.commission) },
    { label: "Avg. order value", value: formatKES(averageOrderValue || 0) },
    { label: "Receipts", value: receiptTotals.totalReceipts.toLocaleString() },
    { label: "Items sold", value: receiptTotals.totalItems.toLocaleString() },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <main className="mx-auto max-w-6xl space-y-6 p-6">
        <header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold">Online Operations</h1>
            <p className="text-sm text-slate-300">
              Track marketplace orders (Jumia, Kilimall, website), commissions,
              and assigned online shops in one place.
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
                Trading period
              </p>
              <p className="mt-1 text-sm text-slate-200">{periodLabel}</p>
              <p className="text-xs text-slate-400">
                Online stats are pulled from linked marketplaces for this period.
              </p>
            </div>
            <div className="text-right space-y-1 text-sm text-slate-300">
              <p>
                Total orders:{" "}
                <span className="font-semibold text-emerald-300">
                  {totals.orders.toLocaleString()}
                </span>
              </p>
              <p>
                Total sales:{" "}
                <span className="font-semibold text-emerald-300">
                  {formatKES(totals.sales)}
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
            <Card className="space-y-5 border-slate-800 bg-slate-900/60 shadow-xl shadow-black/20">
              <div className="flex flex-col gap-1">
                <p className="text-xs uppercase tracking-wide text-slate-400">
                  Marketplace overview
                </p>
                <h2 className="text-xl font-semibold text-slate-100">
                  Online orders & channels
                </h2>
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
                {mainPlatforms.length === 0 ? (
                  <div className="px-4 py-4 text-sm text-slate-400">
                    No marketplace data for this period yet.
                  </div>
                ) : (
                  <ul className="divide-y divide-slate-800">
                    {mainPlatforms.map((platform) => (
                      <li
                        key={platform.key}
                        className="grid grid-cols-4 gap-2 px-4 py-3 text-sm"
                      >
                        <span className="font-medium text-slate-100">
                          {platform.name}
                        </span>
                        <span className="text-right text-slate-200">
                          {platform.orders.toLocaleString()}
                        </span>
                        <span className="text-right text-emerald-300">
                          {formatKES(platform.sales)}
                        </span>
                        <span className="text-right text-slate-200">
                          {formatKES(platform.commission)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
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

            <Card className="space-y-6 border-slate-800 bg-slate-900/70 shadow-xl shadow-black/20">
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                  Sales records
                </p>
                <h2 className="text-xl font-semibold text-white">
                  Add each receipt for today
                </h2>
                <p className="text-sm text-slate-400">
                  Totals are calculated automatically. Receipts are generated in{" "}
                  <span className="font-medium text-emerald-300">/receipts</span>.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  {
                    label: "Total receipts",
                    value: receiptTotals.totalReceipts.toLocaleString(),
                  },
                  {
                    label: "Total sales (KES)",
                    value: formatKES(receiptTotals.totalSales),
                  },
                  {
                    label: "Total items",
                    value: receiptTotals.totalItems.toLocaleString(),
                  },
                  {
                    label: "Commission (KES)",
                    value: formatKES(receiptTotals.totalSales * COMMISSION_RATE),
                  },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-2xl border border-white/5 bg-slate-950/60 p-4 text-sm"
                  >
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
                      {stat.label}
                    </p>
                    <p className="mt-1 text-xl font-semibold text-emerald-300">
                      {stat.value}
                    </p>
                  </div>
                ))}
              </div>

              <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4 text-sm text-slate-300">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
                  Receipt snapshot
                </p>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div className="rounded-xl border border-white/10 bg-slate-900/40 px-3 py-2">
                    <p className="text-[11px] uppercase tracking-wide text-slate-500">
                      Selling total (KES)
                    </p>
                    <p className="mt-1 text-lg font-semibold text-slate-100">
                      0
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-slate-900/40 px-3 py-2">
                    <p className="text-[11px] uppercase tracking-wide text-slate-500">
                      Receipt number
                    </p>
                    <p className="mt-1 text-lg font-semibold text-slate-100">
                      Required
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-white/20 px-4 py-1 text-xs text-slate-300">
                    MPESA
                  </span>
                  <span className="rounded-full border border-white/20 px-4 py-1 text-xs text-slate-300">
                    Cash
                  </span>
                </div>
                <div className="mt-3 rounded-xl border border-white/10 bg-black/40 p-3 text-[11px] uppercase tracking-[0.3em] text-slate-500">
                  Products in this receipt are managed from the receipts desk.
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm text-slate-400">
                  Total receipts: <span className="font-semibold text-white">{receiptTotals.totalReceipts}</span>
                  <br />
                  Total sales (KES):{" "}
                  <span className="font-semibold text-emerald-300">
                    {formatKES(receiptTotals.totalSales)}
                  </span>
                  <br />
                  Total items:{" "}
                  <span className="font-semibold text-white">{receiptTotals.totalItems}</span>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    window.location.href = "/receipts";
                  }}
                >
                  Open receipts desk
                </Button>
              </div>
            </Card>
          </div>

          <div className="space-y-4 lg:col-span-4">
            <Card className="space-y-5 border-slate-800 bg-slate-900/80 shadow-xl shadow-black/40">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-slate-100">
                    Quick stats
                  </h2>
                  <p className="text-xs text-slate-400">{periodLabel}</p>
                </div>
                <LockButton locked={locked} onToggle={toggle} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {quickStats.map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-2xl bg-slate-950/60 px-3 py-2 text-left"
                  >
                    <p className="text-[10px] uppercase tracking-wide text-slate-400">
                      {stat.label}
                    </p>
                    <p className="mt-1 text-lg font-semibold text-emerald-400">
                      {mask(stat.value)}
                    </p>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="space-y-5 border-slate-800 bg-slate-900/80 shadow-xl shadow-black/40">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-emerald-400">
                    Earnings this period
                  </p>
                  <h2 className="text-lg font-semibold text-slate-100">
                    Shop sales (manual)
                  </h2>
                  <p className="text-sm text-slate-400">
                    {selectedWeek?.display ?? periodLabel} · Totals come from{" "}
                    <span className="font-medium text-emerald-300">
                      /admin/online/manual
                    </span>
                  </p>
                </div>
                <select
                  value={selectedWeekKey}
                  onChange={(event) => setSelectedWeekKey(event.target.value)}
                  className="rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2 text-sm text-slate-100"
                >
                  {tradingWeeks.weeks.map((week) => (
                    <option key={week.key} value={week.key}>
                      {week.label} ({week.display})
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-300">
                <div>
                  <p>
                    Period manual sales:{" "}
                    <span className="font-semibold text-emerald-300">
                      {formatKES(manualPeriodTotal)}
                    </span>
                  </p>
                  <p className="text-xs text-slate-500">
                    Total since onboarding: {formatKES(manualAllTimeTotal)}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  className="px-4"
                  onClick={() => void loadManualSales(selectedWeek ?? null)}
                  disabled={manualLoading}
                >
                  {manualLoading ? "Refreshing…" : "Refresh shop sales"}
                </Button>
              </div>
              <div className="space-y-2">
                {shopSummaries.length === 0 && !shopsLoading && (
                  <div className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-slate-400">
                    No shops assigned yet.
                  </div>
                )}
                {shopsLoading && (
                  <div className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-slate-400">
                    Loading shops…
                  </div>
                )}
                {shopSummaries.map((shop) => (
                  <div
                    key={shop.id}
                    className="rounded-2xl border border-white/5 bg-slate-950/40 px-4 py-3 text-sm text-slate-200"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-white">
                          {shop.name || "Unnamed shop"}
                        </p>
                        <p className="text-xs text-slate-400">
                          {shop.platform || "Platform"} · Manual totals
                        </p>
                      </div>
                      <span className="text-sm font-semibold text-emerald-300">
                        {formatKES(shop.amount)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
