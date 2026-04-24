import { NextResponse } from "next/server";
import type { Role } from "@prisma/client";
import { composeIdentityResponse, resolveTargetUserId } from "@/lib/resolveTargetUser";
import { prisma } from "@/lib/prisma";
import { getEmployeeWellnessOverview } from "@/lib/wellness";
import { buildPayrollRow } from "@/lib/adminPayroll";
import { getTradingPeriodFor } from "@/lib/tradingPeriod";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const identity = await resolveTargetUserId(req, { allowedImpersonationRoles: ["ADMIN" as Role] });
  const userId = identity.resolvedUserId;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      attendantCategory: true,
      isActive: true,
    },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const period = getTradingPeriodFor(new Date());
  const [overview, payroll] = await Promise.all([
    getEmployeeWellnessOverview(userId),
    buildPayrollRow(user, period),
  ]);

  return NextResponse.json(
    composeIdentityResponse(identity, {
      ...overview,
      payroll: {
        periodLabel: period.label,
        attendantCategory: payroll.attendantCategory,
        baseSalary: payroll.baseSalary,
        transportAllowance: payroll.transportAllowance,
        commissionDirect: payroll.commissionDirect,
        commissionMarketplaceJumia: payroll.commissionMarketplaceJumia,
        commissionMarketplaceKilimall: payroll.commissionMarketplaceKilimall,
        commissionTotal: payroll.commissionTotal,
        bonusTotal: payroll.adjustmentBreakdown.bonus,
        commissionTopUpTotal: payroll.adjustmentBreakdown.commissionTopUp,
        chamaTotal: payroll.adjustmentBreakdown.chama,
        latenessTotal: payroll.adjustmentBreakdown.lateness,
        disciplineTotal: payroll.adjustmentBreakdown.discipline,
        otherDeductionsTotal: payroll.adjustmentBreakdown.other,
        cashAdvanceTotal: payroll.adjustmentBreakdown.cashAdvance,
        totalEarnings: payroll.totalEarnings,
        totalDeductions: payroll.totalDeductions,
        netPay: payroll.netPay,
        totalSales: payroll.totalSales,
        totalProfit: payroll.totalProfit,
        adjustmentEntries: payroll.adjustmentEntries,
      },
    }),
  );
}
