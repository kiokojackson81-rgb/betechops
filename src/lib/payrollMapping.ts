import type { PayrollRow } from "@/app/admin/payroll/types";

export type PayrollSummary = {
  periodLabel?: string;
  attendantCategory?: string | null;
  salary?: number;
  baseSalary?: number;
  transportAllowance?: number;
  totalSales?: number;
  totalProfit?: number;
  totalItems?: number;
  totalReceipts?: number;
  newProducts?: number;
  editedProducts?: number;
  copiedProducts?: number;
  deductions?: number;
  chamaTotal?: number;
  latenessTotal?: number;
  disciplineTotal?: number;
  otherDeductionsTotal?: number;
  bonusTotal?: number;
  commissionTopUpTotal?: number;
  penalties?: number;
  directCommission?: number;
  marketplaceCommission?: number;
  commissionDirect?: number;
  commissionMarketplaceJumia?: number;
  commissionMarketplaceKilimall?: number;
  commissionTotal?: number;
  totalCommission?: number;
  grossCommission?: number;
  totalEarnings?: number;
  totalDeductions?: number;
  netPay?: number;
  adjustmentEntries?: Array<{
    id: string;
    label: string;
    amount: number;
    adjustmentType: string;
    adjustmentKind?: string;
    kind?: "ADDITION" | "DEDUCTION";
  }>;
  commissionBreakdown?: unknown | null;
};

export function mapPayrollToEarningsSummary(p: PayrollSummary | null, receiptsCount = 0) {
  if (!p) return null;
  const baseSalary = p.baseSalary ?? p.salary ?? 0;
  const direct = p.commissionDirect ?? p.directCommission ?? 0;
  const marketplaceJumia = p.commissionMarketplaceJumia ?? 0;
  const marketplaceKilimall = p.commissionMarketplaceKilimall ?? 0;
  const marketplaceTotal =
    marketplaceJumia + marketplaceKilimall > 0 ? marketplaceJumia + marketplaceKilimall : p.marketplaceCommission ?? 0;
  const totalCommission =
    p.commissionTotal ?? p.totalCommission ?? p.grossCommission ?? direct + marketplaceTotal;
  const chama = p.chamaTotal ?? p.deductions ?? 0;
  const lateness = p.latenessTotal ?? 0;
  const discipline = p.disciplineTotal ?? 0;
  const otherDeductions = p.otherDeductionsTotal ?? 0;
  const bonusTotal = p.bonusTotal ?? 0;
  const commissionTopUpTotal = p.commissionTopUpTotal ?? 0;
  const penalties = p.penalties ?? 0;
  const totalEarnings =
    typeof p.totalEarnings === "number"
      ? Number(p.totalEarnings ?? 0)
      : baseSalary + (p.transportAllowance ?? 0) + totalCommission + bonusTotal + commissionTopUpTotal;
  const totalDeductions =
    typeof p.totalDeductions === "number"
      ? Number(p.totalDeductions ?? 0)
      : chama + lateness + discipline + otherDeductions + penalties;
  const netPay =
    typeof p.netPay === "number"
      ? Number(p.netPay ?? 0)
      : totalEarnings - totalDeductions;
  const adjustmentEntries = Array.isArray(p.adjustmentEntries)
    ? p.adjustmentEntries.map((entry) => ({
        id: entry.id,
        label: entry.label,
        amount: Number(entry.amount ?? 0),
        adjustmentType: entry.adjustmentType,
        adjustmentKind: String(entry.adjustmentKind ?? entry.kind ?? "DEDUCTION").toUpperCase(),
      }))
    : [];

  return {
    periodKey: p.periodLabel ?? "",
    periodLabel: p.periodLabel ?? "",
    attendantCategory: p.attendantCategory ?? null,
    totalSales: Number(p.totalSales ?? 0),
    totalProfit: Number(p.totalProfit ?? 0),
    totalNewProducts: Number(p.newProducts ?? 0),
    totalEditedProducts: Number(p.editedProducts ?? 0),
    totalCopiedProducts: Number(p.copiedProducts ?? 0),
    totalItems: Number(p.totalItems ?? 0),
    totalReceipts: Number(p.totalReceipts ?? receiptsCount),
    walkInsServed: 0,
    walkInsPurchased: 0,
    baseSalary,
    transportAllowance: p.transportAllowance ?? 0,
    salesCommission: totalCommission,
    commissionDirect: direct,
    commissionMarketplaceJumia: marketplaceJumia,
    commissionMarketplaceKilimall: marketplaceKilimall,
    newProductCommission: 0,
    copiedCommission: 0,
    editedCommission: 0,
    grossCommission: totalCommission,
    batteryEarnings: 0,
    bonusTotal,
    commissionTopUpTotal,
    chamaTotal: chama,
    latenessTotal: lateness,
    disciplineTotal: discipline,
    otherDeductionsTotal: otherDeductions,
    totalEarnings,
    totalDeductions,
    netPay,
    ledger: null,
    adjustmentEntries,
  };
}

