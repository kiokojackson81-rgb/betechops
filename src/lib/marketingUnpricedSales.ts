import { prisma } from "@/lib/prisma";
import { getCurrentTradingPeriod } from "./marketingPeriod";

export async function getUnpricedDailySalesForCurrentPeriod() {
  const { startDate, endDate } = await getCurrentTradingPeriod();
  const [dailyReportSales, supportItems] = await Promise.all([
    prisma.dailySale.findMany({
      where: {
        dailyReport: {
          date: {
            gte: startDate,
            lte: endDate,
          },
        },
        marketingSales: { none: {} },
      },
      include: {
        dailyReport: {
          include: { user: true },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.supportReceiptItem.findMany({
      where: {
        buyingPrice: 0,
        receipt: {
          dailyEntry: {
            date: {
              gte: startDate,
              lte: endDate,
            },
          },
        },
      },
      include: {
        receipt: {
          include: {
            dailyEntry: {
              include: { submittedBy: true },
            },
            items: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const marketingSales = dailyReportSales.map((sale) => ({
    id: sale.id,
    source: "daily-sale" as const,
    saleDate: (sale.dailyReport?.date ?? sale.createdAt).toISOString(),
    day: sale.dailyReport?.day ?? null,
    productName: sale.productName,
    sellingPrice: Number(sale.price),
    paymentMethod: (sale.paymentMethod as "MPESA" | "CASH" | null) ?? null,
    receiptNumber: sale.receiptNumber ?? "",
    attendantName:
      sale.dailyReport?.submittedBy ??
      sale.dailyReport?.user?.name ??
      "Unknown",
    attendantEmail: sale.dailyReport?.user?.email ?? null,
    receiptTotal: Number(sale.price),
  }));

  const supportSales = supportItems.map((item) => {
    const receipt = item.receipt;
    const entry = receipt.dailyEntry;
    const itemsCount = Math.max(1, receipt.items.length);
    const productLabel = item.productName || "Support sale";
    return {
      id: item.id,
      source: "support" as const,
      saleDate: (entry?.date ?? receipt.createdAt ?? new Date()).toISOString(),
      day: entry?.dayOfWeek ?? null,
      productName: productLabel,
      sellingPrice: Math.round(Number(receipt.sellingTotal) / itemsCount),
      paymentMethod: (receipt.paymentMethod as "MPESA" | "CASH" | null) ?? null,
      receiptNumber: receipt.receiptNumber ?? "",
      attendantName: entry?.submittedBy?.name ?? "Support attendant",
      attendantEmail: entry?.submittedBy?.email ?? null,
      receiptTotal: Number(receipt.sellingTotal ?? 0),
    };
  });

  return [...marketingSales, ...supportSales];
}
