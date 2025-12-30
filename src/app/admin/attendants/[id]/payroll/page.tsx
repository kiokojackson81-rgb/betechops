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

  // Prefer the more robust earnings summary implementation which tolerates
  // multiple periodKey formats and honours payroll adjustment kinds. Fall
  // back to the older marketing earnings helper if needed.
  let summary: any = null;
  try {
    const userSummary = await getEarningsSummaryForUser({ userId: attendantId, asOf: new Date() });
    summary = { sales: userSummary.totalSales, netPay: userSummary.netPay, _raw: userSummary };
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
    (await prisma.commissionLedger.findUnique({
      where: {
        userId_periodStart_periodEnd: {
          userId: attendantId,
          periodStart: period.start,
          periodEnd: period.end,
        },
      },
    })) ?? null;

  const recentPeriods = getRecentTradingPeriods(2);
  const previousPeriod = recentPeriods.length > 1 ? recentPeriods[1] : null;
  const previousLedger =
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
