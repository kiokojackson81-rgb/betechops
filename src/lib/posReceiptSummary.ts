import { prisma } from "@/lib/prisma";
import { normalizeReceiptNumber } from "@/lib/receiptKey";

type OrderItemCandidate = {
  quantity?: number | null;
};

type PosReceiptRow = {
  id: string;
  receiptNumber: string | null;
  totals: Record<string, unknown> | null;
  data: Record<string, unknown> | null;
  order?: {
    orderNumber?: string | null;
    totalAmount?: number | null;
    items?: OrderItemCandidate[];
  } | null;
};

export type PosReceiptSummary = {
  totalSales: number;
  totalProfit: number;
  totalItems: number;
  totalReceipts: number;
  receiptKeys: string[];
};

const toNumber = (value: unknown): number => {
  if (value === null || typeof value === "undefined") return 0;
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

const extractSales = (row: PosReceiptRow) => {
  const totals = row.totals ?? {};
  const data = row.data ?? {};
  return (
    toNumber(totals.sellingTotal) ||
    toNumber(totals.grandTotal) ||
    toNumber(totals.total) ||
    toNumber(totals.amount) ||
    toNumber(totals.subtotal) ||
    toNumber(data.total) ||
    toNumber(data.amount) ||
    toNumber(row.order?.totalAmount) ||
    0
  );
};

const extractProfit = (row: PosReceiptRow, sales: number) => {
  const totals = row.totals ?? {};
  const data = row.data ?? {};
  const candidate =
    toNumber(totals.profit) ||
    toNumber(data.profit) ||
    toNumber(totals.sellingTotal) - toNumber(totals.buyingTotal) ||
    toNumber(data.sellingTotal) - toNumber(data.buyingTotal);

  if (candidate !== 0) return candidate;
  const buying = toNumber(totals.buyingTotal) || toNumber(data.buyingTotal);
  if (buying > 0) {
    return sales - buying;
  }
  return 0;
};

const countItems = (row: PosReceiptRow) => {
  const items = row.order?.items ?? [];
  return items.reduce((sum, item) => sum + Math.max(1, Math.trunc(Number(item?.quantity ?? 1))), 0);
};

const canonicalKeyForRow = (row: PosReceiptRow) => {
  const canonicalNumber =
    normalizeReceiptNumber(row.receiptNumber) ||
    normalizeReceiptNumber(row.order?.orderNumber);
  return canonicalNumber || row.id;
};

export async function summarizePosReceiptsForPeriod(period: { start: Date; end: Date }) {
  const receipts = (await prisma.receipt.findMany({
    where: {
      generatedAt: {
        gte: period.start,
        lte: period.end,
      },
    },
    include: {
      order: {
        select: {
          orderNumber: true,
          totalAmount: true,
          items: {
            select: {
              quantity: true,
            },
          },
        },
      },
    },
  })) as PosReceiptRow[];

  const seen = new Map<string, string>();
  const periodLabel = `${period.start.toISOString()}_${period.end.toISOString()}`;
  let totalSales = 0;
  let totalProfit = 0;
  let totalItems = 0;

  for (const receipt of receipts) {
    const key = canonicalKeyForRow(receipt);
    if (seen.has(key)) {
      console.warn(
        `[pos-summary][period=${periodLabel}] duplicate POS receipt detected for key=${key} (existing=${seen.get(
          key,
        )}, new=${receipt.id}); counting only the first entry.`,
      );
      continue;
    }
    seen.set(key, receipt.id);

    const sales = extractSales(receipt);
    totalSales += sales;
    totalProfit += extractProfit(receipt, sales);
    totalItems += countItems(receipt);
  }

  return {
    totalSales,
    totalProfit,
    totalItems,
    totalReceipts: seen.size,
    receiptKeys: Array.from(seen.keys()),
  };
}
