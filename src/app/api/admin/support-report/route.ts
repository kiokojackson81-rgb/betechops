import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTradingPeriodFor } from "@/lib/tradingPeriod";
import { requireRole } from "@/lib/api";
import { getCommissionSummaryForSales } from "@/lib/marketingCommission";

export const dynamic = "force-dynamic";

const formatLabel = (date: Date) =>
  date.toLocaleDateString("en-KE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

export async function GET(req: Request) {
  const auth = await requireRole("ADMIN");
  if (!auth.ok) return auth.res;

  const url = new URL(req.url);
  const fromParam = url.searchParams.get("from");
  const toParam = url.searchParams.get("to");
  const dayParam = url.searchParams.get("day");
  const attendantId = url.searchParams.get("attendantId");
  const searchParam = url.searchParams.get("search")?.trim();

  const defaultPeriod = getTradingPeriodFor(new Date());
  const fromDate = fromParam ? new Date(fromParam) : defaultPeriod.start;
  const toDate = toParam ? new Date(toParam) : defaultPeriod.end;

  const where: Record<string, unknown> = {
    date: {
      gte: fromDate,
      lte: toDate,
    },
  };

  if (dayParam) {
    where.dayOfWeek = dayParam;
  }
  if (attendantId) {
    where.submittedById = attendantId;
  }
  if (searchParam) {
    where.OR = [
      { submittedBy: { is: { name: { contains: searchParam, mode: "insensitive" } } } },
      { submittedBy: { is: { email: { contains: searchParam, mode: "insensitive" } } } },
    ];
  }

  const entries = await prisma.supportDailyEntry.findMany({
    where,
    include: {
      submittedBy: { select: { id: true, name: true, email: true } },
      receipts: { include: { items: true } },
    },
    orderBy: { date: "desc" },
  });

  const mapped = entries.map((entry) => {
    const itemsSold = entry.receipts.reduce((sum, receipt) => sum + receipt.items.length, 0);
    const performanceEarnings = (entry.newBatteries + entry.changedBatteries) * 70;
    const commission = getCommissionSummaryForSales(entry.totalSales).commission;
    return {
      id: entry.id,
      date: entry.date.toISOString().split("T")[0],
      dayOfWeek: entry.dayOfWeek,
      attendantId: entry.submittedById,
      attendantName: entry.submittedBy?.name ?? "Unknown",
      attendantEmail: entry.submittedBy?.email ?? null,
      totalSales: entry.totalSales,
      totalProfit: entry.totalProfit,
      itemsSold,
      receipts: entry.receipts.length,
      newBatteries: entry.newBatteries,
      changedBatteries: entry.changedBatteries,
      performanceEarnings,
      commission,
    };
  });

  const summary = mapped.reduce(
    (acc, entry) => {
      acc.periodSales += entry.totalSales;
      acc.itemsSold += entry.itemsSold;
      acc.newBatteries += entry.newBatteries;
      acc.changedBatteries += entry.changedBatteries;
      acc.performanceEarnings += entry.performanceEarnings;
      acc.commission += entry.commission;
      acc.receipts += entry.receipts;
      return acc;
    },
    {
      periodSales: 0,
      itemsSold: 0,
      newBatteries: 0,
      changedBatteries: 0,
      performanceEarnings: 0,
      commission: 0,
      receipts: 0,
    },
  );

  const periodLabel = `${formatLabel(fromDate)} – ${formatLabel(toDate)}`;

  return NextResponse.json({
    periodLabel,
    entries: mapped,
    summary,
  });
}
