import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTradingPeriodFor, getRecentTradingPeriods } from "@/lib/tradingPeriod";
import { getCommissionSummaryForSales } from "@/lib/marketingCommission";
import { requireRole } from "@/lib/api";

const toNumber = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const quote = (s: unknown) => `"${String(s ?? "").replace(/"/g, '""')}"`;

export async function GET(req: Request) {
  const auth = await requireRole("ADMIN");
  if (!auth.ok) return auth.res;

  const url = new URL(req.url);
  const periodKey = url.searchParams.get("period") || undefined;
  const dow = url.searchParams.get("dow") || undefined;
  const dows = url.searchParams.get("dows") || undefined; // comma-separated days

  const current = getTradingPeriodFor(new Date());
  const period =
    (periodKey && getRecentTradingPeriods(12).find((p) => p.key === periodKey)) || current;

  const where: any = {
    date: { gte: period.start, lte: period.end },
  };
  if (dow) where.dayOfWeek = dow;
  if (dows) {
    const arr = dows.split(",").map((s) => s.trim()).filter(Boolean);
    if (arr.length) where.dayOfWeek = { in: arr };
  }

  const entries = await prisma.marketingDailyEntry.findMany({
    where,
    include: { sales: true },
    orderBy: { date: "asc" },
  });

  const rows: string[] = [];
  rows.push(["Date", "Day", "Total Sales", "Total Profit", "MPESA", "Cash", "Items"].join(","));

  let mpesaTotal = 0;
  let cashTotal = 0;
  let itemsTotal = 0;

  entries.forEach((e) => {
    const dateStr = e.date.toISOString().split("T")[0];
    const mpesa = e.sales.filter((s) => s.paymentMethod === "MPESA").reduce((sum, s) => sum + toNumber(s.sellingPrice), 0);
    const cash = e.sales.filter((s) => s.paymentMethod === "CASH").reduce((sum, s) => sum + toNumber(s.sellingPrice), 0);
    const items = e.sales.reduce((sum, s) => sum + (Number((s as any).itemsCount) || 1), 0);
    mpesaTotal += mpesa;
    cashTotal += cash;
    itemsTotal += items;
    rows.push(
      [
        quote(dateStr),
        quote(e.dayOfWeek),
        toNumber(e.totalSales),
        toNumber(e.totalProfit),
        mpesa,
        cash,
        items,
      ].join(",")
    );
  });

  const periodSales = entries.reduce((sum, e) => sum + toNumber(e.totalSales), 0);
  const periodProfit = entries.reduce((sum, e) => sum + toNumber(e.totalProfit), 0);
  const commission = getCommissionSummaryForSales(periodSales);

  rows.push(["TOTAL", "", periodSales, periodProfit, mpesaTotal, cashTotal, itemsTotal].join(","));
  rows.push(["COMMISSION", "", commission.commission, "", "", "", ""].join(","));

  const csv = rows.join("\n");
  const filename = `marketing-period-${period.key}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
