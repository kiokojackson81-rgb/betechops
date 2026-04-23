import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api";
import { getTradingPeriodFor, parseTradingPeriodKey } from "@/lib/tradingPeriod";
import { getOrCreateCommissionPeriod } from "@/lib/commission";
import { composeIdentityResponse, resolveTargetUserId } from "@/lib/resolveTargetUser";
import { buildPayrollRow } from "@/lib/adminPayroll";

export const dynamic = "force-dynamic";

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

  let period;
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
  const rows = await Promise.all(attendants.map((attendant) => buildPayrollRow(attendant, period as any)));

  const data = { periodLabel: (period as any).label ?? "", rows };
  return NextResponse.json(composeIdentityResponse(meta, data));
}
