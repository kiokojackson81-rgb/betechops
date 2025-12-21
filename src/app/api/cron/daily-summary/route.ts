import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { pushInternalDailySummary } from "@/lib/chatraceInternal";
import { extractReceiptTotalKES } from "@/lib/receiptExtract";

function decToNumber(value: any): number {
  if (value == null) return 0;
  if (typeof value?.toNumber === "function") {
    return value.toNumber();
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function normalizePaymentMethod(value: string | null | undefined): string {
  if (!value) return "";
  return String(value).trim().toLowerCase();
}

export async function GET() {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  const receipts = await prisma.receipt.findMany({
    where: {
      docType: "RECEIPT",
      createdAt: { gte: start, lte: end },
    },
    select: {
      id: true,
      totals: true,
      data: true,
    },
  });

  const totalReceipts = receipts.length;
  const totalSales = receipts.reduce((sum, receipt) => sum + extractReceiptTotalKES(receipt as any), 0);
  const totalCashSales = receipts
    .filter((receipt) => normalizePaymentMethod((receipt.data as any)?.paymentMethod || (receipt.totals as any)?.paymentMethod) === "cash")
    .reduce((sum, receipt) => sum + extractReceiptTotalKES(receipt as any), 0);
  const totalMpesaSales = receipts
    .filter((receipt) => {
      const method = normalizePaymentMethod((receipt.data as any)?.paymentMethod || (receipt.totals as any)?.paymentMethod);
      return method.includes("mpesa") || method.includes("m-pesa");
    })
    .reduce((sum, receipt) => sum + extractReceiptTotalKES(receipt as any), 0);

  const profitAgg = await prisma.profitSnapshot.aggregate({
    where: {
      computedAt: { gte: start, lte: end },
    },
    _sum: { profit: true },
  });

  const totalProfit = decToNumber(profitAgg._sum.profit);
  const summaryDate = start.toISOString().slice(0, 10);

  const chatrace = await pushInternalDailySummary({
    requestId: `daily-${summaryDate}`,
    dateLabel: summaryDate,
    totalReceipts: String(totalReceipts),
    totalSales: String(totalSales),
    totalProfit: String(totalProfit),
    totalMpesa: String(totalMpesaSales),
    totalCash: String(totalCashSales),
  });

  return NextResponse.json({
    ok: true,
    range: { start, end },
    totals: { totalReceipts, totalSales, totalCashSales, totalMpesaSales, totalProfit },
    chatrace,
  });
}
