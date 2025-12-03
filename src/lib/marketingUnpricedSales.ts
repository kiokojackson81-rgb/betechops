import { prisma } from "@/lib/prisma";
import { getCurrentTradingPeriod } from "./marketingPeriod";

export async function getUnpricedDailySalesForCurrentPeriod() {
  const { startDate, endDate } = await getCurrentTradingPeriod();
  const upc = await prisma.dailySale.findMany({
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
  });

  return upc.map((sale) => ({
    id: sale.id,
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
  }));
}
