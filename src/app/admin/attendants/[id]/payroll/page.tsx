import React from "react";
import { redirect } from "next/navigation";
import PayrollClient from "./PayrollClient";
import { prisma } from "@/lib/prisma";
import { getTradingPeriodFor } from "@/lib/tradingPeriod";
import { getEarningsSummaryForAttendant } from "@/lib/marketingEarnings";
import { requireRole } from "@/lib/api";
import Card from "@/app/_components/Card";

export const dynamic = "force-dynamic";

export default async function PayrollPage({ params }: { params: { id: string } }) {
  const auth = await requireRole("ADMIN");
  if (!auth.ok) {
    redirect("/admin/login");
  }

  const attendantId = params.id;
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

  const summary = await getEarningsSummaryForAttendant({ attendantId, periodKey, periodLabel });

  const adjustments = await prisma.attendantPayrollAdjustment.findMany({ where: { attendantId, periodKey }, orderBy: { createdAt: "desc" } });

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
      />
    </div>
  );
}
