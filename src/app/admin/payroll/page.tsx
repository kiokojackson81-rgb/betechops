import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { getTradingPeriodFor } from "@/lib/tradingPeriod";
import { requireRole } from "@/lib/api";
import PayrollTableClient from "./PayrollTableClient";
import type { AdjustmentBreakdown, PayrollRow } from "./types";

export const dynamic = "force-dynamic";

const baseSummary = () => ({
  totalBonus: 0,
  totalDeduction: 0,
  breakdown: {
    chama: 0,
    lateness: 0,
    discipline: 0,
    other: 0,
    bonus: 0,
    commissionTopUp: 0,
    penalties: 0,
  },
});

export default async function AdminPayrollPage() {
  const auth = await requireRole("ADMIN");
  if (!auth.ok) {
    redirect("/admin/login");
  }

  const period = getTradingPeriodFor(new Date());
  const periodKey = period.key;

  const attendants = await prisma.user.findMany({
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

  const attendantIds = attendants.map((attendant) => attendant.id);

  const [plans, ledgers, adjustments] = await Promise.all([
    prisma.attendantCompPlan.findMany({ where: { attendantId: { in: attendantIds } } }),
    prisma.commissionLedger.findMany({
      where: {
        periodStart: period.start,
        periodEnd: period.end,
        userId: { in: attendantIds },
      },
    }),
    prisma.attendantPayrollAdjustment.findMany({
      where: { periodKey, attendantId: { in: attendantIds } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const planMap = new Map(plans.map((plan) => [plan.attendantId, plan]));
  const ledgerMap = new Map(ledgers.map((ledger) => [ledger.userId, ledger]));

  const adjustmentsByAttendant = new Map<string, ReturnType<typeof baseSummary>>();
  for (const adjustment of adjustments) {
    const existing = adjustmentsByAttendant.get(adjustment.attendantId) ?? baseSummary();
    const amount = adjustment.amount ?? 0;
    const bonusType = adjustment.adjustmentType === "BONUS";
    const topUpType = adjustment.adjustmentType === "COMMISSION_TOPUP";

    if (bonusType) {
      existing.totalBonus += amount;
      existing.breakdown.bonus += amount;
    } else if (topUpType) {
      existing.totalBonus += amount;
      existing.breakdown.commissionTopUp += amount;
    } else {
      existing.totalDeduction += amount;
      if (adjustment.adjustmentType === "CHAMA") existing.breakdown.chama += amount;
      if (adjustment.adjustmentType === "LATENESS") existing.breakdown.lateness += amount;
      if (adjustment.adjustmentType === "DISCIPLINE") existing.breakdown.discipline += amount;
      if (adjustment.adjustmentType === "OTHER") existing.breakdown.other += amount;
    }

    adjustmentsByAttendant.set(adjustment.attendantId, existing);
  }

  const rows: PayrollRow[] = attendants.map((attendant) => {
    const plan = planMap.get(attendant.id);
    const ledger = ledgerMap.get(attendant.id);
    const summary = adjustmentsByAttendant.get(attendant.id) ?? baseSummary();

    const commissionDirect = Number(ledger?.commissionDirect ?? 0);
    const commissionMarketplaceJumia = Number(ledger?.commissionMarketplaceJumia ?? 0);
    const commissionMarketplaceKilimall = Number(ledger?.commissionMarketplaceKilimall ?? 0);
    const commissionTotal = Number(
      ledger?.commissionTotal ?? ledger?.netCommission ?? ledger?.grossCommission ?? 0,
    );
    const grossCommission = Number(ledger?.grossCommission ?? 0);
    const penalties = Number(ledger?.penalties ?? 0);
    const detail = ledger?.detail as { totalSales?: number; totalProfit?: number } | undefined;

    const baseSalary = plan?.baseSalary ?? 0;
    const transportAllowance = plan?.defaultTransportAllowance ?? 0;

    const totalEarnings = baseSalary + transportAllowance + commissionTotal + summary.totalBonus;
    const totalDeductions = summary.totalDeduction + penalties;
    const netPay = totalEarnings - totalDeductions;

    summary.breakdown.penalties = penalties;

    return {
      attendantId: attendant.id,
      name: attendant.name,
      email: attendant.email,
      attendantCategory: attendant.attendantCategory,
      isActive: attendant.isActive,
      baseSalary,
      transportAllowance,
      commission: commissionTotal,
      commissionGross: grossCommission,
      bonusTotal: summary.totalBonus,
      deductionTotal: totalDeductions,
      totalEarnings,
      totalDeductions,
      netPay,
      totalSales: Number(detail?.totalSales ?? 0),
      totalProfit: Number(detail?.totalProfit ?? 0),
      adjustmentBreakdown: summary.breakdown as AdjustmentBreakdown,
      commissionDirect,
      commissionMarketplaceJumia,
      commissionMarketplaceKilimall,
      commissionTotal,
      commissionBreakdown: ledger?.commissionBreakdown ?? null,
    };
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Admin payroll</h1>
        <p className="text-sm text-slate-400">Snapshot for {period.label}. Data comes from commission-ledger, comp plans and adjustments.</p>
      </header>
      <PayrollTableClient rows={rows} periodLabel={period.label} />
    </div>
  );
}
