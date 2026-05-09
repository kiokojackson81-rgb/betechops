import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import {
  computeEffectiveCashAdvanceRemainingBalance,
  ensureLeaveBalance,
  isCashAdvanceInstallmentOutstanding,
  normalizeCashAdvanceRepaymentPeriodValue,
  normalizePaidLeaveEntitlements,
} from "@/lib/wellness";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireRole(["ADMIN", "SUPERVISOR"]);
  if (!auth.ok) return auth.res;

  const [pendingLeaveRequests, pendingCashAdvances, pendingAdjustmentRequests, approvedAdvances, staff] = await Promise.all([
    prisma.leaveRequest.findMany({
      where: { status: "PENDING" },
      include: {
        user: { select: { id: true, name: true, email: true, attendantCategory: true } },
      },
      orderBy: [{ createdAt: "asc" }],
      take: 30,
    }),
    prisma.cashAdvance.findMany({
      where: { status: "PENDING" },
      include: {
        user: { select: { id: true, name: true, email: true, attendantCategory: true } },
      },
      orderBy: [{ createdAt: "asc" }],
      take: 30,
    }),
    (prisma as any).payrollAdjustmentRequest.findMany({
      where: { status: "PENDING" },
      include: {
        attendant: { select: { id: true, name: true, email: true, attendantCategory: true } },
        requestedBy: { select: { id: true, name: true, email: true, attendantCategory: true } },
      },
      orderBy: [{ createdAt: "asc" }],
      take: 50,
    }),
    prisma.cashAdvance.findMany({
      where: { status: "APPROVED" },
      include: {
        user: { select: { id: true, name: true, email: true, attendantCategory: true } },
        installments: {
          orderBy: [{ dueDate: "asc" }],
          take: 3,
        },
        approvedBy: { select: { id: true } },
      },
      orderBy: [{ approvedAt: "desc" }],
      take: 50,
    }),
    prisma.user.findMany({
      where: { role: { in: ["ATTENDANT", "SUPERVISOR"] } },
      select: {
        id: true,
        name: true,
        email: true,
        attendantCategory: true,
        leaveBalance: true,
      },
      orderBy: [{ name: "asc" }],
      take: 100,
    }),
  ]);

  const leaveBalances = await Promise.all(
    staff.map(async (user) => {
      const balance = user.leaveBalance ?? (await ensureLeaveBalance(user.id));
      return {
        ...normalizePaidLeaveEntitlements(balance),
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          attendantCategory: user.attendantCategory,
        },
      };
    }),
  );

  const outstandingAdvances = approvedAdvances
    .map((row) => ({
      ...row,
      repaymentPeriod: normalizeCashAdvanceRepaymentPeriodValue(row.repaymentPeriod),
      remainingBalance: computeEffectiveCashAdvanceRemainingBalance(row),
      installments: (row.installments ?? []).filter((item) =>
        isCashAdvanceInstallmentOutstanding(item, row.approvedAt),
      ),
    }))
    .filter((row) => Number(row.remainingBalance ?? 0) > 0)
    .sort((a, b) => Number(b.remainingBalance ?? 0) - Number(a.remainingBalance ?? 0));

  return NextResponse.json({
    pendingLeaveRequests,
    pendingCashAdvances,
    pendingAdjustmentRequests,
    outstandingAdvances,
    leaveBalances,
    totals: {
      pendingLeaveCount: pendingLeaveRequests.length,
      pendingCashAdvanceCount: pendingCashAdvances.length,
      pendingAdjustmentRequestCount: pendingAdjustmentRequests.length,
      outstandingAdvanceBalance: outstandingAdvances.reduce((sum, item) => sum + Number(item.remainingBalance ?? 0), 0),
    },
  });
}
