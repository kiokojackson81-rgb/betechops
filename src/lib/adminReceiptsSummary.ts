import { prisma } from "@/lib/prisma";
import { canonicalReceiptNumber } from "@/lib/receiptGuard";

type PaymentBucket = { totalSales: number; count: number };

type Source = "pos" | "marketing" | "support";

type ReceiptSummaryRecord = {
  source: Source;
  key: string;
  paymentMethod: string | null;
  sellingTotal: number;
  items: Array<{ quantity?: number; buyingPrice?: number | null } | null>;
  buyingTotal?: number;
};

export type PaymentTotals = {
  mpesa: PaymentBucket;
  cash: PaymentBucket;
};

export type AdminReceiptSummary = {
  totalSales: number;
  totalCost: number;
  totalProfit: number;
  receiptsCount: number;
  itemsCount: number;
  hasCompleteCosts: boolean;
  awaitingPricingCount: number;
  paymentTotals: PaymentTotals;
};

export const normalizePaymentMethod = (value: string | null | undefined): "MPESA" | "CASH" | null => {
  if (!value) return null;
  const normalized = value.toUpperCase().trim();
  if (normalized === "CASH" || normalized === "MPESA") return normalized;
  return null;
};

const sumItemQuantities = (items: Array<{ quantity?: number } | null>): number =>
  items.reduce((sum, item) => sum + (Number(item?.quantity ?? 1) || 0), 0);

const buildPosReceiptFilter = (attendantId?: string) => {
  const base: any = {};
  if (attendantId) {
    base.OR = [
      { order: { attendantId } },
      { issuedById: attendantId },
      { data: { path: ["attendantId"], equals: attendantId } },
    ];
  }
  return base;
};

const buildReceiptKey = (source: Source, receiptNumber: string | null | undefined, fallbackId: string) => {
  const normalized = receiptNumber ? canonicalReceiptNumber(receiptNumber) : null;
  if (normalized) return `num:${normalized}`;
  return `${source}:${fallbackId}`;
};

type SummaryOptions = {
  start: Date;
  end: Date;
  attendantId?: string;
  paymentMethod?: "MPESA" | "CASH" | null;
};

