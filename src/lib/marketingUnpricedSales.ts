import { prisma } from "@/lib/prisma";
import { getCurrentTradingPeriodFor } from "./marketingPeriod";
import { nowInNairobi } from "@/lib/timezone";

export type PendingReceiptItem = {
  id: string;
  productName: string;
  buyingPrice: number | null;
};

export type UnpricedSale = {
  id: string;
  source: "daily-sale" | "support";
  saleDate: string;
  day: string | null;
  productName: string;
  sellingPrice: number;
  paymentMethod: "MPESA" | "CASH" | null;
  receiptNumber: string;
  attendantName: string;
  attendantEmail: string | null;
  receiptTotal?: number;
  receiptItems?: PendingReceiptItem[];
  itemsPending?: number;
  itemsTotal?: number;
};

export async function getUnpricedDailySalesForCurrentPeriod(): Promise<UnpricedSale[]> {
  const { startDate, endDate } = await getCurrentTradingPeriodFor(nowInNairobi());
  const [dailyReportSales, supportReceipts] = await Promise.all([
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
    prisma.supportReceipt.findMany({
      where: {
        dailyEntry: {
          date: {
            gte: startDate,
            lte: endDate,
          },
        },
        items: {
          some: {
            buyingPrice: 0,
          },
        },
      },
      include: {
        dailyEntry: {
          include: { submittedBy: true },
        },
        items: true,
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const marketingSales: UnpricedSale[] = dailyReportSales.map((sale) => ({
    id: sale.id,
    source: "daily-sale",
    saleDate: (sale.dailyReport?.date ?? sale.createdAt).toISOString(),
    day: sale.dailyReport?.day ?? null,
    productName: sale.productName,
    sellingPrice: Number(sale.price),
    paymentMethod: (sale.paymentMethod as "MPESA" | "CASH" | null) ?? null,
    receiptNumber: sale.receiptNumber ?? "",
    attendantName: sale.dailyReport?.submittedBy ?? sale.dailyReport?.user?.name ?? "Unknown",
    attendantEmail: sale.dailyReport?.user?.email ?? null,
    receiptTotal: Number(sale.price),
    itemsPending: 1,
    itemsTotal: 1,
  }));

  const supportSales: UnpricedSale[] = supportReceipts
    .map((receipt) => {
      const entry = receipt.dailyEntry;
      const pendingItems = (receipt.items || []).filter((item) => Number(item.buyingPrice ?? 0) <= 0);
      if (!pendingItems.length) return null;
      return {
        id: receipt.id,
        source: "support" as const,
        saleDate: (entry?.date ?? receipt.createdAt ?? new Date()).toISOString(),
        day: entry?.dayOfWeek ?? null,
        productName: `Receipt ${receipt.receiptNumber || ""}`.trim() || "Support receipt",
        sellingPrice: Number(receipt.sellingTotal ?? 0),
        paymentMethod: (receipt.paymentMethod as "MPESA" | "CASH" | null) ?? null,
        receiptNumber: receipt.receiptNumber ?? "",
        attendantName: entry?.submittedBy?.name ?? "Support attendant",
        attendantEmail: entry?.submittedBy?.email ?? null,
        receiptTotal: Number(receipt.sellingTotal ?? 0),
        receiptItems: pendingItems.map((item) => ({
          id: item.id,
          productName: item.productName || "Item",
          buyingPrice: item.buyingPrice ? Number(item.buyingPrice) : null,
        })),
        itemsPending: pendingItems.length,
        itemsTotal: receipt.items.length || pendingItems.length,
      };
    })
    .filter(Boolean) as UnpricedSale[];

  return [...marketingSales, ...supportSales];
}
