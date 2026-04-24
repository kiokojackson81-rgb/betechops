import Link from "next/link";
import React from "react";
import { redirect } from "next/navigation";
import PayrollClient from "./PayrollClient";
import { prisma } from "@/lib/prisma";
import {
  getNextTradingPeriod,
  getTradingPeriodFor,
  parseTradingPeriodKey,
} from "@/lib/tradingPeriod";
import { requireRole } from "@/lib/api";
import Card from "@/app/_components/Card";
import { getPeriodKeyVariantsFromDates } from "@/lib/payrollPeriodKey";
import { buildPayrollRow } from "@/lib/adminPayroll";
import { ensurePayrollAdjustmentStorage } from "@/lib/payrollAdjustmentStorage";
import type { PayrollRow } from "@/app/admin/payroll/types";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

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

export default async function PayrollPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<SearchParams | undefined>;
}) {
  const auth = await requireRole("ADMIN");
  if (!auth.ok) {
    redirect("/admin/login");
  }

  const awaitedParams = await params;
  const attendantId = awaitedParams.id;
  const attendant = await prisma.user.findUnique({
    where: { id: attendantId },
    select: { id: true, name: true, email: true, attendantCategory: true, isActive: true },
  });
  if (!attendant) {
    return (
      <div className="p-6">
        <Card className="border-red-500/30 bg-red-900/10">Attendant not found</Card>
      </div>
    );
  }

  const plan = await prisma.attendantCompPlan.findUnique({ where: { attendantId } });

  const resolvedSearchParams = (await searchParams) ?? {};
  const rawPeriodParam = Array.isArray(resolvedSearchParams.period)
    ? resolvedSearchParams.period[0]
    : resolvedSearchParams.period;
  const requestedPeriod = parseTradingPeriodKey(rawPeriodParam ?? undefined);
  const currentPeriod = getTradingPeriodFor(new Date());
  const period = requestedPeriod ?? currentPeriod;
  const periodKey = period.key;
  const periodLabel = period.label;

  const currentLedgerRaw =
    (await prisma.commissionLedger.findUnique({
      where: {
        userId_periodStart_periodEnd: {
          userId: attendantId,
          periodStart: period.start,
          periodEnd: period.end,
        },
      },
    })) ?? null;
  const payrollRow = await buildPayrollRow(
    {
      id: attendant.id,
      name: attendant.name,
      email: attendant.email,
      attendantCategory: attendant.attendantCategory ?? null,
      isActive: attendant.isActive,
    },
    period,
  );
  const summary = {
    sales: payrollRow.totalSales,
    totalProfit: payrollRow.totalProfit,
    totalReceipts: payrollRow.totalReceipts,
    totalItems: payrollRow.totalItems,
    baseSalary: payrollRow.baseSalary,
    transportAllowance: payrollRow.transportAllowance,
    commission: payrollRow.commissionTotal,
    grossCommission: payrollRow.commissionGross,
    netPay: payrollRow.netPay,
    bonusTotal: payrollRow.adjustmentBreakdown.bonus + payrollRow.adjustmentBreakdown.commissionTopUp,
    chamaTotal: payrollRow.adjustmentBreakdown.chama,
    latenessTotal: payrollRow.adjustmentBreakdown.lateness,
    disciplineTotal: payrollRow.adjustmentBreakdown.discipline,
    otherDeductionsTotal: payrollRow.adjustmentBreakdown.other,
    totalEarnings: payrollRow.totalEarnings,
    totalDeductions: payrollRow.totalDeductions,
    commissionDirect: payrollRow.commissionDirect,
    commissionMarketplaceJumia: payrollRow.commissionMarketplaceJumia,
    commissionMarketplaceKilimall: payrollRow.commissionMarketplaceKilimall,
    adjustmentBreakdown: payrollRow.adjustmentBreakdown,
    adjustmentEntries: payrollRow.adjustmentEntries,
  };

  const periodKeyVariants = getPeriodKeyVariantsFromDates(period.start, period.end);
  const adjustmentKeys = periodKeyVariants.length ? periodKeyVariants : [periodKey];
  await ensurePayrollAdjustmentStorage();
  const adjustments = await prisma.attendantPayrollAdjustment.findMany({
    where: { attendantId, periodKey: { in: adjustmentKeys } },
    orderBy: { createdAt: "desc" },
  });
  const currentLedger =
    currentLedgerRaw === null
      ? {
          commissionDirect: payrollRow.commissionDirect,
          commissionMarketplaceJumia: payrollRow.commissionMarketplaceJumia,
          commissionMarketplaceKilimall: payrollRow.commissionMarketplaceKilimall,
          netCommission: payrollRow.commissionTotal,
          commissionBreakdown: (payrollRow.commissionBreakdown as Record<string, number | undefined>) ?? {},
        }
      : {
          commissionDirect: payrollRow.commissionDirect,
          commissionMarketplaceJumia: payrollRow.commissionMarketplaceJumia,
          commissionMarketplaceKilimall: payrollRow.commissionMarketplaceKilimall,
          netCommission: Number(currentLedgerRaw.netCommission ?? payrollRow.commissionTotal ?? 0),
          commissionBreakdown:
            typeof currentLedgerRaw.commissionBreakdown === "object" && currentLedgerRaw.commissionBreakdown !== null
              ? (Object.fromEntries(
                  Object.entries(currentLedgerRaw.commissionBreakdown as Record<string, unknown>).map(([key, value]) => [
                    key,
                    typeof value === "object" && value !== null && "toNumber" in (value as any)
                      ? Number((value as any).toNumber())
                      : Number(value ?? 0),
                  ]),
                ) as Record<string, number>)
              : ((payrollRow.commissionBreakdown as Record<string, number | undefined>) ?? {}),
        };

  const previousPeriod = getTradingPeriodFor(new Date(period.start.getTime() - 24 * 60 * 60 * 1000));
  const nextPeriod = period.key === currentPeriod.key ? null : getNextTradingPeriod(period);
  const previousLedgerRaw = await prisma.commissionLedger.findUnique({
    where: {
      userId_periodStart_periodEnd: {
        userId: attendantId,
        periodStart: previousPeriod.start,
        periodEnd: previousPeriod.end,
      },
    },
  });
  const previousLedger = previousLedgerRaw
    ? { netCommission: Number(previousLedgerRaw.netCommission ?? 0) }
    : null;

  const peerAttendants = await prisma.user.findMany({
    where: { role: { in: ["ATTENDANT", "SUPERVISOR"] } },
    orderBy: [{ attendantCategory: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      attendantCategory: true,
      isActive: true,
    },
  });
  const peerRows = await Promise.all(peerAttendants.map((peer) => buildPayrollRow(peer, period)));
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

  const appraisal = {
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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
      <header className="mb-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Payroll - {attendant.name ?? attendant.email}</h1>
            <p className="text-sm text-slate-400">Manage comp plans and payroll adjustments for this attendant.</p>
            {period.key !== currentPeriod.key && (
              <p className="text-xs text-slate-500">Showing archived period ({period.label}).</p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={`/api/admin/payroll/payslip?attendantId=${encodeURIComponent(attendantId)}&periodKey=${encodeURIComponent(period.key)}`}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-100 border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20"
            >
              Download payslip
            </a>
            <Link
              href={`/admin/attendants/${attendantId}/payroll?period=${encodeURIComponent(previousPeriod.key)}`}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-100 border border-white/10 bg-slate-900 hover:bg-slate-800"
            >
              View previous period
            </Link>
            {nextPeriod && (
              <Link
                href={`/admin/attendants/${attendantId}/payroll?period=${encodeURIComponent(nextPeriod.key)}`}
                className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-100 border border-white/10 bg-slate-900 hover:bg-slate-800"
              >
                View next period
              </Link>
            )}
            {period.key !== currentPeriod.key && (
              <Link
                href={`/admin/attendants/${attendantId}/payroll`}
                className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-100 border border-white/10 bg-slate-900 hover:bg-slate-800"
              >
                Return to current
              </Link>
            )}
          </div>
        </div>
      </header>
      <PayrollClient
        attendant={attendant}
        initialPlan={plan as any}
        periodKey={periodKey}
        periodLabel={periodLabel}
        initialAdjustments={adjustments as any}
        initialSummary={summary}
        ledger={currentLedger}
        previousLedger={previousLedger ?? null}
        initialAppraisal={appraisal}
      />
    </div>
  );
}