export async function computeAdminReceiptSummary({ start, end, attendantId, paymentMethod }: SummaryOptions) {
  const dailyEntryFilter: any = {
    date: { gte: start, lte: end },
  };
  if (attendantId) {
    dailyEntryFilter.submittedById = attendantId;
  }

  const posWhere: any = {
    generatedAt: { gte: start, lte: end },
    ...buildPosReceiptFilter(attendantId),
  };

  const [marketingReceipts, supportReceipts, posReceipts] = await Promise.all([
    prisma.marketingReceipt.findMany({ where: { dailyEntry: dailyEntryFilter }, include: { items: true } }),
    prisma.supportReceipt.findMany({ where: { dailyEntry: dailyEntryFilter }, include: { items: true } }),
    prisma.receipt.findMany({
      where: posWhere,
      include: {
        order: {
          include: {
            items: {
              select: { quantity: true },
            },
          },
        },
      },
    }),
  ]);

  const marketingRecords: ReceiptSummaryRecord[] = marketingReceipts.map((receipt) => ({
    source: "marketing",
    key: buildReceiptKey("marketing", receipt.receiptNumber ?? null, receipt.id),
    paymentMethod: normalizePaymentMethod(receipt.paymentMethod) ?? null,
    sellingTotal: Number(receipt.sellingTotal ?? 0),
    items: receipt.items ?? [],
    buyingTotal: Number(receipt.buyingTotal ?? 0),
  }));

  const supportRecords: ReceiptSummaryRecord[] = supportReceipts.map((receipt) => ({
    source: "support",
    key: buildReceiptKey("support", receipt.receiptNumber ?? null, receipt.id),
    paymentMethod: normalizePaymentMethod(receipt.paymentMethod) ?? null,
    sellingTotal: Number(receipt.sellingTotal ?? 0),
    items: receipt.items ?? [],
    buyingTotal: Number(receipt.buyingTotal ?? 0),
  }));

  const posRecords: ReceiptSummaryRecord[] = posReceipts.map((receipt) => {
    const orderRef = receipt.order?.orderNumber ?? null;
    return {
      source: "pos",
      key: buildReceiptKey("pos", orderRef, receipt.id),
      paymentMethod: normalizePaymentMethod((receipt.data as any)?.paymentMethod) ?? null,
      sellingTotal: Number((receipt.totals as any)?.total ?? receipt.order?.totalAmount ?? 0),
      items: (receipt.order?.items ?? []).map((item) => ({ quantity: item.quantity })),
    };
  });

  const combinedRecords = [...marketingRecords, ...supportRecords, ...posRecords];

  const sourcePriority: Record<Source, number> = {
    pos: 3,
    marketing: 2,
    support: 1,
  };

  const dedupedMap = new Map<string, ReceiptSummaryRecord>();
  for (const record of combinedRecords) {
    const existing = dedupedMap.get(record.key);
    if (!existing || sourcePriority[record.source] > sourcePriority[existing.source]) {
      dedupedMap.set(record.key, record);
    }
  }

  const dedupedRecords = Array.from(dedupedMap.values());

  const paymentTotals = dedupedRecords.reduce(
    (acc, { paymentMethod: method, sellingTotal }) => {
      const normalized = normalizePaymentMethod(method);
      if (!normalized) return acc;
      const bucket = normalized === "CASH" ? acc.cash : acc.mpesa;
      bucket.totalSales += Number(sellingTotal);
      bucket.count += 1;
      return acc;
    },
    {
      mpesa: { totalSales: 0, count: 0 },
      cash: { totalSales: 0, count: 0 },
    } as PaymentTotals,
  );

  const filteredRecords = paymentMethod
    ? dedupedRecords.filter((receipt) => normalizePaymentMethod(receipt.paymentMethod) === paymentMethod)
    : dedupedRecords;

  const filteredMarketingSupport = filteredRecords.filter((record) => record.source !== "pos");
  const filteredPos = filteredRecords.filter((record) => record.source === "pos");

  const totalSales =
    filteredMarketingSupport.reduce((sum, receipt) => sum + Number(receipt.sellingTotal ?? 0), 0) +
    filteredPos.reduce((sum, receipt) => sum + Number(receipt.sellingTotal ?? 0), 0);

  const marketingItemsCount = filteredMarketingSupport.reduce(
    (sum, receipt) => sum + sumItemQuantities(receipt.items),
    0,
  );
  const posItemsCount = filteredPos.reduce(
    (sum, receipt) => sum + sumItemQuantities(receipt.items),
    0,
  );
  const itemsCount = marketingItemsCount + posItemsCount;

  const receiptsCount = filteredRecords.length;

  let totalCost = 0;
  // totalProfitPriced: sum of profits for receipts that have cost data
  // totalProfitInclusive: sum of per-receipt profits where missing-cost receipts contribute 0
  let totalProfitPriced = 0;
  let totalProfitInclusive = 0;
  let awaitingPricingCount = 0;
  let hasIncompleteCosts = false;
  for (const receipt of filteredMarketingSupport) {
    const items = Array.isArray(receipt.items) ? receipt.items : [];
    const aggregateCost = Number(receipt.buyingTotal ?? 0);
    const allItemsPriced = items.length > 0 && items.every((it) => Number((it as any)?.buyingPrice ?? 0) > 0);
    const hasAggregateCost = aggregateCost > 0;
    const sell = Number(receipt.sellingTotal ?? 0);

    let receiptProfit = 0;
    if (hasAggregateCost || allItemsPriced) {
      const buyingSum = hasAggregateCost
        ? aggregateCost
        : items.reduce((sum, it) => sum + Number((it as any)?.buyingPrice ?? 0), 0);
      totalCost += buyingSum;
      receiptProfit = sell - buyingSum;
      totalProfitPriced += receiptProfit;
    } else {
      awaitingPricingCount += 1;
      hasIncompleteCosts = true;
      receiptProfit = 0;
    }

    totalProfitInclusive += receiptProfit;
  }

  const hasCompleteCosts = filteredMarketingSupport.length === 0 ? true : !hasIncompleteCosts;

  return {
    totalSales,
    totalCost,
    // backward-compatible: keep `totalProfit` as inclusive sum
    totalProfit: totalProfitInclusive,
    // explicit fields for clarity
    totalProfitPriced,
    totalProfitInclusive,
    receiptsCount,
    itemsCount,
    hasCompleteCosts,
    awaitingPricingCount,
    paymentTotals,
  };
}
