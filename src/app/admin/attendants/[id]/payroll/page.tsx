import React from "react";
import { redirect } from "next/navigation";
import PayrollClient from "./PayrollClient";
import { prisma } from "@/lib/prisma";
import { getTradingPeriodFor, getRecentTradingPeriods } from "@/lib/tradingPeriod";
import { getEarningsSummaryForAttendant } from "@/lib/marketingEarnings";
import { getEarningsSummaryForUser } from "@/lib/earningsSummary";
import { requireRole } from "@/lib/api";
import Card from "@/app/_components/Card";
import { getPeriodKeyVariantsFromDates } from "@/lib/payrollPeriodKey";

export const dynamic = "force-dynamic";

export default async function PayrollPage({ params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole("ADMIN");
  if (!auth.ok) {
    redirect("/admin/login");
  }

  const awaitedParams = await params;
  const attendantId = awaitedParams.id;
  const attendant = await prisma.user.findUnique({ where: { id: attendantId }, select: { id: true, name: true, email: true } });
  if (!attendant) {
    return (
      <div className="p-6">
        <Card className="border-red-500/30 bg-red-900/10">Attendant not found</Card>
      </div>
    );
  }

  const plan = await prisma.attendantCompPlan.findUnique({ where: { attendantId } });

  const period = getTradingPeriodFor(new Date());
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

  // Prefer the more robust earnings summary implementation which tolerates
  // multiple periodKey formats and honours payroll adjustment kinds. Fall
  // back to the older marketing earnings helper if needed.
  let summary: any = null;
  try {
    const userSummary = await getEarningsSummaryForUser({ userId: attendantId, asOf: new Date() });
    const ledgerDetail = currentLedgerRaw?.detail as Record<string, any> | undefined;
    const marketingCommissionValue =
      ledgerDetail && typeof ledgerDetail === "object" ? Number(ledgerDetail.marketing?.commission ?? 0) : 0;
    const supportCommissionValue =
      ledgerDetail && typeof ledgerDetail === "object" ? Number(ledgerDetail.support?.commission ?? 0) : 0;
    let ledgerSalesCommission = marketingCommissionValue + supportCommissionValue;
    if (ledgerSalesCommission === 0 && currentLedgerRaw) {
      ledgerSalesCommission = Number(currentLedgerRaw.grossCommission ?? 0);
    }
    if (ledgerSalesCommission === 0) {
      ledgerSalesCommission = userSummary.salesCommission;
    }

    const grossCommission =
      ledgerSalesCommission +
      userSummary.newProductCommission +
      userSummary.copiedCommission +
      userSummary.editedCommission +
      userSummary.commissionTopUpTotal;

    const bonusTotal = userSummary.bonusTotal ?? 0;
    const totalDeductions =
      userSummary.chamaTotal +
      userSummary.latenessTotal +
      userSummary.disciplineTotal +
      userSummary.otherDeductionsTotal;
    const totalEarnings =
      userSummary.baseSalary + userSummary.transportAllowance + grossCommission + bonusTotal;
    const netPay = totalEarnings - totalDeductions;

    summary = {
      ...userSummary,
      salesCommission: ledgerSalesCommission,
      grossCommission,
      totalEarnings,
      totalDeductions,
      netPay,
      commission: grossCommission,
      sales: userSummary.totalSales,
    };
  } catch (e) {
    // fallback to existing implementation if the new helper fails for any reason
    try {
      const old = await getEarningsSummaryForAttendant({ attendantId, periodKey, periodLabel });
      summary = { sales: old.sales ?? 0, netPay: old.netPay ?? 0, _raw: old };
    } catch (err) {
      summary = { sales: 0, netPay: 0 };
    }
  }

  const periodKeyVariants = getPeriodKeyVariantsFromDates(period.start, period.end);
  const adjustmentKeys = periodKeyVariants.length ? periodKeyVariants : [periodKey];
  const adjustments = await prisma.attendantPayrollAdjustment.findMany({
    where: { attendantId, periodKey: { in: adjustmentKeys } },
    orderBy: { createdAt: "desc" },
  });
  const currentLedger =
    currentLedgerRaw === null
      ? null
      : {
          commissionDirect: Number(currentLedgerRaw.commissionDirect ?? 0),
          commissionMarketplaceJumia: Number(currentLedgerRaw.commissionMarketplaceJumia ?? 0),
          commissionMarketplaceKilimall: Number(currentLedgerRaw.commissionMarketplaceKilimall ?? 0),
          netCommission: Number(currentLedgerRaw.netCommission ?? 0),
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
              : {},
        };

  const recentPeriods = getRecentTradingPeriods(2);
  const previousPeriod = recentPeriods.length > 1 ? recentPeriods[1] : null;
  const previousLedgerRaw =
    previousPeriod &&
    (await prisma.commissionLedger.findUnique({
      where: {
        userId_periodStart_periodEnd: {
          userId: attendantId,
          periodStart: previousPeriod.start,
          periodEnd: previousPeriod.end,
        },
      },
    }));
  const previousLedger = previousLedgerRaw
    ? { netCommission: Number(previousLedgerRaw.netCommission ?? 0) }
    : null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Payroll — {attendant.name ?? attendant.email}</h1>
        <p className="text-sm text-slate-400">Manage comp plans and payroll adjustments for this attendant.</p>
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
      />
    </div>
  );
}
