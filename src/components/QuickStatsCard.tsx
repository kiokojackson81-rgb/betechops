"use client";

import { useCardLock, LockButton } from "@/app/_components/useCardLock";
import Card from "@/app/_components/Card";

function formatKES(value: number) {
  return `KES ${Number(value || 0).toLocaleString("en-KE", { maximumFractionDigits: 0 })}`;
}

type OnlineOpsQuickStats = {
  periodLabel: string;
  jumiaSales: number;
  kilimallSales: number;
  directSales: number;
  receiptsCount: number;
  totalSales: number;
  commission: number;
  toNextTier?: number;
  tierProgress?: number;
  tierMessage?: string;
};

export function QuickStatsCard({
  variant = "onlineOps",
  onlineOps = null,
  loading = false,
}: {
  variant?: "onlineOps";
  onlineOps?: OnlineOpsQuickStats | null;
  loading?: boolean;
}) {
  const { locked, toggle } = useCardLock("onlineops:quickstats");
  if (variant !== "onlineOps") return null;

  const rows = onlineOps
    ? [
        { label: "Jumia sales total", value: formatKES(onlineOps.jumiaSales) },
        { label: "Kilimall sales total", value: formatKES(onlineOps.kilimallSales) },
        { label: "Direct sales", value: formatKES(onlineOps.directSales) },
        { label: "Receipts", value: Number(onlineOps.receiptsCount || 0).toLocaleString("en-KE") },
        { label: "Total sales", value: formatKES(onlineOps.totalSales) },
        { label: "Commission", value: formatKES(onlineOps.commission) },
      ]
    : [];

  const progress = onlineOps?.tierProgress ?? 0;

  return (
    <Card className="space-y-4 border-slate-800 bg-slate-900/80 shadow-xl shadow-black/40">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-100">Quick stats</h2>
          <p className="text-xs text-slate-400">
            {onlineOps?.periodLabel ?? (loading ? "Loading." : "No data")}
            {loading ? "  Refreshing." : ""}
          </p>
        </div>
        <LockButton locked={locked} onToggle={toggle} />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {rows.length === 0 && (
          <div className="col-span-1 sm:col-span-2 text-sm text-slate-400">
            {loading ? "Loading stats." : "No stats available"}
          </div>
        )}
        {rows.map((row) => (
          <div key={row.label} className="rounded-2xl bg-slate-950/60 px-3 py-3">
            <p className="text-[10px] uppercase tracking-wide text-slate-400">{row.label}</p>
            <p className="mt-1 text-lg font-semibold text-emerald-300">{locked ? "" : row.value}</p>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <p className="text-[10px] uppercase tracking-wide text-slate-400">To next tier</p>
        <p className="text-base font-semibold text-slate-100">
          {locked
            ? ""
            : onlineOps?.tierMessage ??
              (onlineOps?.toNextTier != null
                ? `${formatKES(onlineOps.toNextTier)} more to hit next tier`
                : "KES 0 more to hit next tier")}
        </p>
        <p className="text-[11px] text-slate-400">Memo ladder only; discretionary &amp; may be withheld.</p>
        <div className="h-2 rounded-full bg-slate-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-200"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
      </div>
    </Card>
  );
}

export default QuickStatsCard;
