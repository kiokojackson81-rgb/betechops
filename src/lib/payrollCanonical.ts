import type { PayrollRow } from "@/app/admin/payroll/types";
import { getBrendahCommissionForPeriod } from "@/lib/brendahCommission";
import { computeOnlinePeriodCommission, resolveDirectCommissionMode } from "@/lib/onlineCommission";
import { prisma } from "@/lib/prisma";
import { getOnlineOpsWeeksForTradingPeriod } from "@/lib/onlineOpsWeeks";
import type { TradingPeriod } from "@/lib/tradingPeriod";

async function computeProfit10MarketplaceSplit(attendantId: string, period: TradingPeriod) {
  const weeks = getOnlineOpsWeeksForTradingPeriod(period, new Date(), 4);
  const weekStarts = weeks.map((week) => week.weekStart);
  if (!weekStarts.length) {
    return { jumiaCommission: 0, kilimallCommission: 0, totalCommission: 0 };
  }

  const manualRows = await prisma.weeklySale.findMany({
    where: {
      userId: attendantId,
      source: "MANUAL",
      status: { not: "REJECTED" },
      weekStart: { in: weekStarts },
    },
    select: {
      platform: true,
      amount: true,
    },
  });

  if (!manualRows.length) {
    return { jumiaCommission: 0, kilimallCommission: 0, totalCommission: 0 };
  }

  const jumiaSales = manualRows
    .filter((row) => String(row.platform ?? "").toUpperCase() === "JUMIA")
    .reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
  const kilimallSales = manualRows
    .filter((row) => String(row.platform ?? "").toUpperCase() === "KILIMALL")
    .reduce((sum, row) => sum + Number(row.amount ?? 0), 0);

  const result = computeOnlinePeriodCommission(
    {
      attendantId,
      periodStart: period.start,
      periodEnd: period.end,
      directSales: 0,
      directProfit: 0,
      jumiaSales,
      kilimallSales,
    },
    { directCommissionMode: "PROFIT_10" },
  );

  return {
    jumiaCommission: Number(result.lines.find((line) => line.channel === "JUMIA")?.commission ?? 0),
    kilimallCommission: Number(result.lines.find((line) => line.channel === "KILIMALL")?.commission ?? 0),
    totalCommission: Number(
      result.lines
        .filter((line) => line.channel === "JUMIA" || line.channel === "KILIMALL")
        .reduce((sum, line) => sum + Number(line.commission ?? 0), 0),
    ),
  };
}

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
    const split = await computeProfit10MarketplaceSplit(row.attendantId, period);
    const commissionTotal =
      Number(row.commissionDirect ?? 0) + Number(split.jumiaCommission ?? 0) + Number(split.kilimallCommission ?? 0);
    const totalEarnings =
      Number(row.baseSalary ?? 0) +
      Number(row.transportAllowance ?? 0) +
      commissionTotal +
      Number(row.bonusTotal ?? 0);

    return {
      ...row,
      commission: commissionTotal,
      commissionGross: commissionTotal,
      commissionMarketplaceJumia: split.jumiaCommission,
      commissionMarketplaceKilimall: split.kilimallCommission,
      commissionTotal,
      totalEarnings,
      netPay: totalEarnings - Number(row.totalDeductions ?? 0),
      commissionBreakdown: {
        ...(row.commissionBreakdown && typeof row.commissionBreakdown === "object" ? row.commissionBreakdown : {}),
        source: "profit10-marketplace-range",
        jumia: split.jumiaCommission,
        kilimall: split.kilimallCommission,
        total: commissionTotal,
        periodKey: period.key,
      },
    };
  }

  return row;
}
