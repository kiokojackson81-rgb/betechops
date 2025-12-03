"use client";

type StatsCardProps = {
  periodLabel: string;
  receipts: number;
  salesKes: number;
  items: number;
  commissionKes: number;
  nextTarget: number;
};

export default function StatsCard({
  periodLabel,
  receipts,
  salesKes,
  items,
  commissionKes,
  nextTarget,
}: StatsCardProps) {
  const pct = nextTarget > 0 ? Math.min((salesKes / nextTarget) * 100, 100) : 0;
  const remaining = nextTarget > salesKes ? nextTarget - salesKes : 0;

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-950/70 px-6 py-6 md:px-8 md:py-7">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-baseline md:justify-between">
        <h2 className="text-lg font-semibold tracking-tight text-slate-50">
          Quick stats
        </h2>
        <p className="text-xs text-slate-400 md:text-right">{periodLabel}</p>
      </div>

      {/* Tiles */}
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl bg-slate-900/70 px-4 py-3">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Receipts
          </div>
          <div className="mt-1 text-2xl font-semibold text-emerald-400">
            {receipts ?? 0}
          </div>
        </div>

        <div className="rounded-2xl bg-slate-900/70 px-4 py-3">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Sales (KES)
          </div>
          <div className="mt-1 text-2xl font-semibold text-emerald-400">
            {(salesKes ?? 0).toLocaleString()}
          </div>
        </div>

        <div className="rounded-2xl bg-slate-900/70 px-4 py-3">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Commission (KES)
          </div>
          <div className="mt-1 text-2xl font-semibold text-emerald-400">
            {(commissionKes ?? 0).toLocaleString()}
          </div>
        </div>

        <div className="rounded-2xl bg-slate-900/70 px-4 py-3">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Items sold
          </div>
          <div className="mt-1 text-2xl font-semibold text-emerald-400">
            {items ?? 0}
          </div>
        </div>
      </div>

      {/* Progress to next tier */}
      <div className="mt-6">
        <p className="text-xs uppercase tracking-wide text-slate-400">To next tier</p>
        <p className="text-sm text-slate-200">
          {remaining > 0
            ? `KES ${remaining.toLocaleString()} more to hit next tier`
            : nextTarget > 0
            ? "Reached highest tier"
            : "No tier target configured"}
        </p>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-800">
          <div
            className="h-full rounded-full bg-emerald-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </section>
  );
}
