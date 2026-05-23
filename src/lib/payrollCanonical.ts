import type { PayrollRow } from "@/app/admin/payroll/types";
import { getBrendahCommissionForPeriod } from "@/lib/brendahCommission";
import type { TradingPeriod } from "@/lib/tradingPeriod";

export async function applyCanonicalPayrollOverrides(row: PayrollRow, period: TradingPeriod): Promise<PayrollRow> {
  if ((row.email ?? "").toLowerCase().trim() !== "brendah@betech.co.ke") return row;

  const result = await getBrendahCommissionForPeriod(row.attendantId, period);
  const totalEarnings =
    Number(row.baseSalary ?? 0) +
    Number(row.transportAllowance ?? 0) +
    result.commission +
    Number(row.bonusTotal ?? 0);

  return {
    ...row,
    totalSales: result.totalSales,
    totalProfit: result.totalProfit,
    totalReceipts: result.totalReceipts,
    commission: result.commission,
    commissionGross: result.commission,
    commissionDirect: result.commission,
    commissionTotal: result.commission,
    totalEarnings,
    netPay: totalEarnings - Number(row.totalDeductions ?? 0),
    commissionBreakdown: {
      ...(row.commissionBreakdown && typeof row.commissionBreakdown === "object" ? row.commissionBreakdown : {}),
      source: "brendah-canonical",
      mode: result.commissionMode,
      reason: result.commissionReason,
      periodKey: result.periodKey,
    },
  };
}
