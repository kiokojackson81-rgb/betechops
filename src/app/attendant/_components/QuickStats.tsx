"use client";

import { useEffect, useState } from "react";
import { showToast } from "@/lib/ui/toast";

export default function QuickStats() {
  const [stats, setStats] = useState<QuickStatsPayload | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      let url = "/api/reports/summary?scope=attendant";
      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        const imp = params.get("impersonateId");
        if (imp) url += `&impersonateId=${encodeURIComponent(imp)}`;
      }
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load quick stats");
      const data = await res.json().catch(() => null);
      if (data?.quickStats) setStats(data.quickStats as QuickStatsPayload);
    } catch (err) {
      console.error(err);
      showToast(err instanceof Error ? err.message : "Failed to load quick stats", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const progress = stats && stats.nextTierThreshold > 0 ? Math.min(1, stats.salesKes / stats.nextTierThreshold) : 0;

  return (
    <div className="space-y-4 rounded-2xl border border-white/10 bg-slate-900/70 p-5 shadow-inner shadow-black/40">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Quick stats</p>
          <p className="text-sm text-slate-500">{stats?.periodLabel ?? "Current period"}</p>
          {stats?.ledgerId ? <p className="text-xs text-slate-400">Ledger: {stats.ledgerId}</p> : null}
          {stats?.commissionSource ? (
            <p className="text-xs text-slate-400">Commission source: {stats.commissionSource}</p>
          ) : null}
        </div>
        <button
          type="button"
          className="rounded-xl border border-white/10 px-3 py-1 text-xs text-slate-300 hover:bg-white/5"
          onClick={load}
          disabled={loading}
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Stat label="Receipts" value={stats?.receipts ?? 0} loading={loading} />
        <Stat label="Sales (KES)" value={stats ? stats.salesKes.toLocaleString() : 0} loading={loading} />
        <Stat label="Commission (KES)" value={stats ? stats.commissionKes.toLocaleString() : 0} loading={loading} />
        <Stat label="Items sold" value={stats?.itemsSold ?? 0} loading={loading} />
      </div>

      <div className="space-y-2">
        <p className="text-xs uppercase tracking-wide text-slate-400">To next tier</p>
        <p className="text-sm text-slate-300">
          {stats
            ? stats.remainingToNextTier <= 0
              ? "Great work! Target achieved."
              : `KES ${stats.remainingToNextTier.toLocaleString()} more to hit the next tier`
            : "-"}
        </p>
        <div className="h-2 w-full rounded-full bg-slate-800">
          <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${progress * 100}%` }} />
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, loading }: { label: string; value: number | string; loading: boolean }) {
  return (
    <div className="rounded-2xl border border-white/5 bg-slate-950/50 px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-emerald-300">{loading ? "…" : value}</p>
    </div>
  );
}

type QuickStatsPayload = {
  periodLabel: string;
  receipts: number;
  salesKes: number;
  commissionKes: number;
  itemsSold: number;
  remainingToNextTier: number;
  nextTierThreshold: number;
  ledgerId?: string | null;
  commissionSource?: string | null;
};
