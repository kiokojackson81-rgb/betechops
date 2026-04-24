"use client";

import Card from "./Card";
import type { EarningsSummary } from "@/lib/earningsSummary";
import { useCardLock, LockButton } from "./useCardLock";

const formatCurrency = (value: number) => `KES ${value.toLocaleString("en-US")}`;

export default function EarningsCard({
  summary,
  lockKey,
}: {
  summary: EarningsSummary | null;
  lockKey?: string;
}) {
  const { locked, toggle } = useCardLock(lockKey ?? "earnings:default");

  if (!summary) return null;

  const typedSummary = summary as typeof summary & {
    attendantCategory?: string | null;
    commissionDirect?: number;
    commissionMarketplaceJumia?: number;
    commissionMarketplaceKilimall?: number;
  };
  const directCommission = Number(typedSummary.commissionDirect ?? 0);
  const jumiaCommission = Number(typedSummary.commissionMarketplaceJumia ?? 0);
  const kilimallCommission = Number(typedSummary.commissionMarketplaceKilimall ?? 0);
  const hasCommissionBreakdown = directCommission !== 0 || jumiaCommission !== 0 || kilimallCommission !== 0;
  const directCommissionLabel =
    typedSummary.attendantCategory === "JUMIA_KILIMALL_OPS" || typedSummary.attendantCategory === "BETECH_OPS"
      ? "Direct POS commission"
      : "Direct commission";

  const rows = [
    { label: "Base salary", value: summary.baseSalary },
    { label: "Transport allowance", value: summary.transportAllowance },
    ...(hasCommissionBreakdown
      ? [
          { label: directCommissionLabel, value: directCommission },
          { label: "Jumia commission", value: jumiaCommission },
          { label: "Kilimall commission", value: kilimallCommission },
        ]
      : [{ label: "Sales commission", value: summary.salesCommission }]),
    { label: "Battery earnings", value: summary.batteryEarnings ?? 0 },
    { label: "New product commission", value: summary.newProductCommission },
    { label: "Copied product commission", value: summary.copiedCommission },
    { label: "Edited product commission", value: summary.editedCommission },
    { label: "Commission top-up", value: summary.commissionTopUpTotal },
    { label: "Bonuses", value: summary.bonusTotal },
    { label: "Chama deduction", value: -summary.chamaTotal },
    { label: "Lateness deductions", value: -summary.latenessTotal },
    { label: "Discipline deductions", value: -summary.disciplineTotal },
    { label: "Other deductions", value: -summary.otherDeductionsTotal },
  ]
    .filter((row) => row.value !== 0)
    .map((row) => ({
      ...row,
      formatted: row.value < 0 ? `- ${formatCurrency(Math.abs(row.value))}` : formatCurrency(row.value),
    }));

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
        <p className="text-2xl font-semibold text-emerald-300">{mask(formatCurrency(summary.netPay))}</p>
      </div>
      <div className="space-y-3 text-sm text-slate-100">
        {renderJenifferProgress()}
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between">
            <span className="text-slate-400">{row.label}</span>
            <span>{mask(row.formatted)}</span>
          </div>
        ))}
        {summary.adjustmentEntries && summary.adjustmentEntries.length > 0 ? (
          <div className="pt-2">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Adjustments</p>
            <div className="mt-2 space-y-2">
              {summary.adjustmentEntries.map((e) => {
                const isAddition = (String(e.adjustmentKind || "DEDUCTION").toUpperCase() === "ADDITION");
                const val = isAddition ? e.amount : -Math.abs(e.amount);
                const formatted = val < 0 ? `- ${formatCurrency(Math.abs(val))}` : formatCurrency(val);
                return (
                  <div key={e.id} className="flex items-center justify-between">
                    <span className="text-slate-400">{e.label}</span>
                    <span>{mask(formatted)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
