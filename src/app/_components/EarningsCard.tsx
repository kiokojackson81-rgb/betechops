"use client";

import Card from "./Card";
import type { EarningsSummary } from "@/lib/earningsSummary";

const formatCurrency = (value: number) => `KES ${value.toLocaleString("en-US")}`;

export default function EarningsCard({ summary }: { summary: EarningsSummary | null }) {
  if (!summary) return null;

  const rows = [
    { label: "Base salary", value: summary.baseSalary },
    { label: "Transport allowance", value: summary.transportAllowance },
    { label: "Sales commission", value: summary.salesCommission },
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

  return (
    <Card className="space-y-4 border-slate-800 bg-slate-900/60">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Earnings summary</p>
        <p className="text-sm text-slate-400">For {summary.periodLabel}</p>
      </div>
      <div className="rounded-2xl border border-emerald-500/30 bg-black/20 px-4 py-3">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Net pay</p>
        <p className="text-2xl font-semibold text-emerald-300">{formatCurrency(summary.netPay)}</p>
      </div>
      <div className="space-y-3 text-sm text-slate-100">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between">
            <span className="text-slate-400">{row.label}</span>
            <span>{row.formatted}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
