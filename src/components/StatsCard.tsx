"use client";

import Card from "@/app/_components/Card";
import SensitiveValue from "./SensitiveValue";

type StatsCardProps = {
  periodLabel: string;
  receipts: number;
  salesKes: number;
  items: number;
  commissionKes: number;
  currentSalesForTier: number;
  nextTarget: number | null;
};

export default function StatsCard({
  periodLabel,
  receipts,
  salesKes,
  items,
  commissionKes,
  currentSalesForTier,
  nextTarget,
}: StatsCardProps) {
  const hasNextTier = typeof nextTarget === "number" && nextTarget > 0;
  const remaining = hasNextTier
    ? Math.max(0, (nextTarget as number) - currentSalesForTier)
    : 0;
  const progress =
    hasNextTier && nextTarget
      ? Math.min((currentSalesForTier / nextTarget) * 100, 100)
      : 100;

  return (
    <Card className="h-full border-slate-800 bg-slate-900/80 shadow-xl shadow-black/40">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-100">Quick stats</h2>
          <p className="text-xs text-slate-400">{periodLabel}</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <StatTile label="Receipts" value={receipts} />
        <StatTile label="Sales (KES)" value={salesKes.toLocaleString()} />
        <StatTile label="Commission (KES)" value={<SensitiveValue value={commissionKes} format={(v) => Number(v).toLocaleString()} storageKey="stats:commission" />} />
        <StatTile label="Items sold" value={items} />
      </div>

      <div className="mt-6 space-y-2">
        <p className="text-xs uppercase tracking-wide text-slate-400">Progress</p>
        <p className="text-xs text-slate-200">
          {hasNextTier && remaining > 0
            ? `KES ${remaining.toLocaleString()} more to unlock the next tier`
            : "You've reached the top tier for this period"}
        </p>
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
          <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>
    </Card>
  );
}

function StatTile({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl bg-slate-950/60 px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-emerald-400">{value}</p>
    </div>
  );
}
