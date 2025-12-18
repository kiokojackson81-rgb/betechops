import { prisma } from "@/lib/prisma";

type PaymentBucket = { totalSales: number; count: number };

type ReceiptSummaryRecord = {
  paymentMethod: string | null;
  sellingTotal: number;
  items?: Array<{ quantity?: number; buyingPrice?: number } | null>;
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

  const normalizedPosReceipts: ReceiptSummaryRecord[] = posReceipts.map((receipt) => ({
    paymentMethod: normalizePaymentMethod((receipt.data as any)?.paymentMethod) ?? null,
    sellingTotal: Number((receipt.totals as any)?.total ?? receipt.order?.totalAmount ?? 0),
    items: (receipt.order?.items ?? []).map((item) => ({ quantity: item.quantity })),
  }));

  const combinedSummaryReceipts: ReceiptSummaryRecord[] = [
    ...marketingReceipts.map((receipt) => ({
      paymentMethod: normalizePaymentMethod(receipt.paymentMethod) ?? null,
      sellingTotal: Number(receipt.sellingTotal ?? 0),
      items: (receipt.items ?? []).map((it: any) => ({
        quantity: (it as any)?.quantity ?? 1,
        buyingPrice: Number((it as any)?.buyingPrice ?? 0),
      })),
    })),
    ...supportReceipts.map((receipt) => ({
      paymentMethod: normalizePaymentMethod(receipt.paymentMethod) ?? null,
      sellingTotal: Number(receipt.sellingTotal ?? 0),
      items: (receipt.items ?? []).map((it: any) => ({
        quantity: (it as any)?.quantity ?? 1,
        buyingPrice: Number((it as any)?.buyingPrice ?? 0),
      })),
    })),
    ...normalizedPosReceipts,
  ];

  const paymentTotals = combinedSummaryReceipts.reduce(
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

  const filterByMethod = (records: ReceiptSummaryRecord[]) =>
    paymentMethod ? records.filter((receipt) => normalizePaymentMethod(receipt.paymentMethod) === paymentMethod) : records;

  const marketingSupportRecords: ReceiptSummaryRecord[] = [
    ...marketingReceipts.map((receipt) => ({
      paymentMethod: normalizePaymentMethod(receipt.paymentMethod) ?? null,
      sellingTotal: Number(receipt.sellingTotal ?? 0),
      items: (receipt.items ?? []).map((it: any) => ({
        quantity: (it as any)?.quantity ?? 1,
        buyingPrice: Number((it as any)?.buyingPrice ?? 0),
      })),
    })),
    ...supportReceipts.map((receipt) => ({
      paymentMethod: normalizePaymentMethod(receipt.paymentMethod) ?? null,
      sellingTotal: Number(receipt.sellingTotal ?? 0),
      items: (receipt.items ?? []).map((it: any) => ({
        quantity: (it as any)?.quantity ?? 1,
        buyingPrice: Number((it as any)?.buyingPrice ?? 0),
      })),
    })),
  ];

  const filteredMarketingSupport = filterByMethod(marketingSupportRecords);
  const filteredPos = filterByMethod(normalizedPosReceipts);

  const totalSales =
    filteredMarketingSupport.reduce((sum, receipt) => sum + Number(receipt.sellingTotal ?? 0), 0) +
    filteredPos.reduce((sum, receipt) => sum + Number(receipt.sellingTotal ?? 0), 0);

  const marketingItemsCount = filteredMarketingSupport.reduce(
    (sum, receipt) => sum + (Array.isArray(receipt.items) ? sumItemQuantities(receipt.items) : 0),
    0,
  );
  const posItemsCount = filteredPos.reduce(
    (sum, receipt) => sum + (Array.isArray(receipt.items) ? sumItemQuantities(receipt.items) : 0),
    0,
  );
  const itemsCount = marketingItemsCount + posItemsCount;

  const receiptsCount = filteredMarketingSupport.length + filteredPos.length;

  let totalCost = 0;
  let totalProfit = 0;
  let awaitingPricingCount = 0;
  let hasIncompleteCosts = false;
  for (const receipt of filteredMarketingSupport) {
    const items = Array.isArray(receipt.items) ? receipt.items : [];
    const aggregateCost = Number((receipt as any).buyingTotal ?? 0);
    const allItemsPriced = items.length > 0 && items.every((it) => Number((it as any)?.buyingPrice ?? 0) > 0);
    const hasAggregateCost = aggregateCost > 0;
    const sell = Number(receipt.sellingTotal ?? 0);

    if (hasAggregateCost || allItemsPriced) {
      const buyingSum = hasAggregateCost
        ? aggregateCost
        : items.reduce((sum, it) => sum + Number((it as any)?.buyingPrice ?? 0), 0);
      totalCost += buyingSum;
      totalProfit += sell - buyingSum;
    } else {
      awaitingPricingCount += 1;
      hasIncompleteCosts = true;
    }
  }

  const hasCompleteCosts = filteredMarketingSupport.length === 0 ? true : !hasIncompleteCosts;

  return {
    totalSales,
    totalCost,
    totalProfit,
    receiptsCount,
    itemsCount,
    hasCompleteCosts,
    awaitingPricingCount,
    paymentTotals,
  };
}
