import type { AdjustmentBreakdown, AdjustmentEntry, AdjustmentKind } from "@/app/admin/payroll/types";

export function calculateAdjustmentTotals(entries: AdjustmentEntry[]) {
  return entries.reduce(
    (totals, entry) => {
      const amount = Math.abs(Number(entry.amount ?? 0));
      if (entry.kind === "ADDITION") totals.totalAdditions += amount;
      else totals.totalDeductions += amount;
      return totals;
    },
    { totalAdditions: 0, totalDeductions: 0 },
  );
}

export function summarizeAdjustments(adjustments: Array<{
  id: string; label: string; amount: number | null; adjustmentType: string; adjustmentKind?: string | null;
}>) {
  const summary = {
    totalBonus: 0, totalDeduction: 0,
    breakdown: { chama: 0, lateness: 0, discipline: 0, other: 0, bonus: 0, commissionTopUp: 0, penalties: 0 } satisfies AdjustmentBreakdown,
    entries: [] as AdjustmentEntry[],
  };
  for (const adjustment of adjustments) {
    const amount = Number(adjustment.amount ?? 0);
    const type = adjustment.adjustmentType;
    const bonus = type === "BONUS";
    const topUp = type === "COMMISSION_TOPUP";
    const kind = (adjustment.adjustmentKind as AdjustmentKind | undefined) ?? (bonus || topUp ? "ADDITION" : "DEDUCTION");
    summary.entries.push({ id: adjustment.id, label: adjustment.label, amount, adjustmentType: type, kind });
    if (kind === "ADDITION") {
      if (bonus) summary.breakdown.bonus += amount;
      else if (topUp) summary.breakdown.commissionTopUp += amount;
      else summary.breakdown.bonus += amount;
      summary.totalBonus += amount;
    } else {
      // A deduction remains a deduction even if a historic row carries the
      // BONUS type (as in Brendah's lateness record). `kind` is authoritative.
      if (type === "CHAMA") summary.breakdown.chama += amount;
      else if (type === "LATENESS") summary.breakdown.lateness += amount;
      else if (type === "DISCIPLINE") summary.breakdown.discipline += amount;
      else summary.breakdown.other += amount;
      summary.totalDeduction += amount;
    }
  }
  return summary;
}
