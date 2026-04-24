import { NextResponse } from "next/server";
import { requireAttendant } from "@/lib/auth";
import { composeIdentityResponse, resolveTargetUserId } from "@/lib/resolveTargetUser";
import { getOnlineEarningsSummary } from "@/lib/onlineOps";
import { getTradingPeriodFor, parseTradingPeriodKey } from "@/lib/tradingPeriod";
import { prisma } from "@/lib/prisma";
import { buildPayrollRow } from "@/lib/adminPayroll";

export const dynamic = "force-dynamic";

const parseDateParam = (value: string | null) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export async function GET(req: Request) {
  const auth = await requireAttendant(req, ["JUMIA_KILIMALL_OPS", "BETECH_OPS", "SUPERVISOR", "ADMIN"]);
  if (!auth.ok) return auth.res;

  const identity = await resolveTargetUserId(req);
  const attendantId = identity.resolvedUserId;
  if (!attendantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const startParam = parseDateParam(url.searchParams.get("start"));
  const endParam = parseDateParam(url.searchParams.get("end"));
  const periodKeyParam = url.searchParams.get("periodKey");
  const requestedPeriod = parseTradingPeriodKey(periodKeyParam ?? undefined);

  const period =
    startParam && endParam
      ? {
          key: requestedPeriod?.key ?? "custom",
          label: requestedPeriod?.label ?? "Selected period",
          start: startParam,
          end: endParam,
        }
      : requestedPeriod ?? getTradingPeriodFor(new Date());

  const attendant = await prisma.user.findUnique({
    where: { id: attendantId },
    select: { id: true, name: true, email: true, attendantCategory: true, isActive: true },
  });
  if (!attendant) {
    return NextResponse.json({ error: "Attendant not found" }, { status: 404 });
  }

  const [summary, payrollRow] = await Promise.all([
    getOnlineEarningsSummary(attendantId, { period }),
    buildPayrollRow(attendant, period),
  ]);

  const payload = {
    ...summary,
    attendantCategory: payrollRow.attendantCategory,
    baseSalary: payrollRow.baseSalary,
    transportAllowance: payrollRow.transportAllowance,
    directCommission: payrollRow.commissionDirect,
    commissionDirect: payrollRow.commissionDirect,
    commissionMarketplaceJumia: payrollRow.commissionMarketplaceJumia,
    commissionMarketplaceKilimall: payrollRow.commissionMarketplaceKilimall,
    commissionTotal: payrollRow.commissionTotal,
    grossCommission: payrollRow.commissionGross,
    bonusTotal: payrollRow.adjustmentBreakdown.bonus,
    commissionTopUpTotal: payrollRow.adjustmentBreakdown.commissionTopUp,
    chamaTotal: payrollRow.adjustmentBreakdown.chama,
    latenessTotal: payrollRow.adjustmentBreakdown.lateness,
    disciplineTotal: payrollRow.adjustmentBreakdown.discipline,
    otherDeductionsTotal: payrollRow.adjustmentBreakdown.other,
    totalEarnings: payrollRow.totalEarnings,
    totalDeductions: payrollRow.totalDeductions,
    netPay: payrollRow.netPay,
    adjustmentEntries: payrollRow.adjustmentEntries.map((entry) => ({
      id: entry.id,
      label: entry.label,
      amount: entry.amount,
      adjustmentType: entry.adjustmentType,
      adjustmentKind: entry.kind,
    })),
  };

  return NextResponse.json(composeIdentityResponse(identity, payload as unknown as Record<string, unknown>));
}
