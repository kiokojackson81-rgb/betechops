import { prisma } from "@/lib/prisma";
import { buildPayrollRow } from "@/lib/adminPayroll";
import { applyCanonicalPayrollOverrides } from "@/lib/payrollCanonical";
import { payrollEligibleUserWhere } from "@/lib/payrollEligibility";
import type { PayrollRow } from "@/app/admin/payroll/types";
import type { TradingPeriod } from "@/lib/tradingPeriod";

export type PayrollAppraisal = {
  companyCount: number;
  categoryCount: number;
  valueCreated: {
    sales: number;
    profit: number;
    profitAfterPay: number;
    marginPct: number;
  };
  companyRank: {
    sales: number;
    profit: number;
    commission: number;
    netPay: number;
    receipts: number;
    items: number;
  };
  categoryRank: {
    sales: number;
    profit: number;
    commission: number;
    netPay: number;
  };
  companyAverage: {
    sales: number;
    profit: number;
    commission: number;
    netPay: number;
  };
  categoryAverage: {
    sales: number;
    profit: number;
    commission: number;
    netPay: number;
  };
  companyShare: {
    salesPct: number;
    profitPct: number;
    commissionPct: number;
  };
  contributionScorePct: number;
};

function rankBy(rows: PayrollRow[], attendantId: string, selector: (row: PayrollRow) => number) {
  const sorted = [...rows].sort((a, b) => selector(b) - selector(a));
  const rank = sorted.findIndex((row) => row.attendantId === attendantId) + 1;
  return rank > 0 ? rank : sorted.length;
}

function averageBy(rows: PayrollRow[], selector: (row: PayrollRow) => number) {
  if (!rows.length) return 0;
  return rows.reduce((sum, row) => sum + selector(row), 0) / rows.length;
}

function totalBy(rows: PayrollRow[], selector: (row: PayrollRow) => number) {
  return rows.reduce((sum, row) => sum + selector(row), 0);
}

function percentileFromRank(rank: number, total: number) {
  if (total <= 1) return 1;
  return (total - rank) / (total - 1);
}

export function emptyPayrollAppraisal(payrollRow?: PayrollRow | null): PayrollAppraisal {
  const sales = Number(payrollRow?.totalSales ?? 0);
  const profit = Number(payrollRow?.totalProfit ?? 0);
  const netPay = Number(payrollRow?.netPay ?? 0);

  return {
    companyCount: 0,
    categoryCount: 0,
    valueCreated: {
      sales,
      profit,
      profitAfterPay: profit - netPay,
      marginPct: sales > 0 ? (profit / sales) * 100 : 0,
    },
    companyRank: {
      sales: 0,
      profit: 0,
      commission: 0,
      netPay: 0,
      receipts: 0,
      items: 0,
    },
    categoryRank: {
      sales: 0,
      profit: 0,
      commission: 0,
      netPay: 0,
    },
    companyAverage: {
      sales: 0,
      profit: 0,
      commission: 0,
      netPay: 0,
    },
    categoryAverage: {
      sales: 0,
      profit: 0,
      commission: 0,
      netPay: 0,
    },
    companyShare: {
      salesPct: 0,
      profitPct: 0,
      commissionPct: 0,
    },
    contributionScorePct: 0,
  };
}

export async function computePayrollAppraisal(attendantId: string, payrollRow: PayrollRow, period: TradingPeriod): Promise<PayrollAppraisal> {
  const peerAttendants = await prisma.user.findMany({
    where: payrollEligibleUserWhere(),
    orderBy: [{ attendantCategory: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      attendantCategory: true,
      isActive: true,
    },
  });

  const peerRows = await Promise.all(
    peerAttendants.map(async (peer) => applyCanonicalPayrollOverrides(await buildPayrollRow(peer, period), period)),
  );
  const categoryRows = peerRows.filter((row) => row.attendantCategory === payrollRow.attendantCategory);

  const salesRankCompany = rankBy(peerRows, attendantId, (row) => row.totalSales);
  const profitRankCompany = rankBy(peerRows, attendantId, (row) => row.totalProfit);
  const commissionRankCompany = rankBy(peerRows, attendantId, (row) => row.commissionTotal);
  const netPayRankCompany = rankBy(peerRows, attendantId, (row) => row.netPay);
  const receiptsRankCompany = rankBy(peerRows, attendantId, (row) => row.totalReceipts);
  const itemsRankCompany = rankBy(peerRows, attendantId, (row) => row.totalItems);

  const salesRankCategory = rankBy(categoryRows, attendantId, (row) => row.totalSales);
  const profitRankCategory = rankBy(categoryRows, attendantId, (row) => row.totalProfit);
  const commissionRankCategory = rankBy(categoryRows, attendantId, (row) => row.commissionTotal);
  const netPayRankCategory = rankBy(categoryRows, attendantId, (row) => row.netPay);

  const companyTotalSales = totalBy(peerRows, (row) => row.totalSales);
  const companyTotalProfit = totalBy(peerRows, (row) => row.totalProfit);
  const companyTotalCommission = totalBy(peerRows, (row) => row.commissionTotal);
  const profitAfterPay = payrollRow.totalProfit - payrollRow.netPay;
  const contributionScore =
    (percentileFromRank(salesRankCompany, peerRows.length) +
      percentileFromRank(profitRankCompany, peerRows.length) +
      percentileFromRank(commissionRankCompany, peerRows.length) +
      percentileFromRank(netPayRankCompany, peerRows.length)) /
    4;

  return {
    companyCount: peerRows.length,
    categoryCount: categoryRows.length,
    valueCreated: {
      sales: payrollRow.totalSales,
      profit: payrollRow.totalProfit,
      profitAfterPay,
      marginPct: payrollRow.totalSales > 0 ? (payrollRow.totalProfit / payrollRow.totalSales) * 100 : 0,
    },
    companyRank: {
      sales: salesRankCompany,
      profit: profitRankCompany,
      commission: commissionRankCompany,
      netPay: netPayRankCompany,
      receipts: receiptsRankCompany,
      items: itemsRankCompany,
    },
    categoryRank: {
      sales: salesRankCategory,
      profit: profitRankCategory,
      commission: commissionRankCategory,
      netPay: netPayRankCategory,
    },
    companyAverage: {
      sales: averageBy(peerRows, (row) => row.totalSales),
      profit: averageBy(peerRows, (row) => row.totalProfit),
      commission: averageBy(peerRows, (row) => row.commissionTotal),
      netPay: averageBy(peerRows, (row) => row.netPay),
    },
    categoryAverage: {
      sales: averageBy(categoryRows, (row) => row.totalSales),
      profit: averageBy(categoryRows, (row) => row.totalProfit),
      commission: averageBy(categoryRows, (row) => row.commissionTotal),
      netPay: averageBy(categoryRows, (row) => row.netPay),
    },
    companyShare: {
      salesPct: companyTotalSales > 0 ? (payrollRow.totalSales / companyTotalSales) * 100 : 0,
      profitPct: companyTotalProfit > 0 ? (payrollRow.totalProfit / companyTotalProfit) * 100 : 0,
      commissionPct: companyTotalCommission > 0 ? (payrollRow.commissionTotal / companyTotalCommission) * 100 : 0,
    },
    contributionScorePct: contributionScore * 100,
  };
}
