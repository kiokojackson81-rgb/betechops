import { prisma } from "@/lib/prisma";
import { canonicalReceiptNumber } from "@/lib/receiptGuard";
import { Prisma } from "@prisma/client";

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
  totalProfitPriced: number;
  totalProfitInclusive: number;
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
  search?: string;
  docType?: string;
  scope?: "mine" | "global";
  currentUserId?: string | null;
  customerType?: string;
  podStatus?: string;
};

const buildPosSearchOr = (q: string): Prisma.ReceiptWhereInput[] => [
  { order: { customerName: { contains: q, mode: "insensitive" } } },
  { order: { customerPhone: { contains: q, mode: "insensitive" } } },
  { order: { customerEmail: { contains: q, mode: "insensitive" } } },
  { order: { orderNumber: { contains: q, mode: "insensitive" } } },
  { order: { attendant: { name: { contains: q, mode: "insensitive" } } } },
  { issuedBy: { name: { contains: q, mode: "insensitive" } } },
];

const buildMarketingSupportSearchOr = (q: string): Prisma.MarketingReceiptWhereInput["OR"] => [
  { receiptNumber: { contains: q, mode: "insensitive" } },
  { dailyEntry: { submittedByName: { contains: q, mode: "insensitive" } } },
  { items: { some: { productName: { contains: q, mode: "insensitive" } } } },
];

const buildSupportSearchOr = (q: string): Prisma.SupportReceiptWhereInput["OR"] => [
  { receiptNumber: { contains: q, mode: "insensitive" } },
  {
    dailyEntry: {
      submittedBy: { name: { contains: q, mode: "insensitive" } },
    },
  },
  { items: { some: { productName: { contains: q, mode: "insensitive" } } } },
];

const buildPosScopeCondition = (userId?: string | null): Prisma.ReceiptWhereInput[] => {
  if (!userId) return [];
  return [
    { issuedById: userId },
    { order: { attendantId: userId } },
    { data: { path: ["attendantId"], equals: userId } },
  ];
};

