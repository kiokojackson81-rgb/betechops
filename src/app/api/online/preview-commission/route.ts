import { NextResponse } from "next/server";
import { requireAttendant } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTradingPeriodFor } from "@/lib/tradingPeriod";
import { computeOnlinePeriodCommission } from "@/lib/onlineCommission";
import { WeeklySaleStatus } from "@prisma/client";
import { composeIdentityResponse, resolveTargetUserId } from "@/lib/resolveTargetUser";

export const dynamic = "force-dynamic";

const parseDateParam = (value: string | null) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export async function GET(req: Request) {
  const auth = await requireAttendant(req, ["JUMIA_KILIMALL_OPS", "BETECH_OPS", "SUPERVISOR", "ADMIN"]);
  if (!auth.ok) return auth.res;

  const url = new URL(req.url);
  const identity = await resolveTargetUserId(req);
  const meta = identity;
  const attendantId = identity.resolvedUserId;
  if (!attendantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const startParam = parseDateParam(url.searchParams.get("start"));
  const endParam = parseDateParam(url.searchParams.get("end"));

  const period = getTradingPeriodFor(new Date());
  const start = startParam ?? period.start;
  const end = endParam ?? period.end;

  // marketplace totals from approved weeklySale manual/approved entries
  const entries = await prisma.weeklySale.findMany({
    where: {
      userId: attendantId,
      status: WeeklySaleStatus.APPROVED,
      AND: [{ weekEnd: { gte: start } }, { weekStart: { lte: end } }],
    },
    select: { platform: true, amount: true },
  });

  const marketplaceTotals = entries.reduce(
    (acc, e) => {
      const value = Number(e.amount ?? 0);
      if (e.platform === "JUMIA") acc.jumia += value;
      if (e.platform === "KILIMALL") acc.kilimall += value;
      return acc;
    },
    { jumia: 0, kilimall: 0 },
  );

  // direct sales from supportDailyEntry
  const directEntries = await prisma.supportDailyEntry.findMany({
    where: { submittedById: attendantId, date: { gte: start, lte: end } },
    select: { totalSales: true, totalProfit: true },
  });
  const directTotals = directEntries.reduce(
    (acc, e) => {
      acc.sales += Number(e.totalSales ?? 0);
      acc.profit += Number(e.totalProfit ?? 0);
      return acc;
    },
    { sales: 0, profit: 0 },
  );

  const periodInputs = {
    attendantId,
    periodStart: start,
    periodEnd: end,
    directSales: directTotals.sales,
    directProfit: directTotals.profit,
    jumiaSales: marketplaceTotals.jumia,
    kilimallSales: marketplaceTotals.kilimall,
  };

  const result = computeOnlinePeriodCommission(periodInputs as any);
  return NextResponse.json(composeIdentityResponse(meta, result as unknown as Record<string, unknown>));
}
