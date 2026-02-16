import { prisma } from "@/lib/prisma";
import { canonicalReceiptNumber } from "@/lib/receiptGuard";
import { buildReceiptKey } from "@/lib/receiptKey";
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
  supportBuyingTotal?: number;
  profit?: number;
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

const jsonNullFilter: Prisma.JsonNullValueFilter = Prisma.JsonNull;

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
    // Ensure `podDelivery` is present (not JSON null).
    podAndConditions.push({ data: { path: ['podDelivery'], not: jsonNullFilter } });
  } else {
    podAndConditions.push({
      OR: [
        { data: { path: ['podDelivery'], equals: jsonNullFilter } },
        { NOT: { data: { path: ['podDelivery', 'status'], equals: 'pending' } } },
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
        select: { receiptNumber: true, receiptKey: true, buyingTotal: true },
      });
      for (const entry of ledgerEntries) {
        const buyingTotal = Number(entry.buyingTotal ?? 0);
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

  // Post-query safeguard: filter out POD-pending receipts at the app level
  // unless the caller explicitly requested POD receipts via `customerType='pod'`.
  const posReceiptsFinal = (() => {
    if (normalizedCustomerType === 'pod') {
      // If a specific podStatus was requested, enforce it.
      if (normalizedPodStatus) {
        return (posReceipts as any[]).filter((r) => {
          const pod = r.data?.podDelivery as any | undefined;
          return (pod?.status ?? '').toString().toLowerCase() === normalizedPodStatus;
        });
      }
      return posReceipts;
    }
    return (posReceipts as any[]).filter((r) => {
      const pod = r.data?.podDelivery as any | undefined;
      return !pod || (pod.status || '').toString().toLowerCase() !== 'pending';
    });
  })();

  const marketingRecords: ReceiptSummaryRecord[] = marketingReceipts.map((receipt) => ({
    source: "marketing" as const,
    key: buildReceiptKey(receipt.receiptNumber ?? null, receipt.id),
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
    key: buildReceiptKey(receipt.receiptNumber ?? null, receipt.id),
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

  const posRecords: ReceiptSummaryRecord[] = posReceipts.map((receipt) => {
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
      key: buildReceiptKey(orderRef, receipt.id),
      paymentMethod: normalizePaymentMethod((receipt.data as any)?.paymentMethod) ?? null,
      sellingTotal: Number((receipt.totals as any)?.total ?? receipt.order?.totalAmount ?? 0),
      // Prefer an explicit aggregate buying total stored on the receipt (if present),
      // otherwise fall back to item-level costs computed below.
      buyingTotal: Number((receipt as any)?.buyingTotal ?? (receipt.data as any)?.buyingTotal ?? 0),
      supportBuyingTotal: supportBuyingTotal,
      profit: (() => {
        const p = (receipt as any).profit ?? (receipt.data as any)?.profit;
        if (typeof p === 'number' && Number.isFinite(p)) return Number(p);
        if (typeof p === 'string' && p.trim() !== '' && !Number.isNaN(Number(p))) return Number(p);
        return undefined;
      })(),
      items: (receipt.order?.items ?? []).map((item) => {
        const costs = Array.isArray((item as any).orderCosts) ? (item as any).orderCosts : [];
        const buyingSum = costs.reduce((sum: number, cost: any) => sum + Number(cost.unitCost ?? 0), 0);

        // Fallback cost sources (in priority order):
        // - Latest profit snapshot unitCost (if computed)
        // - Product.lastBuyingPrice (if available)
        const snapUnitCost = (() => {
          const snap = Array.isArray((item as any).profitSnapshots) ? (item as any).profitSnapshots[0] : null;
          const n = snap ? Number(snap.unitCost ?? 0) : 0;
          return Number.isFinite(n) ? n : 0;
        })();
        const productLastBuying = Number((item as any).product?.lastBuyingPrice ?? 0) || 0;
        const fallbackUnitCost = snapUnitCost > 0 ? snapUnitCost : productLastBuying > 0 ? productLastBuying : 0;
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
  const recordHasCostData = (record: ReceiptSummaryRecord) => {
    if (Number(record.buyingTotal ?? 0) > 0) return true;
    if (Number(record.supportBuyingTotal ?? 0) > 0) return true;
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

  // Attempt a server-side aggregation of persisted per-receipt profits
  // to ensure admin summaries reflect JSON-stored profits even when
  // item-level costs are missing. Limit this DB-side aggregation to
  // global scope (avoid complex per-user scope SQL joins here).
  let dbProfitAgg: { total_profit: number; priced_count: number } | null = null;
  try {
    if (scope === "global") {
      const raw: any = await prisma.$queryRaw`
        SELECT
          COALESCE(SUM((data->>'profit')::numeric), 0) AS total_profit,
          COUNT(*) FILTER (WHERE (data->>'profit') IS NOT NULL) AS priced_count
        FROM "Receipt"
        WHERE generatedAt >= ${start} AND generatedAt <= ${end}
      `;
      if (Array.isArray(raw) && raw.length > 0) {
        const first = raw[0];
        dbProfitAgg = {
          total_profit: first.total_profit ? Number(first.total_profit) : 0,
          priced_count: first.priced_count ? Number(first.priced_count) : 0,
        };
      }
    }
  } catch (e) {
    console.warn('[adminReceiptsSummary] failed DB-side profit aggregation', e instanceof Error ? e.message : String(e));
  }

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
  for (const receipt of filteredRecords) {
    const items = Array.isArray(receipt.items) ? receipt.items : [];
    const supportBuying = Number(receipt.supportBuyingTotal ?? 0);
    const aggregateCostRaw = Number(receipt.buyingTotal ?? 0);
    const aggregateCost = supportBuying > 0 ? supportBuying : aggregateCostRaw;
    const costFromItems = items.reduce(
      (sum, it) => sum + (Number(it?.buyingPrice ?? 0) * (Number(it?.quantity ?? 1) || 1)),
      0,
    );
    const allItemsPriced = items.length > 0 && items.every((it) => Number(it?.buyingPrice ?? 0) > 0);
    const hasAggregateCost = aggregateCost > 0;
    const sell = Number(receipt.sellingTotal ?? 0);

    // If an explicit profit value is present on the record (or in its data),
    // prefer that because some receipts persist a computed `profit` already
    // (e.g. from background jobs). This lets admin summaries reflect stored
    // per-receipt profits even when item-level costs are absent.
    const explicitProfitRaw = (receipt as any).profit ?? undefined;
    const explicitProfit = typeof explicitProfitRaw === 'number' && Number.isFinite(explicitProfitRaw) ? Number(explicitProfitRaw) : undefined;

    let receiptProfit = 0;
    if (explicitProfit !== undefined) {
      // Use explicit profit; do not mark as awaitingPricing.
      receiptProfit = explicitProfit;
      totalProfitPriced += receiptProfit;
    } else if (hasAggregateCost || allItemsPriced) {
      const buyingSum = hasAggregateCost ? aggregateCost : costFromItems;
      totalCost += buyingSum;
      receiptProfit = sell - buyingSum;
      totalProfitPriced += receiptProfit;
    } else {
      awaitingPricingCount += 1;
      hasIncompleteCosts = true;
    }

    totalProfitInclusive += receiptProfit;
  }

  // If we were able to compute a DB-side aggregate of stored per-receipt
  // profits, prefer that value for the priced/inclusive totals so the
  // admin summary reflects persisted profits directly from the DB.
  if (dbProfitAgg && Number(dbProfitAgg.priced_count ?? 0) > 0) {
    totalProfitPriced = Number(dbProfitAgg.total_profit ?? 0);
    totalProfitInclusive = Number(dbProfitAgg.total_profit ?? 0);
    // Adjust awaitingPricingCount conservatively when possible.
    try {
      awaitingPricingCount = Math.max(0, receiptsCount - Number(dbProfitAgg.priced_count ?? 0));
    } catch {
      // ignore
    }
  }

  const hasCompleteCosts = filteredRecords.length === 0 ? true : !hasIncompleteCosts;

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
