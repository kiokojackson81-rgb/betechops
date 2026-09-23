import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api";
import { getTradingPeriodFor, parseTradingPeriodKey } from "@/lib/tradingPeriod";
import { composeIdentityResponse, resolveTargetUserId } from "@/lib/resolveTargetUser";
import { calculatePayrollForAttendant } from "@/lib/adminPayroll";
import { payrollEligibleUserWhere } from "@/lib/payrollEligibility";
import type { TradingPeriod } from "@/lib/tradingPeriod";
import { startPayrollTiming } from "@/lib/payrollTiming";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const timing = startPayrollTiming("/api/admin/payroll/summary");
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

  const attendants = await prisma.user.findMany({
    where: payrollEligibleUserWhere(attendantIdParam ? { id: attendantIdParam } : {}),
    orderBy: [{ attendantCategory: "asc" }, { name: "asc" }],
    select: { id: true, name: true, email: true, attendantCategory: true, isActive: true },
  });
  const rows = await Promise.all(
    attendants.map(async (attendant) =>
      calculatePayrollForAttendant(attendant, period),
    ),
  );

  const data = { periodLabel: period.label ?? "", rows };
  return timing.finish(NextResponse.json(composeIdentityResponse(meta, data)));
}
