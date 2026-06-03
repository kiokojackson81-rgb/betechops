import { prisma } from "@/lib/prisma";
import { canonicalReceiptNumber } from "@/lib/receiptGuard";
import { buildReceiptKey } from "@/lib/receiptKey";
import { Prisma } from "@prisma/client";
import { adjustProfitForPodDeliveryFee, getPodDeliveryFee } from "@/lib/podDeliveryFee";

type PaymentBucket = { totalSales: number; count: number };

export type Source = "pos" | "marketing" | "support";

type ReceiptSummaryRecord = {
  source: Source;
  id?: string;
  key: string;
  receiptNumber?: string | null;
  paymentMethod: string | null;
  sellingTotal: number;
  items: Array<{ quantity?: number; buyingPrice?: number | null } | null>;
  buyingTotal?: number;
  supportBuyingTotal?: number;
  profit?: number;
  deliveryFee?: number;
};

export type ProfitReceiptContributor = {
  source: Source;
  id?: string;
  key: string;
  receiptNumber?: string | null;
  sellingTotal: number;
  buyingTotal: number;
  profit: number;
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
  posReceiptsCount: number;
  posTotalSales: number;
  itemsCount: number;
  hasCompleteCosts: boolean;
  awaitingPricingCount: number;
  paymentTotals: PaymentTotals;
  profitContributors?: ProfitReceiptContributor[];
  debug?: {
    start: string;
    end: string;
    includeLedger: boolean;
    salesOnly: boolean;
    rawPosReceipts: number;
    rawPodReceipts: number;
    rawNonPodReceipts: number;
    includedReceipts: number;
    excludedUnpaidPos: number;
    excludedUnpaidPod: number;
    excludedTotalSales: number;
  };
};

export const normalizePaymentMethod = (value: string | null | undefined): "MPESA" | "CASH" | null => {
  if (!value) return null;
  const normalized = value.toUpperCase().trim();
  if (normalized === "CASH" || normalized === "MPESA") return normalized;
  return null;
};

const sumItemQuantities = (items: Array<{ quantity?: number } | null>): number =>
  items.reduce((sum, item) => sum + (Number(item?.quantity ?? 1) || 0), 0);

type SummaryOptions = {
  start: Date;
  end: Date;
  attendantId?: string;
  paymentMethod?: "MPESA" | "CASH" | null;
  search?: string;
  docType?: string;
  includeLedger?: boolean;
  salesOnly?: boolean;
  scope?: "mine" | "global";
  currentUserId?: string | null;
  customerType?: string;
  podStatus?: string;
  debug?: boolean;
  onlyPos?: boolean;
};

