import { getAttendantCommissionSummary } from "@/lib/attendantCommission";
import type { PayrollRow } from "@/app/admin/payroll/types";
import { getBrendahCommissionForPeriod } from "@/lib/brendahCommission";
import { resolveDirectCommissionMode } from "@/lib/onlineCommission";
import type { TradingPeriod } from "@/lib/tradingPeriod";

export async function applyCanonicalPayrollOverrides(row: PayrollRow, period: TradingPeriod): Promise<PayrollRow> {
  const summary = await getAttendantCommissionSummary({ attendantId: row.attendantId, start: period.start, end: period.end });
  const totalEarnings = Number(row.baseSalary ?? 0) + Number(row.transportAllowance ?? 0) + summary.totalCommission + Number(row.bonusTotal ?? 0);
  return { ...row, totalSales: summary.totalSales, totalProfit: summary.totalProfit,
    totalReceipts: summary.receiptsCount, totalItems: summary.totalItems,
    commission: summary.totalCommission, commissionGross: summary.totalCommission,
    commissionDirect: summary.directSalesCommission, commissionTotal: summary.totalCommission,
    totalEarnings, netPay: totalEarnings - Number(row.totalDeductions ?? 0),
    commissionBreakdown: { ...summary.breakdown, source: "receipt-reconciliation", periodKey: period.key },
  };
}
