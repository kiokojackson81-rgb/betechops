"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Card from "@/app/_components/Card";
import Button from "@/app/_components/Button";
import { getTradingPeriodFor } from "@/lib/tradingPeriod";
import { showToast } from "@/lib/ui/toast";

type ShopSummary = {
  id: string;
  name?: string | null;
  platform?: string | null;
};

// Extend this union with any other known marketplaces you track
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

const formatKES = (value: number) =>
  `KES ${value.toLocaleString("en-KE", { maximumFractionDigits: 0 })}`;

export default function AttendantOnlineClient({ initial = [] as any[] }) {
  const [period] = useState(() => getTradingPeriodFor(new Date()));
  const [shops, setShops] = useState<ShopSummary[]>([]);
  const [shopsLoading, setShopsLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const [onlineSummary, setOnlineSummary] = useState<OnlineSummaryResponse | null>(
    null,
  );
  const [summaryLoading, setSummaryLoading] = useState(false);

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
      console.warn("[attendant/online] failed to load shops", err);
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

  useEffect(() => {
    fetchUser();
    loadShops();
  }, [fetchUser, loadShops]);

  useEffect(() => {
    void loadOnlineSummary();
  }, [loadOnlineSummary, period, userId]);

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
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-slate-950/60 px-3 py-2 text-left">
                  <p className="text-[10px] uppercase tracking-wide text-slate-400">
                    Orders
                  </p>
                  <p className="mt-1 text-lg font-semibold text-emerald-400">
                    {totals.orders.toLocaleString()}
                  </p>
                </div>
                <div className="rounded-2xl bg-slate-950/60 px-3 py-2 text-left">
                  <p className="text-[10px] uppercase tracking-wide text-slate-400">
                    Sales (KES)
                  </p>
                  <p className="mt-1 text-lg font-semibold text-emerald-400">
                    {formatKES(totals.sales)}
                  </p>
                </div>
                <div className="rounded-2xl bg-slate-950/60 px-3 py-2 text-left">
                  <p className="text-[10px] uppercase tracking-wide text-slate-400">
                    Commission (KES)
                  </p>
                  <p className="mt-1 text-lg font-semibold text-emerald-400">
                    {formatKES(totals.commission)}
                  </p>
                </div>
                <div className="rounded-2xl bg-slate-950/60 px-3 py-2 text-left">
                  <p className="text-[10px] uppercase tracking-wide text-slate-400">
                    Avg. order value
                  </p>
                  <p className="mt-1 text-lg font-semibold text-emerald-400">
                    {formatKES(averageOrderValue || 0)}
                  </p>
                </div>
              </div>
            </Card>

            <Card className="border-slate-800 bg-slate-900/80 shadow-xl shadow-black/40">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-emerald-400">
                    Assigned shops
                  </p>
                  <p className="text-sm text-slate-400">
                    Online sales are mapped to these locations and accounts.
                  </p>
                </div>
                {shopsLoading && (
                  <span className="text-xs text-slate-400">Loading shops…</span>
                )}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {shops.length === 0 && !shopsLoading ? (
                  <span className="rounded-full border border-white/20 px-4 py-2 text-xs text-slate-500">
                    No active shop assignments
                  </span>
                ) : (
                  shops.map((shop) => (
                    <span
                      key={shop.id}
                      className="rounded-full border border-emerald-500/50 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-200"
                    >
                      {shop.name || "Unnamed shop"}
                      {shop.platform ? ` (${shop.platform})` : ""}
                    </span>
                  ))
                )}
              </div>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
