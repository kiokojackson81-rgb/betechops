import type { PayrollRow } from "@/app/admin/payroll/types";
import { getBrendahCommissionForPeriod } from "@/lib/brendahCommission";
import { resolveDirectCommissionMode } from "@/lib/onlineCommission";
import type { TradingPeriod } from "@/lib/tradingPeriod";

export async function applyCanonicalPayrollOverrides(row: PayrollRow, period: TradingPeriod): Promise<PayrollRow> {
  const normalizedEmail = (row.email ?? "").toLowerCase().trim();

  if (normalizedEmail === "brendah@betech.co.ke") {
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

  if (resolveDirectCommissionMode(row.email) === "PROFIT_10") {
    // buildPayrollRow already uses assigned marketplace accounts and the same
    // four-week payroll window. Re-querying WeeklySale.userId here discarded
    // valid shop-assigned Jumia commission because those rows are shop-owned.
    const jumiaCommission = Number(row.commissionMarketplaceJumia ?? 0);
    const kilimallCommission = Number(row.commissionMarketplaceKilimall ?? 0);
    const commissionTotal =
      Number(row.commissionDirect ?? 0) + jumiaCommission + kilimallCommission;
    const totalEarnings =
      Number(row.baseSalary ?? 0) +
      Number(row.transportAllowance ?? 0) +
      commissionTotal +
      Number(row.bonusTotal ?? 0);

    return {
      ...row,
      commission: commissionTotal,
      commissionGross: commissionTotal,
      commissionMarketplaceJumia: jumiaCommission,
      commissionMarketplaceKilimall: kilimallCommission,
      commissionTotal,
      totalEarnings,
      netPay: totalEarnings - Number(row.totalDeductions ?? 0),
      commissionBreakdown: {
        ...(row.commissionBreakdown && typeof row.commissionBreakdown === "object" ? row.commissionBreakdown : {}),
        source: "profit10-assigned-marketplace",
        jumia: jumiaCommission,
        kilimall: kilimallCommission,
        total: commissionTotal,
        periodKey: period.key,
      },
    };
  }

  return row;
}
