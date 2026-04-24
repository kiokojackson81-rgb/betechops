"use client";

import Card from "./Card";
import type { EarningsSummary } from "@/lib/earningsSummary";
import { useCardLock, LockButton } from "./useCardLock";
import { buildEarningsCardBreakdown } from "@/lib/earningsCardBreakdown";
import Link from "next/link";

const formatCurrency = (value: number) => `KES ${value.toLocaleString("en-US")}`;

export default function EarningsCard({
  summary,
  lockKey,
  downloadHref,
}: {
  summary: EarningsSummary | null;
  lockKey?: string;
  downloadHref?: string;
}) {
  const { locked, toggle } = useCardLock(lockKey ?? "earnings:default");

  if (!summary) return null;

  const breakdown = buildEarningsCardBreakdown(summary);

  const mask = (val: string) => (locked ? "•••" : val);

  const renderJenifferProgress = () => {
    const p = (summary as any).jenifferProgress;
    if (!p) return null;
    const percent = Math.round((p.progressPercent ?? 0) * 10000) / 100; // 2 decimals
    const formattedProrated = formatCurrency(Number(p.prorated ?? 0));
    const nextTarget = p.nextTarget ? String(p.nextTarget.toLocaleString?.() ?? p.nextTarget) : "—";
    return (
      <div className="rounded-xl border border-amber-600/40 bg-amber-900/10 p-3">
        <div className="text-xs uppercase tracking-wide text-amber-200">Progress to next target</div>
        <div className="mt-1 flex items-center justify-between">
          <div>
            <div className="text-sm text-amber-100">Next target</div>
            <div className="text-sm font-semibold text-amber-200">{nextTarget}</div>
          </div>
          <div className="ml-4 w-44">
            <div className="text-sm text-amber-100">Prorated earned</div>
            <div className="text-sm font-semibold text-amber-200">{mask(formattedProrated)}</div>
          </div>
        </div>
        <div className="mt-3">
          <div className="h-2 w-full overflow-hidden rounded-full bg-amber-900/30">
            <div
              className="h-full rounded-full bg-amber-500"
              style={{ width: `${percent}%` }}
            />
          </div>
          <div className="mt-1 text-xs text-amber-300">{percent}% to next tier</div>
        </div>
      </div>
    );
  };

  return (
    <Card className="space-y-4 border-slate-800 bg-slate-900/60">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Earnings summary</p>
          <p className="text-sm text-slate-400">For {summary.periodLabel}</p>
        </div>
        {lockKey ? <LockButton locked={locked} onToggle={toggle} /> : null}
      </div>
        <div className="rounded-2xl border border-emerald-500/30 bg-black/20 px-4 py-3">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Net pay</p>
        <p className="text-2xl font-semibold text-emerald-300">{mask(formatCurrency(breakdown.netPay))}</p>
      </div>
      <div className="space-y-3 text-sm text-slate-100">
        {renderJenifferProgress()}
        {breakdown.lines.map((row) => (
          <div key={row.label} className="flex items-center justify-between">
            <span className="text-slate-400">{row.label}</span>
            <span>
              {mask(
                row.kind === "deduction"
                  ? `- ${formatCurrency(Math.abs(row.amount))}`
                  : formatCurrency(row.amount),
              )}
            </span>
          </div>
        ))}
      </div>
      {downloadHref ? (
        <div className="pt-1">
          <Link
            href={downloadHref}
            className="inline-flex rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-100 transition hover:border-white/30 hover:bg-white/10"
          >
            Download payslip
          </Link>
        </div>
      ) : null}
    </Card>
  );
}