export async function computeAdminReceiptSummary({
  start,
  end,
  attendantId,
  paymentMethod,
  search,
  docType,
  scope = "global",
  currentUserId,
  customerType,
  podStatus,
}: SummaryOptions) {
  const normalizedDocType = docType ? docType.toUpperCase() : undefined;
  const isMarketingDocType = normalizedDocType === "MARKETING";
  const isSupportDocType = normalizedDocType === "SUPPORT";
  const includePosReceipts = !normalizedDocType || (!isMarketingDocType && !isSupportDocType);
  const includeMarketingReceipts = !normalizedDocType || isMarketingDocType;
  const includeSupportReceipts = !normalizedDocType || isSupportDocType;
  const normalizedCustomerType = customerType ? customerType.toLowerCase().trim() : undefined;
  const normalizedPodStatus = (() => {
    const value = podStatus ? podStatus.toLowerCase().trim() : undefined;
    if (!value) return undefined;
    if (value === "failed") return "delivery_failed";
    if (value === "delivery_failed" || value === "pending" || value === "delivered") return value;
    return undefined;
  })();

  const posWhere: any = {
    generatedAt: { gte: start, lte: end },
  };
  if (normalizedDocType && includePosReceipts) {
    posWhere.docType = normalizedDocType;
  }
  if (search) {
    posWhere.OR = [...(posWhere.OR ?? []), ...buildPosSearchOr(search)];
  }
  if (scope === "mine") {
    const ownerOr = buildPosScopeCondition(currentUserId);
    if (ownerOr.length) {
      posWhere.AND = [...(posWhere.AND ?? []), { OR: ownerOr }];
    }
  } else if (attendantId) {
    const ownerOr = buildPosScopeCondition(attendantId);
    if (ownerOr.length) {
      posWhere.AND = [...(posWhere.AND ?? []), { OR: ownerOr }];
    }
  }
  if (paymentMethod) {
    posWhere.data ??= {};
    posWhere.data.path = ["paymentMethod"];
    posWhere.data.equals = paymentMethod;
  }

  // Exclude POS receipts that are POD-pending by default so admin summaries
  // don't prematurely count POS POD receipts. Keep receipts with no
  // podDelivery or where podDelivery.status !== 'pending'.
  const podAndConditions: Prisma.ReceiptWhereInput[] = posWhere.AND ?? [];
  if (normalizedCustomerType === "pod") {
    if (normalizedPodStatus) {
      podAndConditions.push({ data: { path: ['podDelivery', 'status'], equals: normalizedPodStatus } });
    }
    podAndConditions.push({ data: { path: ['podDelivery'], not: { equals: Prisma.JsonNull } } });
  } else {
    podAndConditions.push({
      OR: [
        { data: { path: ['podDelivery'], equals: Prisma.JsonNull } },
        { data: { path: ['podDelivery', 'status'], not: { equals: 'pending' } } },
      ],
    });
  }
  posWhere.AND = podAndConditions;

  const dailyEntryWhere: any = {
    date: { gte: start, lte: end },
  };
  if (scope === "mine") {
    dailyEntryWhere.submittedById = currentUserId ?? attendantId ?? undefined;
  } else if (attendantId) {
    dailyEntryWhere.submittedById = attendantId;
  }
  if (paymentMethod) {
    dailyEntryWhere.paymentMethod = paymentMethod;
  }

  const [marketingReceipts, supportReceipts, posReceipts] = await Promise.all([
    includeMarketingReceipts
      ? prisma.marketingReceipt.findMany({
          where: {
            dailyEntry: dailyEntryWhere,
            ...(search ? { OR: buildMarketingSupportSearchOr(search) } : {}),
          },
          include: { items: true },
        })
      : [],
    includeSupportReceipts
      ? prisma.supportReceipt.findMany({
          where: {
            dailyEntry: dailyEntryWhere,
            ...(search ? { OR: buildSupportSearchOr(search) } : {}),
          },
          include: { items: true },
        })
      : [],
    includePosReceipts
      ? prisma.receipt.findMany({
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
        })
      : [],
  ]);

  const marketingRecords: ReceiptSummaryRecord[] = marketingReceipts.map((receipt) => ({
    source: "marketing" as const,
    key: buildReceiptKey("marketing", receipt.receiptNumber ?? null, receipt.id),
    paymentMethod: normalizePaymentMethod(receipt.paymentMethod) ?? null,
    sellingTotal: Number(receipt.sellingTotal ?? 0),
    items: receipt.items ?? [],
    buyingTotal: Number(receipt.buyingTotal ?? 0),
  }));

  const supportRecords: ReceiptSummaryRecord[] = supportReceipts.map((receipt) => ({
    source: "support" as const,
    key: buildReceiptKey("support", receipt.receiptNumber ?? null, receipt.id),
    paymentMethod: normalizePaymentMethod(receipt.paymentMethod) ?? null,
    sellingTotal: Number(receipt.sellingTotal ?? 0),
    items: receipt.items ?? [],
    buyingTotal: Number(receipt.buyingTotal ?? 0),
  }));

  const posRecords: ReceiptSummaryRecord[] = posReceipts.map((receipt) => {
    const orderRef = receipt.order?.orderNumber ?? null;
    return {
      source: "pos" as const,
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
  const recordHasCostData = (record: ReceiptSummaryRecord) => {
    if (Number(record.buyingTotal ?? 0) > 0) return true;
    const items = Array.isArray(record.items) ? record.items : [];
    return items.some((item) => Number(item?.buyingPrice ?? 0) > 0);
  };

  for (const record of combinedRecords) {
    const existing = dedupedMap.get(record.key);
    const candidateHasCost = recordHasCostData(record);
    const existingHasCost = existing ? recordHasCostData(existing) : false;
    const shouldReplace = () => {
      if (!existing) return true;
      // If a marketing row exists but lacks cost information and the
      // support row for the same receipt has cost, prefer the support row
      // to avoid losing buying-price-derived profit information.
      if (existing.source === "marketing" && record.source === "support" && !existingHasCost && candidateHasCost) {
        return true;
      }
      if (candidateHasCost !== existingHasCost) return candidateHasCost;
      return sourcePriority[record.source] > sourcePriority[existing.source];
    };

    if (shouldReplace()) {
      const merged = { ...record };
      if (existing?.paymentMethod) {
        merged.paymentMethod = existing.paymentMethod;
      }
      dedupedMap.set(record.key, merged);
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
    totalProfit: totalProfitInclusive,
    totalProfitPriced,
    totalProfitInclusive,
    receiptsCount,
    itemsCount,
    hasCompleteCosts,
    awaitingPricingCount,
    paymentTotals,
  };
}
