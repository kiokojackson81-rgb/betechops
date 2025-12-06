"use client";

import { useEffect, useState } from "react";
import Card from "@/app/_components/Card";
import SensitiveValue from "./SensitiveValue";
import type { OnlineQuickStats } from "@/lib/onlineOps";
import { showToast } from "@/lib/ui/toast";

type Variant = "onlineOps";

export function QuickStatsCard({ variant = "onlineOps" }: { variant?: Variant }) {
  const [stats, setStats] = useState<OnlineQuickStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    if (variant !== "onlineOps") return;
    setLoading(true);
    try {
      const res = await fetch("/api/online/summary", { credentials: "same-origin", cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load quick stats");
      const data = await res.json().catch(() => null);
      setStats(data?.stats ?? null);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to load quick stats", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    const handler = () => fetchStats();
    window.addEventListener("onlineOps:refresh", handler);
    return () => window.removeEventListener("onlineOps:refresh", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Card className="border-slate-800 bg-slate-900/70 p-5 shadow-lg shadow-black/40">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Quick stats</p>
          <p className="text-sm text-slate-500">{stats?.periodLabel ?? "Current period"}</p>
        </div>
        <button
          type="button"
          className="rounded-xl border border-white/10 px-3 py-1 text-xs text-slate-300 hover:bg-white/5"
          onClick={fetchStats}
          disabled={loading}
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <StatTile label="Receipts" value={stats?.receipts ?? 0} loading={loading} />
        <StatTile label="Sales (KES)" value={formatCurrency(stats?.salesKes ?? 0)} loading={loading} />
        <StatTile
          label="Commission (KES)"
          value={
            loading
              ? "…"
              : (
                  <SensitiveValue
                    value={stats?.commissionKes ?? 0}
                    format={(v) => `KES ${Number(v).toLocaleString("en-KE")}`}
                    storageKey={`quickstats:commission:${stats?.periodLabel ?? "current"}`}
                  />
                )
          }
          loading={loading}
        />
        <StatTile label="Items sold" value={stats?.itemsSold ?? 0} loading={loading} />
      </div>

      <div className="mt-6 space-y-1.5">
        <p className="text-xs uppercase tracking-wide text-slate-400">Target progress</p>
        <div className="text-xs text-slate-400">
          {stats
            ? stats.salesKes >= stats.progressTarget
              ? "Great work! Target achieved."
              : `KES ${(stats.progressTarget - stats.salesKes).toLocaleString()} remaining`
            : "—"}
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all"
            style={{ width: `${Math.min(100, ((stats?.salesKes ?? 0) / (stats?.progressTarget || 1)) * 100)}%` }}
          />
        </div>
      </div>
    </Card>
  );
}

function StatTile({ label, value, loading }: { label: string; value: number | string; loading: boolean }) {
  return (
    <div className="rounded-2xl bg-slate-950/50 px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-emerald-400">{loading ? "…" : value}</p>
    </div>
  );
}

const formatCurrency = (val: number) => `KES ${Number(val).toLocaleString("en-KE")}`;
