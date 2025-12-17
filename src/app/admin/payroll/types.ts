export type AdjustmentBreakdown = {
  chama: number;
  lateness: number;
  discipline: number;
  other: number;
  bonus: number;
  commissionTopUp: number;
  penalties: number;
};

export type PayrollRow = {
  attendantId: string;
  name?: string | null;
  email?: string | null;
  attendantCategory?: string | null;
  isActive: boolean;
  baseSalary: number;
  transportAllowance: number;
  commission: number;
  commissionGross: number;
  commissionDirect: number;
  commissionMarketplaceJumia: number;
  commissionMarketplaceKilimall: number;
  commissionTotal: number;
  commissionBreakdown: unknown | null;
  bonusTotal: number;
  deductionTotal: number;
  totalEarnings: number;
  totalDeductions: number;
  netPay: number;
  totalSales: number;
  totalProfit: number;
  adjustmentBreakdown: AdjustmentBreakdown;
};
