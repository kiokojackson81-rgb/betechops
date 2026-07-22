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
import { applyCanonicalPayrollOverrides } from "@/lib/payrollCanonical";
import { emptyPayrollAppraisal } from "@/lib/payrollAppraisal";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;
type MaybePromise<T> = T | Promise<T>;

async function resolveMaybePromise<T>(value: MaybePromise<T> | undefined) {
  if (!value) return undefined;
  if (typeof (value as Promise<T>).then === "function") {
    return await (value as Promise<T>);
  }
  return value as T;
}

export default async function PayrollPage({
  params,
  searchParams,
}: {
  params: MaybePromise<{ id: string }>;
  searchParams?: MaybePromise<SearchParams | undefined>;
}) {
  const auth = await requireRole("ADMIN");
  if (!auth.ok) {
    redirect("/admin/login");
  }

  const awaitedParams = await resolveMaybePromise(params);
  if (!awaitedParams?.id) {
    return (
      <div className="p-6">
        <Card className="border-red-500/30 bg-red-900/10">Attendant not found</Card>
      </div>
    );
  }
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

  const resolvedSearchParams = (await resolveMaybePromise(searchParams)) ?? {};
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
  const payrollRow = await applyCanonicalPayrollOverrides(
    await buildPayrollRow(
      {
        id: attendant.id,
        name: attendant.name,
        email: attendant.email,
        attendantCategory: attendant.attendantCategory ?? null,
        isActive: attendant.isActive,
      },
      period,
    ),
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
  const recurringItems = await prisma.attendantRecurringPayrollItem.findMany({
    where: { attendantId },
    orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
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
            <a
              href={`/api/admin/payroll/payslip?attendantId=${encodeURIComponent(attendantId)}&periodKey=${encodeURIComponent(previousPeriod.key)}`}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-100 border border-white/10 bg-slate-900 hover:bg-slate-800"
            >
              Download previous payslip
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
        initialRecurringItems={recurringItems as any}
        initialSummary={summary}
        ledger={currentLedger}
        previousLedger={previousLedger ?? null}
        initialAppraisal={emptyPayrollAppraisal(payrollRow)}
      />
    </div>
  );
}
