import type { PendingReceiptItem, UnpricedSale } from "@/lib/marketingUnpricedSales";

export type ReceiptGroupingItem = PendingReceiptItem & { saleValue?: number };

export type GroupedUnpricedSale = UnpricedSale & {
  groupedSaleIds?: string[];
  receiptItems?: ReceiptGroupingItem[];
};

const normalize = (value: string | null | undefined) => (value ?? "").trim().toLowerCase();

const dateKey = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().split("T")[0];
};

const buildReceiptKey = (sale: UnpricedSale): string | null => {
  const receipt = normalize(sale.receiptNumber);
  if (!receipt) return null;
  const attendant = normalize(sale.attendantEmail) || normalize(sale.attendantName) || "unknown";
  const day = dateKey(sale.saleDate);
  return `${attendant}|${day}|${receipt}`;
};

export function groupMarketingUnpricedSales(sales: UnpricedSale[]): GroupedUnpricedSale[] {
  const groups = new Map<string, GroupedUnpricedSale>();
  const emitted = new Set<string>();
  const result: GroupedUnpricedSale[] = [];

  for (const sale of sales) {
    if (sale.source !== "daily-sale") continue;
    const key = buildReceiptKey(sale);
    if (!key) continue;

    const item: ReceiptGroupingItem = {
      id: sale.id,
      productName: sale.productName,
      buyingPrice: null,
      saleValue: sale.sellingPrice,
    };

    const existing = groups.get(key);
    if (existing) {
      existing.sellingPrice += sale.sellingPrice;
      existing.receiptItems = [...(existing.receiptItems ?? []), item];
      existing.groupedSaleIds = [...(existing.groupedSaleIds ?? []), sale.id];
      const pending = (existing.itemsPending ?? 0) + 1;
      existing.itemsPending = pending;
      existing.itemsTotal = pending;
      if (existing.paymentMethod !== sale.paymentMethod) {
        existing.paymentMethod = null;
      }
      if (new Date(sale.saleDate).getTime() < new Date(existing.saleDate).getTime()) {
        existing.saleDate = sale.saleDate;
        existing.day = sale.day;
      }
      continue;
    }

    groups.set(key, {
      ...sale,
      id: `receipt:${key}`,
      productName: sale.receiptNumber ? `Receipt ${sale.receiptNumber}` : sale.productName,
      sellingPrice: sale.sellingPrice,
      receiptItems: [item],
      groupedSaleIds: [sale.id],
      itemsPending: 1,
      itemsTotal: 1,
    });
  }

  for (const sale of sales) {
    if (sale.source !== "daily-sale") {
      result.push(sale);
      continue;
    }
    const key = buildReceiptKey(sale);
    if (key && groups.has(key)) {
      if (!emitted.has(key)) {
        result.push(groups.get(key)!);
        emitted.add(key);
      }
    } else {
      result.push(sale);
    }
  }

  return result;
}
