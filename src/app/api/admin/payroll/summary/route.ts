import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api";
import { getTradingPeriodFor, parseTradingPeriodKey } from "@/lib/tradingPeriod";
import { getOrCreateCommissionPeriod } from "@/lib/commission";
import { composeIdentityResponse, resolveTargetUserId } from "@/lib/resolveTargetUser";
import { buildPayrollRow } from "@/lib/adminPayroll";
import { getBrendahCommissionForPeriod } from "@/lib/brendahCommission";
import type { PayrollRow } from "@/app/admin/payroll/types";
import type { TradingPeriod } from "@/lib/tradingPeriod";

export const dynamic = "force-dynamic";

async function applyBrendahCanonicalCommission(row: PayrollRow, period: TradingPeriod): Promise<PayrollRow> {
  if ((row.email ?? "").toLowerCase().trim() !== "brendah@betech.co.ke") return row;

  const result = await getBrendahCommissionForPeriod(row.attendantId, period);
  const totalEarnings =
    Number(row.baseSalary ?? 0) +
    Number(row.transportAllowance ?? 0) +
    result.commission +
    Number(row.bonusTotal ?? 0);

  return {
    ...row,
    totalSales: result.totalSales,
    totalProfit: result.totalProfit,
    totalReceipts: result.totalReceipts,
    commission: result.commission,
    commissionGross: result.commission,
    commissionDirect: result.commission,
    commissionTotal: result.commission,
    totalEarnings,
    netPay: totalEarnings - Number(row.totalDeductions ?? 0),
    commissionBreakdown: {
      ...(row.commissionBreakdown && typeof row.commissionBreakdown === "object" ? row.commissionBreakdown : {}),
      source: "brendah-canonical",
      mode: result.commissionMode,
      reason: result.commissionReason,
      periodKey: result.periodKey,
    },
  };
}

export async function GET(req: Request) {
  const auth = await requireRole("ADMIN");
  if (!auth.ok) return auth.res;

  const identity = await resolveTargetUserId(req);
  const meta = identity;

  const url = new URL(req.url);
  const startParam = url.searchParams.get("start");
  const endParam = url.searchParams.get("end");
  const periodKeyParam = url.searchParams.get("periodKey");
  const attendantIdParam = String(url.searchParams.get("attendantId") ?? "").trim();

  let period: TradingPeriod;
  if (periodKeyParam) {
    period = parseTradingPeriodKey(periodKeyParam) ?? getTradingPeriodFor(new Date());
  } else if (startParam && endParam) {
    const s = new Date(startParam);
    const e = new Date(endParam);
    const label = `${s.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })} - ${e.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}`;
    period = { key: `${startParam}_${endParam}`, start: s, end: e, label };
  } else {
    period = getTradingPeriodFor(new Date());
  }

  await getOrCreateCommissionPeriod(period.start);
  const attendants = await prisma.user.findMany({
    where: {
      role: { in: ["ATTENDANT", "SUPERVISOR"] },
      ...(attendantIdParam ? { id: attendantIdParam } : {}),
    },
    orderBy: [{ attendantCategory: "asc" }, { name: "asc" }],
    select: { id: true, name: true, email: true, attendantCategory: true, isActive: true },
  });
  const rows = await Promise.all(
    attendants.map(async (attendant) =>
      applyBrendahCanonicalCommission(await buildPayrollRow(attendant, period), period),
    ),
  );

  const data = { periodLabel: period.label ?? "", rows };
  return NextResponse.json(composeIdentityResponse(meta, data));
}
