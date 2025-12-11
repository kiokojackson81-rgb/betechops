"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ReceiptFormClient from "@/app/receipts/ReceiptFormClient";
import ReceiptsPageClient from "@/app/receipts/ReceiptsPageClient";
import { getTradingPeriodFor } from "@/lib/tradingPeriod";
import { showToast } from "@/lib/ui/toast";

type ReceiptStatsRow = {
  id: string;
  total?: number | null;
  items?: any[];
};

type ShopSummary = {
  id: string;
  name?: string | null;
  platform?: string | null;
};

const COMMISSION_RATE = 0.02;

const formatKES = (value: number) =>
  `KES ${value.toLocaleString("en-KE", { maximumFractionDigits: 0 })}`;

export default function AttendantOnlineClient({ initial = [] as any[] }) {
  const [view, setView] = useState<"create" | "list">("create");
  const [period] = useState(() => getTradingPeriodFor(new Date()));
  const [receipts, setReceipts] = useState<ReceiptStatsRow[]>([]);
  const [statsLoading, setStatsLoading] = useState(false);
  const [shops, setShops] = useState<ShopSummary[]>([]);
  const [shopsLoading, setShopsLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

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
    setStatsLoading(true);
    try {
      const params = new URLSearchParams({
        start: period.start.toISOString(),
        end: period.end.toISOString(),
        includeItems: "true",
        size: "200",
      });
      if (userId) params.set("attendantId", userId);
      const res = await fetch(`/api/receipts?${params.toString()}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load receipts for this period");
      const data = (await res.json()) as { receipts?: ReceiptStatsRow[] };
      setReceipts(Array.isArray(data.receipts) ? data.receipts : []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load receipt totals";
      showToast(message, "error");
    } finally {
      setStatsLoading(false);
    }
  }, [period, userId]);

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

  useEffect(() => {
    fetchUser();
    loadShops();
  }, [fetchUser, loadShops]);

  useEffect(() => {
    void loadReceiptStats();
  }, [loadReceiptStats]);

  const receiptTotals = useMemo(() => {
    const totalSales = receipts.reduce((sum, receipt) => sum + (Number(receipt.total) || 0), 0);
    const totalItems = receipts.reduce((sum, receipt) => sum + (Array.isArray(receipt.items) ? receipt.items.length : 0), 0);
    return { totalSales, totalItems, totalReceipts: receipts.length };
  }, [receipts]);

  const earnings = useMemo(() => receiptTotals.totalSales * COMMISSION_RATE, [receiptTotals.totalSales]);

  return (
    <div className="min-h-screen bg-slate-950 px-4 pb-16 text-slate-50">
      <div className="mx-auto w-full max-w-6xl space-y-8 pt-8">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-emerald-400">Sales records</p>
          <h1 className="text-2xl font-semibold sm:text-3xl">Add each receipt for today</h1>
          <p className="text-sm text-slate-300">Totals are calculated automatically. Quick stats and earnings in this period are driven by the receipts, assigned shops and online accounts you are tied to.</p>
        </header>

        <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-emerald-400">Quick stats</p>
              <p className="text-sm text-slate-400">Period: {period.label}</p>
            </div>
            <div className="text-sm text-slate-400">{statsLoading ? "Refreshing receipt totals…" : `${receiptTotals.totalReceipts} receipts summarized`}</div>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="rounded-xl bg-slate-950/40 p-3">
              <p className="text-xs uppercase text-slate-400">Receipts</p>
              <p className="mt-1 text-2xl font-semibold text-emerald-400">{receiptTotals.totalReceipts}</p>
            </div>
            <div className="rounded-xl bg-slate-950/40 p-3">
              <p className="text-xs uppercase text-slate-400">Sales (KES)</p>
              <p className="mt-1 text-2xl font-semibold text-emerald-400">{formatKES(receiptTotals.totalSales)}</p>
            </div>
            <div className="rounded-xl bg-slate-950/40 p-3">
              <p className="text-xs uppercase text-slate-400">Items</p>
              <p className="mt-1 text-2xl font-semibold text-emerald-400">{receiptTotals.totalItems}</p>
            </div>
          </div>
          <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-sm text-slate-300">
            <p>Earnings this period</p>
            <p className="mt-1 text-2xl font-semibold text-emerald-400">{formatKES(earnings)}</p>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Commission ({(COMMISSION_RATE * 100).toFixed(0)}%)</p>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-emerald-400">Assigned shops</p>
              <p className="text-sm text-slate-400">Sales and online activity are pulled from these locations and the linked admin panel.</p>
            </div>
            {shopsLoading && <span className="text-xs text-slate-400">Loading shops…</span>}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {shops.length === 0 && !shopsLoading ? (
              <span className="rounded-full border border-white/20 px-4 py-2 text-xs text-slate-500">No active shop assignments</span>
            ) : (
              shops.map((shop) => (
                <span
                  key={shop.id}
                  className="rounded-full border border-emerald-500/50 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-200"
                >
                  {shop.name || "Unnamed shop"}{shop.platform ? ` (${shop.platform})` : ""}
                </span>
              ))
            )}
          </div>
        </section>

        <div className="space-y-6">
          <section id="receipt-create" className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-xl shadow-black/40">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Receipts desk</p>
                <h2 className="text-xl font-semibold text-white">Betech Customers Operations</h2>
                <p className="text-sm text-slate-400">Track every printable document, search by customer, and open the PDF drawer without leaving this page.</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className={`rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-white/10 ${view === "create" ? "bg-white/5" : ""}`}
                  onClick={() => setView("create")}
                >
                  Create
                </button>
                <button
                  type="button"
                  className={`rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-black hover:brightness-95 ${view === "list" ? "ring-2 ring-emerald-300" : ""}`}
                  onClick={() => setView((v) => (v === "list" ? "create" : "list"))}
                >
                  View receipts
                </button>
              </div>
            </div>
            <div className="mt-4">
              <ReceiptFormClient />
            </div>
          </section>

          {view === "list" && (
            <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
              <ReceiptsPageClient initial={initial} />
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
