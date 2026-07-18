type AdjustmentEntryLike = {
  id?: string;
  label?: string;
  amount?: number;
  adjustmentType?: string;
  adjustmentKind?: string;
  kind?: string;
};

type SummaryLike = {
  attendantCategory?: string | null;
  baseSalary?: number;
  transportAllowance?: number;
  salesCommission?: number;
  commissionDirect?: number;
  directCommission?: number;
  commissionMarketplaceJumia?: number;
  commissionMarketplaceKilimall?: number;
  commissionTotal?: number;
  totalCommission?: number;
  grossCommission?: number;
  batteryEarnings?: number;
  newProductCommission?: number;
  copiedCommission?: number;
  editedCommission?: number;
  bonusTotal?: number;
  commissionTopUpTotal?: number;
  chamaTotal?: number;
  latenessTotal?: number;
  disciplineTotal?: number;
  otherDeductionsTotal?: number;
  penalties?: number;
  totalEarnings?: number;
  totalDeductions?: number;
  netPay?: number;
  adjustmentEntries?: AdjustmentEntryLike[];
  commissionBreakdown?: unknown | null;
};

export type EarningsCardLine = {
  label: string;
  amount: number;
  kind: "earning" | "deduction";
};

type BreakdownResult = {
  lines: EarningsCardLine[];
  totalEarnings: number;
  totalDeductions: number;
  netPay: number;
};

function num(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function commissionLines(summary: SummaryLike): EarningsCardLine[] {
  const category = String(summary.attendantCategory ?? "");
  const direct = num(summary.commissionDirect ?? summary.directCommission);
  const jumia = num(summary.commissionMarketplaceJumia);
  const kilimall = num(summary.commissionMarketplaceKilimall);
  const totalCommission =
    num(summary.commissionTotal ?? summary.totalCommission ?? summary.grossCommission) ||
    (direct + jumia + kilimall > 0 ? direct + jumia + kilimall : num(summary.salesCommission));

  switch (category) {
    case "DIRECT_SALES_OPS":
      return direct || totalCommission
        ? [{ label: "Direct sales commission", amount: direct || totalCommission, kind: "earning" }]
        : [];
    case "MARKETING_OPS":
      return direct || totalCommission
        ? [{ label: "Marketing commission", amount: direct || totalCommission, kind: "earning" }]
        : [];
    case "JUMIA_KILIMALL_OPS":
      return [
        { label: "POS commission", amount: direct, kind: "earning" as const },
        { label: "Jumia commission", amount: jumia, kind: "earning" as const },
        { label: "Kilimall commission", amount: kilimall, kind: "earning" as const },
      ].filter((line) => line.amount !== 0);
    case "BETECH_OPS":
      return [
        { label: "POS commission", amount: direct, kind: "earning" as const },
        { label: "Jumia commission", amount: jumia, kind: "earning" as const },
        { label: "Kilimall commission", amount: kilimall, kind: "earning" as const },
      ].filter((line) => line.amount !== 0);
    case "SUPPORT_OPS":
      return direct || totalCommission
        ? [{ label: "Support commission", amount: direct || totalCommission, kind: "earning" }]
        : [];
    case "TECHNICAL_TEAM": {
      const breakdown =
        summary.commissionBreakdown && typeof summary.commissionBreakdown === "object"
          ? (summary.commissionBreakdown as Record<string, unknown>)
          : {};
      const posProfitShare = num(breakdown.posProfitShare);
      const posProduct = num(breakdown.posProduct);
      const projectCompleted = num(breakdown.projectCompleted);
      return [
        { label: "POS profit commission", amount: posProfitShare, kind: "earning" as const },
        { label: "POS product commission", amount: posProduct, kind: "earning" as const },
        { label: "Project commission", amount: projectCompleted, kind: "earning" as const },
      ].filter((line) => line.amount !== 0);
    }
    default:
      return totalCommission ? [{ label: "Commission", amount: totalCommission, kind: "earning" }] : [];
  }
}

export function buildEarningsCardBreakdown(summary: SummaryLike | null | undefined): BreakdownResult {
  if (!summary) {
    return { lines: [], totalEarnings: 0, totalDeductions: 0, netPay: 0 };
  }

  const baseLines: EarningsCardLine[] = [
    { label: "Base salary", amount: num(summary.baseSalary), kind: "earning" as const },
    { label: "Transport allowance", amount: num(summary.transportAllowance), kind: "earning" as const },
    ...commissionLines(summary),
    { label: "Battery earnings", amount: num(summary.batteryEarnings), kind: "earning" as const },
    { label: "New product commission", amount: num(summary.newProductCommission), kind: "earning" as const },
    { label: "Copied product commission", amount: num(summary.copiedCommission), kind: "earning" as const },
    { label: "Edited product commission", amount: num(summary.editedCommission), kind: "earning" as const },
  ].filter((line) => line.amount !== 0);

  const entries = Array.isArray(summary.adjustmentEntries) ? summary.adjustmentEntries : [];
  const adjustmentLines: EarningsCardLine[] =
    entries.length > 0
      ? entries
          .map((entry) => ({
            label: String(entry.label || entry.adjustmentType || "Adjustment"),
            amount: num(entry.amount),
            kind:
              String(entry.adjustmentKind ?? entry.kind ?? "DEDUCTION").toUpperCase() === "ADDITION"
                ? ("earning" as const)
                : ("deduction" as const),
          }))
          .filter((line) => line.amount !== 0)
      : [
          { label: "Bonus", amount: num(summary.bonusTotal), kind: "earning" as const },
          { label: "Top-up", amount: num(summary.commissionTopUpTotal), kind: "earning" as const },
          { label: "Chama", amount: num(summary.chamaTotal), kind: "deduction" as const },
          { label: "Lateness", amount: num(summary.latenessTotal), kind: "deduction" as const },
          { label: "Discipline", amount: num(summary.disciplineTotal), kind: "deduction" as const },
          { label: "Other deductions", amount: num(summary.otherDeductionsTotal), kind: "deduction" as const },
          { label: "Penalties", amount: num(summary.penalties), kind: "deduction" as const },
        ].filter((line) => line.amount !== 0);

  const lines = [...baseLines, ...adjustmentLines];
  const totalEarningsDerived = lines
    .filter((line) => line.kind === "earning")
    .reduce((sum, line) => sum + line.amount, 0);
  const totalDeductionsDerived = lines
    .filter((line) => line.kind === "deduction")
    .reduce((sum, line) => sum + line.amount, 0);

  const totalEarnings = entries.length > 0 ? totalEarningsDerived : num(summary.totalEarnings ?? totalEarningsDerived);
  const totalDeductions =
    entries.length > 0 ? totalDeductionsDerived : num(summary.totalDeductions ?? totalDeductionsDerived);
  const netPay =
    entries.length > 0
      ? totalEarningsDerived - totalDeductionsDerived
      : num(summary.netPay ?? totalEarnings - totalDeductions);

  return { lines, totalEarnings, totalDeductions, netPay };
}
