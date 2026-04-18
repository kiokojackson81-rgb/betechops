import { prisma } from "@/lib/prisma";
import { getCurrentTradingPeriodFor } from "./marketingPeriod";
import { nowInNairobi } from "@/lib/timezone";
import { canonicalReceiptNumber } from "./receiptGuard";

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

function isMeaningfulProductName(value: string | null | undefined): value is string {
  const normalized = String(value ?? "").trim();
  if (!normalized) return false;
  return normalized.toLowerCase() !== "item";
}

function summarizeReceiptProductName(names: string[], receiptNumber: string | null | undefined): string {
  const uniqueNames = Array.from(new Set(names.filter(isMeaningfulProductName)));
  if (uniqueNames.length === 1) return uniqueNames[0];
  if (uniqueNames.length > 1) return `${uniqueNames[0]} +${uniqueNames.length - 1} more`;
  return `Receipt ${receiptNumber || ""}`.trim() || "Support receipt";
}

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

  const receiptNumberCandidates = Array.from(
    new Set(
      supportReceipts.flatMap((receipt) => {
        const raw = typeof receipt.receiptNumber === "string" ? receipt.receiptNumber.trim() : "";
        const canonical = canonicalReceiptNumber(raw) ?? "";
        return [raw, canonical].filter((value): value is string => Boolean(value));
      }),
    ),
  );

  const receiptOrderItems =
    receiptNumberCandidates.length > 0
      ? await prisma.order.findMany({
          where: { orderNumber: { in: receiptNumberCandidates } },
          select: {
            orderNumber: true,
            items: {
              select: {
                product: { select: { name: true } },
              },
            },
          },
        })
      : [];

  const orderItemNamesByReceiptNumber = new Map<string, string[]>();
  for (const order of receiptOrderItems) {
    const itemNames = order.items
      .map((item) => String(item.product?.name || "").trim())
      .filter(isMeaningfulProductName);
    if (!itemNames.length) continue;
    const raw = order.orderNumber?.trim();
    const canonical = canonicalReceiptNumber(order.orderNumber ?? undefined);
    if (raw) orderItemNamesByReceiptNumber.set(raw, itemNames);
    if (canonical) orderItemNamesByReceiptNumber.set(canonical, itemNames);
  }

  const supportSales: UnpricedSale[] = supportReceipts
    .map((receipt) => {
      const entry = receipt.dailyEntry;
      const pendingItems = (receipt.items || []).filter((item) => Number(item.buyingPrice ?? 0) <= 0);
      if (!pendingItems.length) return null;
      const receiptNumber = receipt.receiptNumber?.trim() ?? "";
      const fallbackItemNames =
        orderItemNamesByReceiptNumber.get(receiptNumber) ??
        orderItemNamesByReceiptNumber.get(canonicalReceiptNumber(receiptNumber) ?? "") ??
        [];
      const resolvedReceiptItems = pendingItems.map((item, index) => {
        const resolvedName = isMeaningfulProductName(item.productName) ? item.productName.trim() : fallbackItemNames[index] || fallbackItemNames[0] || "Item";
        return {
          id: item.id,
          productName: resolvedName,
          buyingPrice: item.buyingPrice ? Number(item.buyingPrice) : null,
        };
      });
      return {
        id: receipt.id,
        source: "support" as const,
        saleDate: (entry?.date ?? receipt.createdAt ?? new Date()).toISOString(),
        day: entry?.dayOfWeek ?? null,
        productName: summarizeReceiptProductName(
          resolvedReceiptItems.map((item) => item.productName),
          receipt.receiptNumber,
        ),
        sellingPrice: Number(receipt.sellingTotal ?? 0),
        paymentMethod: (receipt.paymentMethod as "MPESA" | "CASH" | null) ?? null,
        receiptNumber,
        attendantName: entry?.submittedBy?.name ?? "Support attendant",
        attendantEmail: entry?.submittedBy?.email ?? null,
        receiptTotal: Number(receipt.sellingTotal ?? 0),
        receiptItems: resolvedReceiptItems,
        itemsPending: pendingItems.length,
        itemsTotal: receipt.items.length || pendingItems.length,
      };
    })
    .filter(Boolean) as UnpricedSale[];

  // Exclude support receipts with zero sellingTotal from the unpriced list
  const filteredSupportSales = supportSales.filter((s) => (s.receiptTotal ?? 0) > 0);

  return [...marketingSales, ...filteredSupportSales];
}
