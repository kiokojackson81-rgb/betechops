import type { AdjustmentBreakdown, AdjustmentEntry, AdjustmentKind } from "@/app/admin/payroll/types";

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
    const signed = kind === "ADDITION" ? amount : -amount;
    if (bonus) summary.breakdown.bonus += signed;
    else if (topUp) summary.breakdown.commissionTopUp += signed;
    else if (type === "CHAMA") summary.breakdown.chama -= signed;
    else if (type === "LATENESS") summary.breakdown.lateness -= signed;
    else if (type === "DISCIPLINE") summary.breakdown.discipline -= signed;
    else summary.breakdown.other -= signed;
    if (signed >= 0) summary.totalBonus += signed;
    else summary.totalDeduction += -signed;
  }
  return summary;
}