export function mapPayrollToPayrollRow(p: PayrollSummary | null, userId: string | null): PayrollRow {
  const salary = p?.baseSalary ?? p?.salary ?? 0;
  const transportAllowance = p?.transportAllowance ?? 0;
  const direct = p?.commissionDirect ?? p?.directCommission ?? 0;
  const marketplaceJumia = p?.commissionMarketplaceJumia ?? 0;
  const marketplaceKilimall = p?.commissionMarketplaceKilimall ?? 0;
  const marketplaceTotal =
    marketplaceJumia + marketplaceKilimall > 0 ? marketplaceJumia + marketplaceKilimall : p?.marketplaceCommission ?? 0;
  const totalCommission =
    p?.commissionTotal ?? p?.totalCommission ?? p?.grossCommission ?? direct + marketplaceTotal;

  const chama = p?.chamaTotal ?? p?.deductions ?? 0;
  const lateness = p?.latenessTotal ?? 0;
  const discipline = p?.disciplineTotal ?? 0;
  const otherDeductions = p?.otherDeductionsTotal ?? 0;
  const bonus = p?.bonusTotal ?? 0;
  const commissionTopUp = p?.commissionTopUpTotal ?? 0;
  const penalties = p?.penalties ?? 0;
  const totalEarnings =
    typeof p?.totalEarnings === "number"
      ? Number(p?.totalEarnings ?? 0)
      : salary + transportAllowance + totalCommission + bonus + commissionTopUp;
  const totalDeductions =
    typeof p?.totalDeductions === "number"
      ? Number(p?.totalDeductions ?? 0)
      : chama + lateness + discipline + otherDeductions + penalties;
  const netPay =
    typeof p?.netPay === "number"
      ? Number(p?.netPay ?? 0)
      : totalEarnings - totalDeductions;
  const adjustmentEntries = Array.isArray(p?.adjustmentEntries)
    ? p!.adjustmentEntries.map((entry) => ({
        id: entry.id,
        label: entry.label,
        amount: Number(entry.amount ?? 0),
        adjustmentType: entry.adjustmentType,
        kind: String(entry.adjustmentKind ?? entry.kind ?? "DEDUCTION").toUpperCase() as "ADDITION" | "DEDUCTION",
      }))
    : [];

  const deductionTotal = chama + lateness + discipline + otherDeductions + penalties;

  return {
    attendantId: userId ?? "",
    name: undefined,
    email: undefined,
    attendantCategory: p?.attendantCategory ?? null,
    isActive: true,
    baseSalary: salary,
    transportAllowance,
    commission: totalCommission,
    commissionGross: totalCommission,
    commissionDirect: direct,
    commissionMarketplaceJumia: marketplaceJumia,
    commissionMarketplaceKilimall: marketplaceKilimall,
    commissionTotal: totalCommission,
    commissionBreakdown: p?.commissionBreakdown ?? null,
    bonusTotal: bonus + commissionTopUp,
    deductionTotal: totalDeductions,
    totalEarnings,
    totalDeductions,
    netPay,
    totalSales: 0,
    totalProfit: 0,
    totalReceipts: 0,
    totalItems: 0,
    newProducts: 0,
    editedProducts: 0,
    copiedProducts: 0,
    adjustmentBreakdown: {
      chama,
      lateness,
      discipline,
      other: otherDeductions,
      bonus,
      commissionTopUp,
      penalties,
    },
    adjustmentEntries,
  };
}

export default {
  mapPayrollToEarningsSummary,
  mapPayrollToPayrollRow,
};