type PosOnlySummaryResult = AdminReceiptSummary & {
  profitReceiptIds: string[];
  profitContributors: ProfitReceiptContributor[];
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

const jsonNullFilter: Prisma.JsonNullValueFilter = Prisma.JsonNull;

const buildPosStaffOwnerCondition = (userId?: string | null): Prisma.ReceiptWhereInput[] => {
  if (!userId) return [];
  return [
    { order: { attendantId: userId } },
    { data: { path: ["attendantId"], equals: userId } },
  ];
};

const extractCanonicalFromReceiptKey = (value?: string | null): string | null => {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const tail = raw.includes(":") ? raw.split(":").pop() : raw;
  return canonicalReceiptNumber(tail);
};

const collectReceiptVariants = (...values: Array<string | null | undefined>) =>
  Array.from(
    new Set(
      values.flatMap((value) => {
        const raw = typeof value === "string" ? value.trim() : "";
        const canonical = canonicalReceiptNumber(raw);
        return [raw, canonical].filter((entry): entry is string => Boolean(entry));
      }),
    ),
  );

const extractReceiptKeyTailVariants = (value?: string | null) => {
  if (!value) return [] as string[];
  const raw = String(value).trim();
  if (!raw) return [] as string[];
  const tail = raw.includes(":") ? raw.split(":").pop() : raw;
  return collectReceiptVariants(raw, tail ?? undefined);
};

const isDateInRange = (value: unknown, start: Date, end: Date): boolean => {
  if (!(value instanceof Date)) return false;
  const time = value.getTime();
  return Number.isFinite(time) && time >= start.getTime() && time <= end.getTime();
};

async function computePosOnlyReceiptSummary({
  start,
  end,
  attendantId,
  paymentMethod,
  search,
  docType,
  includeLedger = false,
  salesOnly = true,
  scope = "global",
  currentUserId,
  customerType,
  podStatus,
}: SummaryOptions): Promise<PosOnlySummaryResult> {
  const normalizedDocType = docType ? docType.toUpperCase() : undefined;
  const normalizedCustomerType = customerType ? customerType.toLowerCase().trim() : undefined;
  const normalizedPodStatus = (() => {
    const value = podStatus ? podStatus.toLowerCase().trim() : undefined;
    if (!value) return undefined;
    if (value === "failed") return "delivery_failed";
    if (value === "delivery_failed" || value === "pending" || value === "delivered") return value;
    return undefined;
  })();

  const basePosWhere: Prisma.ReceiptWhereInput = {
    AND: [
      { generatedAt: { gte: start, lte: end } },
    ],
  };

  if (normalizedDocType) {
    (basePosWhere.AND as Prisma.ReceiptWhereInput[]).push({ docType: normalizedDocType as any });
  }
  if (paymentMethod) {
    (basePosWhere.AND as Prisma.ReceiptWhereInput[]).push({ data: { path: ["paymentMethod"], equals: paymentMethod } });
  }
  if (search) {
    (basePosWhere.AND as Prisma.ReceiptWhereInput[]).push({ OR: buildPosSearchOr(search) });
  }
  const ownerId = attendantId ?? (scope === "mine" ? currentUserId : null);
  const ownerOr = buildPosStaffOwnerCondition(ownerId);
  if (ownerOr.length) {
    (basePosWhere.AND as Prisma.ReceiptWhereInput[]).push({ OR: ownerOr });
  }

  const supportDailyEntryWhere: Prisma.SupportDailyEntryWhereInput = {};
  if (ownerId) {
    supportDailyEntryWhere.submittedById = ownerId;
  }

  const [basePosReceipts, latePricedSupportReceipts] = await Promise.all([
    prisma.receipt.findMany({
      where: basePosWhere,
      include: {
        order: {
          include: {
            items: {
              include: {
                orderCosts: true,
                profitSnapshots: {
                  orderBy: { computedAt: "desc" },
                  take: 1,
                  select: { unitCost: true },
                },
                product: { select: { lastBuyingPrice: true } },
              },
            },
          },
        },
      },
    }),
    prisma.supportReceipt.findMany({
      where: {
        ...(Object.keys(supportDailyEntryWhere).length ? { dailyEntry: supportDailyEntryWhere } : {}),
        items: { some: { pricedAt: { gte: start, lte: end } } },
        ...(search ? { OR: buildSupportSearchOr(search) } : {}),
      },
      select: {
        receiptNumber: true,
        receiptKey: true,
        buyingTotal: true,
        items: {
          select: {
            buyingPrice: true,
            pricedAt: true,
          },
        },
      },
    }),
  ]);

  const lateReceiptNumbers = Array.from(
    new Set(
      latePricedSupportReceipts.flatMap((row) => {
        return [
          ...collectReceiptVariants(row.receiptNumber ?? undefined),
          ...extractReceiptKeyTailVariants(row.receiptKey),
        ];
      }),
    ),
  );

  const extraPosReceipts =
    lateReceiptNumbers.length > 0
      ? await prisma.receipt.findMany({
          where: {
            AND: [
              ...(basePosWhere.AND as Prisma.ReceiptWhereInput[]).filter((clause) => !("generatedAt" in clause)),
              {
                OR: [
                  { order: { orderNumber: { in: lateReceiptNumbers } } },
                  { receiptNumber: { in: lateReceiptNumbers } },
                ],
              },
            ],
          },
          include: {
            order: {
              include: {
                items: {
                  include: {
                    orderCosts: true,
                    profitSnapshots: {
                      orderBy: { computedAt: "desc" },
                      take: 1,
                      select: { unitCost: true },
                    },
                    product: { select: { lastBuyingPrice: true } },
                  },
                },
              },
            },
          },
        })
      : [];

  const receiptsById = new Map<string, any>();
  for (const receipt of [...basePosReceipts, ...extraPosReceipts]) {
    receiptsById.set(receipt.id, receipt);
  }

  const mergedReceipts = Array.from(receiptsById.values());

  const posReceiptsFinal = (() => {
    const isPodReceipt = (r: any) => Boolean(r?.data && typeof r.data === "object" && (r.data as any).podDelivery);
    const podStatusOf = (r: any) => ((r?.data as any)?.podDelivery?.status ?? "").toString().toLowerCase();

    if (normalizedCustomerType === "pod") {
      const onlyPods = mergedReceipts.filter(isPodReceipt);
      if (normalizedPodStatus) {
        return onlyPods.filter((r) => podStatusOf(r) === normalizedPodStatus);
      }
      return onlyPods;
    }

    return mergedReceipts;
  })();

  const productCostMap = new Map<string, number>();
  try {
    const productIds = new Set<string>();
    for (const receipt of posReceiptsFinal) {
      const items = (receipt?.order?.items ?? []) as any[];
      for (const item of items) {
        if (item?.productId) productIds.add(String(item.productId));
      }
    }
    const ids = Array.from(productIds);
    if (ids.length > 0) {
      const costs = await prisma.productCost.findMany({
        where: { productId: { in: ids } },
        orderBy: [{ productId: "asc" }, { createdAt: "desc" }],
        distinct: ["productId"],
        select: { productId: true, price: true },
      });
      for (const row of costs) {
        const value = Number(row.price ?? 0);
        if (row.productId && Number.isFinite(value) && value > 0) {
          productCostMap.set(String(row.productId), value);
        }
      }
    }
  } catch (err) {
    console.warn("[adminReceiptsSummary] failed to load ProductCost fallbacks", err);
  }

  const candidateReceiptNumbers = Array.from(
    new Set(
      posReceiptsFinal.flatMap((receipt: any) => {
        return collectReceiptVariants(receipt.order?.orderNumber, receipt.receiptNumber);
      }),
    ),
  );

  const supportPendingByReceipt = new Map<string, { hasPendingItems: boolean }>();
  const supportBuyingByReceipt = new Map<string, { buyingTotal: number; recognizedAt: Date | null }>();
  const supportProfitByReceipt = new Map<string, { buyingTotal: number; profit: number }>();
  if (candidateReceiptNumbers.length > 0) {
    const [supportRows, supportSales] = await Promise.all([
      prisma.supportReceipt.findMany({
        where: {
          OR: [
            { receiptNumber: { in: candidateReceiptNumbers } },
            { receiptKey: { in: candidateReceiptNumbers } },
          ],
        },
        select: {
          receiptNumber: true,
          receiptKey: true,
          buyingTotal: true,
          items: {
            select: {
              buyingPrice: true,
              pricedAt: true,
            },
          },
        },
      }),
      prisma.supportSale.findMany({
        where: {
          ...(Object.keys(supportDailyEntryWhere).length ? { entry: supportDailyEntryWhere } : {}),
          createdAt: { gte: start, lte: end },
          receiptNumber: { in: candidateReceiptNumbers },
        },
        select: {
          receiptNumber: true,
          sellingPrice: true,
          buyingPrice: true,
        },
      }),
    ]);

    const supportRowsWithLatePricing = [...supportRows, ...latePricedSupportReceipts];
    for (const row of supportRowsWithLatePricing) {
      const items = Array.isArray(row.items) ? row.items : [];
      const itemsBuyingTotal = items.reduce((sum, item) => sum + Number(item.buyingPrice ?? 0), 0);
      const aggregateBuyingTotal = Number(row.buyingTotal ?? 0);
      const buyingTotal = aggregateBuyingTotal > 0 ? aggregateBuyingTotal : itemsBuyingTotal;
      const hasPendingItems = items.length > 0 && items.some((item) => Number(item.buyingPrice ?? 0) <= 0);
      const latestPricedAt = items.reduce<Date | null>((latest, item) => {
        if (!(item.pricedAt instanceof Date)) return latest;
        if (!latest || item.pricedAt.getTime() > latest.getTime()) return item.pricedAt;
        return latest;
      }, null);

      for (const rawKey of [...collectReceiptVariants(row.receiptNumber ?? undefined), ...extractReceiptKeyTailVariants(row.receiptKey)]) {
        const canonical = canonicalReceiptNumber(rawKey);
        if (!canonical) continue;
        const existing = supportPendingByReceipt.get(canonical);
        supportPendingByReceipt.set(canonical, {
          hasPendingItems: Boolean(existing?.hasPendingItems || hasPendingItems),
        });
        const existingBuying = supportBuyingByReceipt.get(canonical);
        const shouldReplaceBuying =
          !existingBuying ||
          buyingTotal > existingBuying.buyingTotal ||
          ((latestPricedAt?.getTime() ?? 0) > (existingBuying.recognizedAt?.getTime() ?? 0));
        if (buyingTotal > 0 && shouldReplaceBuying) {
          supportBuyingByReceipt.set(canonical, {
            buyingTotal,
            recognizedAt: latestPricedAt,
          });
        }
      }
    }

    for (const sale of supportSales) {
      for (const rawKey of collectReceiptVariants(sale.receiptNumber ?? undefined)) {
        const canonical = canonicalReceiptNumber(rawKey);
        if (!canonical) continue;
        const existing = supportProfitByReceipt.get(canonical);
        if (!existing) {
          supportProfitByReceipt.set(canonical, {
            buyingTotal: Number(sale.buyingPrice ?? 0),
            profit: Number(sale.sellingPrice ?? 0) - Number(sale.buyingPrice ?? 0),
          });
          continue;
        }
        supportProfitByReceipt.set(canonical, {
          buyingTotal: existing.buyingTotal + Number(sale.buyingPrice ?? 0),
          profit: existing.profit + (Number(sale.sellingPrice ?? 0) - Number(sale.buyingPrice ?? 0)),
        });
      }
    }
  }

  const paymentTotals = {
    mpesa: { totalSales: 0, count: 0 },
    cash: { totalSales: 0, count: 0 },
  } as PaymentTotals;

  let totalSales = 0;
  let totalCost = 0;
  let totalProfitPriced = 0;
  let totalProfitInclusive = 0;
  let receiptsCount = 0;
  let posReceiptsCount = 0;
  let posTotalSales = 0;
  let itemsCount = 0;
  let awaitingPricingCount = 0;
  let hasIncompleteCosts = false;
  const profitReceiptIds = new Set<string>();
  const profitContributors = new Map<string, ProfitReceiptContributor>();

  for (const receipt of posReceiptsFinal as any[]) {
    const salesDate = receipt.generatedAt instanceof Date ? receipt.generatedAt : receipt.createdAt;
    const salesIncluded = isDateInRange(salesDate, start, end);
    const salesValue = Number((receipt.totals as any)?.total ?? receipt.order?.totalAmount ?? 0);
    const payment = normalizePaymentMethod((receipt.data as any)?.paymentMethod) ?? null;
    const canonicalOrderNumber =
      canonicalReceiptNumber(receipt.order?.orderNumber) ??
      canonicalReceiptNumber(receipt.receiptNumber) ??
      null;
    const supportPending = canonicalOrderNumber ? supportPendingByReceipt.get(canonicalOrderNumber) : undefined;
    const supportBuying = canonicalOrderNumber ? supportBuyingByReceipt.get(canonicalOrderNumber) : undefined;
    const supportProfit = canonicalOrderNumber ? supportProfitByReceipt.get(canonicalOrderNumber) : undefined;

    const items = (receipt.order?.items ?? []).map((item: any) => {
      const costs = Array.isArray(item?.orderCosts) ? item.orderCosts : [];
      const buyingSum = costs.reduce((sum: number, cost: any) => sum + Number(cost.unitCost ?? 0), 0);
      const snapUnitCost = (() => {
        const snapshot = Array.isArray(item?.profitSnapshots) ? item.profitSnapshots[0] : null;
        const value = snapshot ? Number(snapshot.unitCost ?? 0) : 0;
        return Number.isFinite(value) ? value : 0;
      })();
      const productLastBuying = Number(item?.product?.lastBuyingPrice ?? 0) || 0;
      const productCost = productCostMap.get(String(item?.productId ?? "")) ?? 0;
      const fallbackUnitCost =
        snapUnitCost > 0 ? snapUnitCost : productLastBuying > 0 ? productLastBuying : productCost > 0 ? productCost : 0;
      return {
        quantity: item?.quantity,
        buyingPrice: buyingSum > 0 ? buyingSum : fallbackUnitCost,
      };
    });

    const supportBuyingTotal = Number(supportProfit?.buyingTotal ?? supportBuying?.buyingTotal ?? 0);
    const aggregateBuyingTotal = Number((receipt as any)?.buyingTotal ?? (receipt.data as any)?.buyingTotal ?? 0);
    const resolvedBuyingTotal = supportBuyingTotal > 0 ? supportBuyingTotal : aggregateBuyingTotal;
    const costFromItems = items.reduce(
      (sum: number, item: any) => sum + (Number(item?.buyingPrice ?? 0) * (Number(item?.quantity ?? 1) || 1)),
      0,
    );
    const allItemsPriced = items.length > 0 && items.every((item: any) => Number(item?.buyingPrice ?? 0) > 0);
    const hasPendingItems = supportPending?.hasPendingItems ?? !allItemsPriced;
    const hasAggregateCost = resolvedBuyingTotal > 0;
    const buyingTotalForContributor = hasAggregateCost ? resolvedBuyingTotal : costFromItems;
    const explicitProfitRaw = (receipt as any)?.profit ?? (receipt.data as any)?.profit;
    const explicitProfit =
      typeof explicitProfitRaw === "number" && Number.isFinite(explicitProfitRaw)
        ? Number(explicitProfitRaw)
        : typeof explicitProfitRaw === "string" && explicitProfitRaw.trim() !== "" && !Number.isNaN(Number(explicitProfitRaw))
          ? Number(explicitProfitRaw)
          : undefined;

    const supportRecognizedAt = supportBuying?.recognizedAt ?? null;
    const hasRecognizableProfit = Boolean(supportProfit) || hasAggregateCost || allItemsPriced || explicitProfit !== undefined;
    const profitRecognizedAt = supportProfit
      ? start
      : supportRecognizedAt instanceof Date
        ? supportRecognizedAt
        : hasRecognizableProfit && salesDate instanceof Date
          ? salesDate
          : null;

    let receiptProfit = 0;
    if (supportProfit) {
      receiptProfit = supportProfit.profit;
      totalCost += supportProfit.buyingTotal;
      totalProfitPriced += receiptProfit;
    } else if (hasAggregateCost || allItemsPriced) {
      const buyingSum = hasAggregateCost ? resolvedBuyingTotal : costFromItems;
      receiptProfit = salesValue - buyingSum;
      if (profitRecognizedAt && isDateInRange(profitRecognizedAt, start, end)) {
        totalCost += buyingSum;
        totalProfitPriced += receiptProfit;
      }
    } else if (explicitProfit !== undefined) {
      receiptProfit = explicitProfit;
      if (profitRecognizedAt && isDateInRange(profitRecognizedAt, start, end)) {
        totalProfitPriced += receiptProfit;
      }
    }

    if (salesIncluded && hasPendingItems) {
      awaitingPricingCount += 1;
      hasIncompleteCosts = true;
    }

    if (profitRecognizedAt && isDateInRange(profitRecognizedAt, start, end)) {
      totalProfitInclusive += receiptProfit;
      profitReceiptIds.add(receipt.id);
      profitContributors.set(`pos:${receipt.id}`, {
        source: "pos",
        id: receipt.id,
        key: buildReceiptKey(canonicalOrderNumber ?? receipt.receiptNumber ?? null, receipt.id),
        receiptNumber: receipt.receiptNumber ?? receipt.order?.orderNumber ?? null,
        sellingTotal: salesValue,
        buyingTotal: Number.isFinite(buyingTotalForContributor) ? buyingTotalForContributor : 0,
        profit: receiptProfit,
      });
    }

    if (!salesIncluded) {
      continue;
    }

    totalSales += salesValue;
    receiptsCount += 1;
    posReceiptsCount += 1;
    posTotalSales += salesValue;
    itemsCount += sumItemQuantities(items);

    const normalizedPayment = normalizePaymentMethod(payment);
    if (normalizedPayment === "CASH") {
      paymentTotals.cash.totalSales += salesValue;
      paymentTotals.cash.count += 1;
    } else if (normalizedPayment === "MPESA") {
      paymentTotals.mpesa.totalSales += salesValue;
      paymentTotals.mpesa.count += 1;
    }
  }

  return {
    totalSales,
    totalCost,
    totalProfit: totalProfitInclusive,
    totalProfitPriced,
    totalProfitInclusive,
    receiptsCount,
    posReceiptsCount,
    posTotalSales,
    itemsCount,
    hasCompleteCosts: receiptsCount === 0 ? true : !hasIncompleteCosts,
    awaitingPricingCount,
    paymentTotals,
    profitReceiptIds: Array.from(profitReceiptIds),
    profitContributors: Array.from(profitContributors.values()),
  };
}

export async function getPosProfitReceiptIdsForAdminFilters(options: SummaryOptions): Promise<string[]> {
  const result = await computePosOnlyReceiptSummary(options);
  return result.profitReceiptIds;
}

export async function getProfitReceiptContributorsForAdminFilters(
  options: SummaryOptions,
): Promise<ProfitReceiptContributor[]> {
  const [summaryResult, posOnlyResult] = await Promise.all([
    computeAdminReceiptSummary(options),
    computePosOnlyReceiptSummary(options),
  ]);

  const merged = new Map<string, ProfitReceiptContributor>();
  const register = (row: ProfitReceiptContributor) => {
    const key = `${row.source}:${row.id ?? row.key}`;
    if (!merged.has(key)) {
      merged.set(key, row);
      return;
    }
    const existing = merged.get(key)!;
    // Prefer the row that has a positive computed profit / buying total.
    const existingScore =
      (Number(existing.profit ?? 0) > 0 ? 2 : 0) + (Number(existing.buyingTotal ?? 0) > 0 ? 1 : 0);
    const nextScore =
      (Number(row.profit ?? 0) > 0 ? 2 : 0) + (Number(row.buyingTotal ?? 0) > 0 ? 1 : 0);
    if (nextScore > existingScore) {
      merged.set(key, row);
    }
  };

  for (const row of summaryResult.profitContributors ?? []) register(row);
  for (const row of posOnlyResult.profitContributors ?? []) register(row);

  return Array.from(merged.values());
}

export async function computeAdminReceiptSummary({
  start,
  end,
  attendantId,
  paymentMethod,
  search,
  docType,
  includeLedger = false,
  salesOnly = true,
  scope = "global",
  currentUserId,
  customerType,
  podStatus,
  debug = false,
  onlyPos = false,
}: SummaryOptions) {
  if (onlyPos) {
    const posOnly = await computePosOnlyReceiptSummary({
      start,
      end,
      attendantId,
      paymentMethod,
      search,
      docType,
      scope,
      currentUserId,
      customerType,
      podStatus,
      onlyPos,
    });
    return {
      totalSales: posOnly.totalSales,
      totalCost: posOnly.totalCost,
      totalProfit: posOnly.totalProfit,
      totalProfitPriced: posOnly.totalProfitPriced,
      totalProfitInclusive: posOnly.totalProfitInclusive,
      receiptsCount: posOnly.receiptsCount,
      posReceiptsCount: posOnly.posReceiptsCount,
      posTotalSales: posOnly.posTotalSales,
      itemsCount: posOnly.itemsCount,
      hasCompleteCosts: posOnly.hasCompleteCosts,
      awaitingPricingCount: posOnly.awaitingPricingCount,
      paymentTotals: posOnly.paymentTotals,
      profitContributors: posOnly.profitContributors,
    };
  }

  const normalizedDocType = docType ? docType.toUpperCase() : undefined;
  const isMarketingDocType = normalizedDocType === "MARKETING";
  const isSupportDocType = normalizedDocType === "SUPPORT";
  const includePosReceipts = onlyPos ? true : !normalizedDocType || (!isMarketingDocType && !isSupportDocType);
  const includeMarketingReceipts = !onlyPos && (isMarketingDocType || (includeLedger && !normalizedDocType));
  const includeSupportReceipts = !onlyPos && (isSupportDocType || (includeLedger && !normalizedDocType));
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
  const posOwnerId = attendantId ?? (scope === "mine" ? currentUserId : null);
  const ownerOr = buildPosStaffOwnerCondition(posOwnerId);
  if (ownerOr.length) {
    posWhere.AND = [...(posWhere.AND ?? []), { OR: ownerOr }];
  }
  if (paymentMethod) {
    posWhere.data ??= {};
    posWhere.data.path = ["paymentMethod"];
    posWhere.data.equals = paymentMethod;
  }

  const dailyEntryWhere: any = {
    date: { gte: start, lte: end },
  };
  if (posOwnerId) {
    dailyEntryWhere.submittedById = posOwnerId;
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
                  include: {
                    orderCosts: true,
                    profitSnapshots: {
                      orderBy: { computedAt: "desc" },
                      take: 1,
                      select: { unitCost: true, profit: true, qty: true },
                    },
                    product: { select: { lastBuyingPrice: true } },
                  },
                },
              },
            },
          },
        })
      : [],
  ]);

  const supportLedgerCandidates = new Set<string>();
  for (const receipt of posReceipts) {
    const orderNumber = receipt.order?.orderNumber;
    if (!orderNumber) continue;
    supportLedgerCandidates.add(orderNumber);
    const receiptKeyCandidate = buildReceiptKey(orderNumber, receipt.id);
    if (receiptKeyCandidate) {
      supportLedgerCandidates.add(receiptKeyCandidate);
    }
    const normalized = canonicalReceiptNumber(orderNumber);
    if (normalized) {
      supportLedgerCandidates.add(normalized);
    }
  }

  const supportBuyingTotals = new Map<string, number>();
  const candidateArray = Array.from(supportLedgerCandidates).filter((value) => value && value.length > 0);
  if (candidateArray.length > 0) {
    try {
      const ledgerEntries = await prisma.supportReceipt.findMany({
        where: {
          OR: [
            { receiptNumber: { in: candidateArray } },
            { receiptKey: { in: candidateArray } },
          ],
        },
        select: {
          receiptNumber: true,
          receiptKey: true,
          buyingTotal: true,
          items: { select: { buyingPrice: true } },
        },
      });
      for (const entry of ledgerEntries) {
        const explicitBuyingTotal = Number(entry.buyingTotal ?? 0);
        const itemsSum = Array.isArray((entry as any).items)
          ? (entry as any).items.reduce((sum: number, it: any) => sum + Number(it?.buyingPrice ?? 0), 0)
          : 0;
        const buyingTotal = explicitBuyingTotal > 0 ? explicitBuyingTotal : itemsSum;
        if (buyingTotal <= 0) continue;
        const keys = [entry.receiptNumber, entry.receiptKey].filter(Boolean) as string[];
        for (const key of keys) {
          if (!key) continue;
          if (!supportBuyingTotals.has(key)) {
            supportBuyingTotals.set(key, buyingTotal);
          }
          const normalized = canonicalReceiptNumber(key);
          if (normalized && !supportBuyingTotals.has(normalized)) {
            supportBuyingTotals.set(normalized, buyingTotal);
          }
        }
      }
    } catch (err) {
      console.warn("[adminReceiptsSummary] failed to load support ledger buying totals", err);
    }
  }

  // Filter POS receipts by POD presence at the app level to keep JSON where
  // logic simple and predictable across "data" shapes (null vs object).
  //
  // - Default (customerType not 'pod'): exclude all POD receipts so POD workflows
  //   never affect normal POS summaries.
  // - When customerType='pod': include only POD receipts, optionally filtering by status.
  const isPodReceipt = (r: any) => Boolean(r?.data && typeof r.data === "object" && (r.data as any).podDelivery);
  const podStatusOf = (r: any) => ((r?.data as any)?.podDelivery?.status ?? "").toString().toLowerCase();
  const isPodPaid = (r: any) => Boolean((r?.data as any)?.podDelivery?.paidAt);
  const isPosPaid = (r: any) => {
    const paymentStatus = (r?.order?.paymentStatus ?? "").toString().toUpperCase().trim();
    if (!paymentStatus) return false;
    return paymentStatus === "PAID";
  };
  const isPodSettledForSales = (r: any) => {
    if (!isPodReceipt(r)) return false;
    if (podStatusOf(r) === "pending") return false;
    return isPodPaid(r) || isPosPaid(r);
  };

  let excludedUnpaidPos = 0;
  let excludedUnpaidPod = 0;
  let excludedTotalSales = 0;

  const applySalesOnly = (rows: any[]) => {
    if (!salesOnly) return rows;
    return rows.filter((r) => {
      const sale = Number((r?.totals as any)?.total ?? r?.order?.totalAmount ?? 0);
      if (isPodReceipt(r)) {
        const keep = isPodSettledForSales(r);
        if (!keep) {
          excludedUnpaidPod += 1;
          excludedTotalSales += sale;
        }
        return keep;
      }
      const keep = isPosPaid(r);
      if (!keep) {
        excludedUnpaidPos += 1;
        excludedTotalSales += sale;
      }
      return keep;
    });
  };

  const posReceiptsFinal = (() => {
    if (normalizedCustomerType === "pod") {
      const onlyPods = (posReceipts as any[]).filter(isPodReceipt);
      const byStatus = normalizedPodStatus ? onlyPods.filter((r) => podStatusOf(r) === normalizedPodStatus) : onlyPods;
      return applySalesOnly(byStatus);
    }

    // Default: include all POS receipts (POD and non-POD) so the main summary
    // reflects the same receipts list shown on the page. The POD panel fetches
    // its own totals via customerType='pod'.
    return applySalesOnly(posReceipts as any[]);
  })();

  // Best-effort cost lookup: ProductCost.latest per productId (used when orderCosts are missing).
  const productCostMap = new Map<string, number>();
  try {
    const productIds = new Set<string>();
    for (const r of posReceiptsFinal as any[]) {
      const items = (r?.order?.items ?? []) as any[];
      for (const it of items) {
        if (it?.productId) productIds.add(String(it.productId));
      }
    }
    const ids = Array.from(productIds);
    if (ids.length > 0) {
      const costs = await prisma.productCost.findMany({
        where: { productId: { in: ids } },
        orderBy: [{ productId: "asc" }, { createdAt: "desc" }],
        distinct: ["productId"],
        select: { productId: true, price: true },
      });
      for (const c of costs) {
        const n = Number(c.price ?? 0);
        if (c.productId && Number.isFinite(n) && n > 0) {
          productCostMap.set(String(c.productId), n);
        }
      }
    }
  } catch (e) {
    console.warn("[adminReceiptsSummary] failed to load ProductCost fallbacks", e instanceof Error ? e.message : String(e));
  }

  const marketingRecords: ReceiptSummaryRecord[] = marketingReceipts.map((receipt) => ({
    source: "marketing" as const,
    id: receipt.id,
    // Prefer receiptNumber, fall back to receiptKey (if present) before id.
    key: buildReceiptKey((receipt as any).receiptNumber ?? (receipt as any).receiptKey ?? null, receipt.id),
    receiptNumber: (receipt as any).receiptNumber ?? null,
    paymentMethod: normalizePaymentMethod(receipt.paymentMethod) ?? null,
    sellingTotal: Number(receipt.sellingTotal ?? 0),
    items: (receipt.items ?? []).map((it: any) => ({ quantity: it?.quantity, buyingPrice: Number(it?.buyingPrice ?? it?.buyingPrice ?? 0) })),
    buyingTotal: Number(receipt.buyingTotal ?? (receipt.data as any)?.buyingTotal ?? 0),
    profit: (() => {
      const p = (receipt as any).profit ?? (receipt as any).data?.profit;
      if (typeof p === 'number' && Number.isFinite(p)) return Number(p);
      if (typeof p === 'string' && p.trim() !== '' && !Number.isNaN(Number(p))) return Number(p);
      return undefined;
    })(),
  }));

  const supportRecords: ReceiptSummaryRecord[] = supportReceipts.map((receipt) => ({
    source: "support" as const,
    id: receipt.id,
    // Prefer receiptNumber, fall back to receiptKey (if present) before id.
    key: buildReceiptKey((receipt as any).receiptNumber ?? (receipt as any).receiptKey ?? null, receipt.id),
    receiptNumber: (receipt as any).receiptNumber ?? null,
    paymentMethod: normalizePaymentMethod(receipt.paymentMethod) ?? null,
    sellingTotal: Number(receipt.sellingTotal ?? 0),
    items: (receipt.items ?? []).map((it: any) => ({ quantity: it?.quantity, buyingPrice: Number(it?.buyingPrice ?? it?.buyingPrice ?? 0) })),
    buyingTotal: Number(receipt.buyingTotal ?? (receipt.data as any)?.buyingTotal ?? 0),
    profit: (() => {
      const p = (receipt as any).profit ?? (receipt as any).data?.profit;
      if (typeof p === 'number' && Number.isFinite(p)) return Number(p);
      if (typeof p === 'string' && p.trim() !== '' && !Number.isNaN(Number(p))) return Number(p);
      return undefined;
    })(),
  }));

  const posRecords: ReceiptSummaryRecord[] = posReceiptsFinal.map((receipt) => {
    const orderRef = receipt.order?.orderNumber ?? null;
    const normalizedOrderNumber = canonicalReceiptNumber(orderRef ?? undefined);
    const keyCandidates = [
      orderRef,
      normalizedOrderNumber,
      buildReceiptKey(orderRef, receipt.id),
    ].filter((value): value is string => Boolean(value));
    let supportBuyingTotal: number | undefined;
    for (const key of keyCandidates) {
      const candidate = supportBuyingTotals.get(key);
      if (typeof candidate === "number" && candidate > 0) {
        supportBuyingTotal = candidate;
        break;
      }
    }
    return {
      source: "pos" as const,
      id: receipt.id,
      key: buildReceiptKey(orderRef, receipt.id),
      receiptNumber: receipt.receiptNumber ?? orderRef ?? null,
      paymentMethod: normalizePaymentMethod((receipt.data as any)?.paymentMethod) ?? null,
      sellingTotal: Number((receipt.totals as any)?.total ?? receipt.order?.totalAmount ?? 0),
      // Prefer an explicit aggregate buying total stored on the receipt (if present),
      // otherwise fall back to item-level costs computed below.
      buyingTotal: Number((receipt as any)?.buyingTotal ?? (receipt.data as any)?.buyingTotal ?? 0),
      supportBuyingTotal: supportBuyingTotal,
      deliveryFee: getPodDeliveryFee(receipt.data),
      profit: (() => {
        const agentSaleCommission = Number((receipt.data as any)?.agentSale?.commissionAmount ?? 0) || 0;
        const p = (receipt as any).profit ?? (receipt.data as any)?.profit;
        if (typeof p === 'number' && Number.isFinite(p)) return Number(p) - agentSaleCommission;
        if (typeof p === 'string' && p.trim() !== '' && !Number.isNaN(Number(p))) return Number(p) - agentSaleCommission;
        return undefined;
      })(),
      items: (receipt.order?.items ?? []).map((item) => {
        const costs = Array.isArray((item as any).orderCosts) ? (item as any).orderCosts : [];
        const buyingSum = costs.reduce((sum: number, cost: any) => sum + Number(cost.unitCost ?? 0), 0);

        // Fallback cost sources (in priority order):
        // - Latest profit snapshot unitCost (if computed)
        // - Product.lastBuyingPrice (if available)
        // - ProductCost.latest (if available)
        const snapUnitCost = (() => {
          const snap = Array.isArray((item as any).profitSnapshots) ? (item as any).profitSnapshots[0] : null;
          const n = snap ? Number(snap.unitCost ?? 0) : 0;
          return Number.isFinite(n) ? n : 0;
        })();
        const productLastBuying = Number((item as any).product?.lastBuyingPrice ?? 0) || 0;
        const productCost = productCostMap.get(String((item as any).productId ?? "")) ?? 0;
        const fallbackUnitCost =
          snapUnitCost > 0 ? snapUnitCost : productLastBuying > 0 ? productLastBuying : productCost > 0 ? productCost : 0;
        return {
          quantity: item.quantity,
          buyingPrice: buyingSum > 0 ? buyingSum : fallbackUnitCost,
        };
      }),
    };
  });

  const combinedRecords = [...marketingRecords, ...supportRecords, ...posRecords];

  const sourcePriority: Record<Source, number> = {
    pos: 3,
    marketing: 2,
    support: 1,
  };

  const dedupedMap = new Map<string, ReceiptSummaryRecord>();
  const recordCostScore = (record: ReceiptSummaryRecord): number => {
    const aggregate = Math.max(Number(record.supportBuyingTotal ?? 0), Number(record.buyingTotal ?? 0));
    if (aggregate > 0) return 1000;
    const items = Array.isArray(record.items) ? record.items : [];
    if (!items.length) return 0;
    const priced = items.filter((it) => Number(it?.buyingPrice ?? 0) > 0).length;
    return priced / items.length;
  };

  for (const record of combinedRecords) {
    const existing = dedupedMap.get(record.key);
    const candidateScore = recordCostScore(record);
    const existingScore = existing ? recordCostScore(existing) : -1;
    const shouldReplace = () => {
      if (!existing) return true;
      // If a marketing row exists but lacks cost information and the
      // support row for the same receipt has cost, prefer the support row
      // to avoid losing buying-price-derived profit information.
      if (existing.source === "marketing" && record.source === "support" && existingScore <= 0 && candidateScore > 0) {
        return true;
      }
      if (candidateScore !== existingScore) return candidateScore > existingScore;
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

  // NOTE: We intentionally do not override computed totals with a DB-side
  // SUM(data->>'profit') because it can drift from the active filters and
  // can be unset for many receipts. Profit should reflect per-receipt sums.

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

  const totalSales = filteredRecords.reduce((sum, receipt) => sum + Number(receipt.sellingTotal ?? 0), 0);
  const posTotalSales = filteredPos.reduce((sum, receipt) => sum + Number(receipt.sellingTotal ?? 0), 0);

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
  const posReceiptsCount = filteredPos.length;

  let totalCost = 0;
  let totalProfitPriced = 0;
  let totalProfitInclusive = 0;
  let awaitingPricingCount = 0;
  let hasIncompleteCosts = false;
  const profitContributors = new Map<string, ProfitReceiptContributor>();
  const addProfitContributor = (receipt: ReceiptSummaryRecord, buyingTotal: number, profit: number) => {
    const sourceKey = `${receipt.source}:${receipt.id ?? receipt.key}`;
    profitContributors.set(sourceKey, {
      source: receipt.source,
      id: receipt.id,
      key: receipt.key,
      receiptNumber: receipt.receiptNumber ?? null,
      sellingTotal: Number(receipt.sellingTotal ?? 0),
      buyingTotal: Number.isFinite(buyingTotal) ? buyingTotal : 0,
      profit,
    });
  };
  for (const receipt of filteredRecords) {
    const items = Array.isArray(receipt.items) ? receipt.items : [];
    const supportBuying = Number(receipt.supportBuyingTotal ?? 0);
    const aggregateCostRaw = Number(receipt.buyingTotal ?? 0);
    const aggregateCost = supportBuying > 0 ? supportBuying : aggregateCostRaw;
    const deliveryFee = Number(receipt.deliveryFee ?? 0);
    const costFromItems = items.reduce(
      (sum, it) => sum + (Number(it?.buyingPrice ?? 0) * (Number(it?.quantity ?? 1) || 1)),
      0,
    );
    const allItemsPriced = items.length > 0 && items.every((it) => Number(it?.buyingPrice ?? 0) > 0);
    const hasPendingItems = items.length > 0 && items.some((it) => Number(it?.buyingPrice ?? 0) <= 0);
    const hasAggregateCost = aggregateCost > 0;
    const sell = Number(receipt.sellingTotal ?? 0);

    // Some receipts persist a computed `profit` already (e.g. background jobs).
    // Only use it as a fallback when we *can't* recompute profit from costs.
    // This avoids masking real profit with a default/placeholder 0.
    const explicitProfitRaw = (receipt as any).profit ?? undefined;
    const explicitProfit =
      typeof explicitProfitRaw === "number" && Number.isFinite(explicitProfitRaw) ? Number(explicitProfitRaw) : undefined;

    let receiptProfit = 0;
    if (hasAggregateCost || allItemsPriced) {
      const buyingSum = hasAggregateCost ? aggregateCost : costFromItems;
      totalCost += buyingSum;
      receiptProfit = adjustProfitForPodDeliveryFee(sell - buyingSum, deliveryFee);
      totalProfitPriced += receiptProfit;
      addProfitContributor(receipt, buyingSum, receiptProfit);
    } else if (explicitProfit !== undefined) {
      // Use explicit profit; do not mark as awaitingPricing.
      receiptProfit = adjustProfitForPodDeliveryFee(explicitProfit, deliveryFee);
      totalProfitPriced += receiptProfit;
      addProfitContributor(receipt, aggregateCost > 0 ? aggregateCost : costFromItems, receiptProfit);
    }

    if (hasPendingItems) {
      awaitingPricingCount += 1;
      hasIncompleteCosts = true;
    }

    totalProfitInclusive += receiptProfit;
  }

  const hasCompleteCosts = filteredRecords.length === 0 ? true : !hasIncompleteCosts;

  return {
    totalSales,
    totalCost,
    totalProfit: totalProfitInclusive,
    totalProfitPriced,
    totalProfitInclusive,
    receiptsCount,
    posReceiptsCount,
    posTotalSales,
    itemsCount,
    hasCompleteCosts,
    awaitingPricingCount,
    paymentTotals,
    profitContributors: Array.from(profitContributors.values()),
    ...(debug
      ? {
          debug: {
            start: start.toISOString(),
            end: end.toISOString(),
            includeLedger,
            salesOnly,
            rawPosReceipts: (posReceipts as any[]).length,
            rawPodReceipts: (posReceipts as any[]).filter(isPodReceipt).length,
            rawNonPodReceipts: (posReceipts as any[]).filter((r) => !isPodReceipt(r)).length,
            includedReceipts: (posReceiptsFinal as any[]).length,
            excludedUnpaidPos,
            excludedUnpaidPod,
            excludedTotalSales,
          },
        }
      : {}),
  };
}
