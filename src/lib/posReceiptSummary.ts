import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { buildReceiptKey, normalizePaymentMethod, normalizeReceiptNumber } from "@/lib/receiptKey";
import { canonicalReceiptNumber } from "@/lib/receiptGuard";
import { buildReceiptKey as buildDatedReceiptKey } from "@/lib/receipts/utils";

type OrderItemCandidate = {
  quantity?: number | null;
  productId?: string | null;
  orderCosts?: Array<{ unitCost?: unknown } | null> | null;
  profitSnapshots?: Array<{ unitCost?: unknown; profit?: unknown; qty?: unknown } | null> | null;
  product?: { lastBuyingPrice?: unknown } | null;
};

type PosReceiptRow = {
  id: string;
  createdAt?: Date | null;
  generatedAt?: Date | null;
  receiptNumber: string | null;
  totals: Record<string, unknown> | null;
  data: Record<string, unknown> | null;
  issuedById?: string | null;
  order?: {
    orderNumber?: string | null;
    totalAmount?: number | null;
    attendantId?: string | null;
    paymentStatus?: string | null;
    items?: OrderItemCandidate[];
  } | null;
};

export type PosReceiptSummary = {
  totalSales: number;
  totalProfit: number;
  totalItems: number;
  totalReceipts: number;
  receiptKeys: string[];
  paymentStats: {
    totalSalesMpesa: number;
    totalSalesCash: number;
    countMpesaReceipts: number;
    countCashReceipts: number;
  };
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
    toNumber(totals.total) ||
    toNumber(totals.sellingTotal) ||
    toNumber(totals.grandTotal) ||
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

const parseExplicitProfit = (row: PosReceiptRow): number | undefined => {
  const totals = row.totals ?? {};
  const data = row.data ?? {};
  const p: any = (row as any).profit ?? (data as any).profit ?? (totals as any).profit;
  if (typeof p === "number" && Number.isFinite(p)) return p;
  if (typeof p === "string" && p.trim() !== "" && !Number.isNaN(Number(p))) return Number(p);
  return undefined;
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

const isDateInRange = (value: Date | null | undefined, start: Date, end: Date) => {
  if (!(value instanceof Date)) return false;
  const time = value.getTime();
  return Number.isFinite(time) && time >= start.getTime() && time <= end.getTime();
};

const normalizeOptionalId = (value: unknown) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const matchesOwnershipMode = (
  receipt: PosReceiptRow,
  userId: string | null | undefined,
  ownershipMode: "hybrid" | "issuerOnly" | "staffOnly" | "staffDisplay" = "hybrid",
) => {
  if (!userId) return true;
  const dataAttendantId = normalizeOptionalId(receipt.data?.attendantId);
  const orderAttendantId = normalizeOptionalId(receipt.order?.attendantId);
  const issuedById = normalizeOptionalId(receipt.issuedById);
  const hasExplicitStaff = Boolean(orderAttendantId || dataAttendantId);

  if (ownershipMode === "issuerOnly") {
    return issuedById === userId;
  }
  if (ownershipMode === "staffOnly") {
    return orderAttendantId === userId || dataAttendantId === userId;
  }
  if (ownershipMode === "staffDisplay") {
    if (orderAttendantId === userId || dataAttendantId === userId) return true;
    if (!hasExplicitStaff && issuedById === userId) return true;
    return false;
  }

  return issuedById === userId || orderAttendantId === userId || dataAttendantId === userId;
};

export async function summarizePosReceiptsForPeriod(period: {
  start: Date;
  end: Date;
  userId?: string | null;
  ownershipMode?: "hybrid" | "issuerOnly" | "staffOnly" | "staffDisplay";
  supportPricingScope?: "user" | "any";
  profitRecognitionMode?: "recognizedDate" | "salesDate";
}) {
  const ownerOr =
    period.userId && period.userId.length > 0
      ? period.ownershipMode === "issuerOnly"
        ? [{ issuedById: period.userId }]
        : period.ownershipMode === "staffOnly"
          ? [
              { order: { attendantId: period.userId } },
              { data: { path: ["attendantId"], equals: period.userId } },
            ]
        : period.ownershipMode === "staffDisplay"
          ? [
              { issuedById: period.userId },
              { order: { attendantId: period.userId } },
              { data: { path: ["attendantId"], equals: period.userId } },
            ]
        : [
            { issuedById: period.userId },
            { order: { attendantId: period.userId } },
            { data: { path: ["attendantId"], equals: period.userId } },
          ]
      : null;

  const supportDailyEntryWhere =
    period.supportPricingScope !== "any" &&
    period.userId &&
    period.userId.length > 0 &&
    period.ownershipMode !== "issuerOnly"
      ? { submittedById: period.userId }
      : {};

  const [baseReceipts, latePricedSupportReceipts] = await Promise.all([
    prisma.receipt.findMany({
      where: {
        AND: [
          {
            OR: [
              { generatedAt: { gte: period.start, lte: period.end } },
              { createdAt: { gte: period.start, lte: period.end } },
            ],
          },
          ...(ownerOr ? [{ OR: ownerOr }] : []),
        ],
      },
      include: {
        order: {
          select: {
            orderNumber: true,
            totalAmount: true,
            attendantId: true,
            items: {
              select: {
                productId: true,
                quantity: true,
                orderCosts: { select: { unitCost: true } },
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
    }),
    prisma.supportReceipt.findMany({
      where: {
        ...(Object.keys(supportDailyEntryWhere).length ? { dailyEntry: supportDailyEntryWhere } : {}),
        items: { some: { pricedAt: { gte: period.start, lte: period.end } } },
      },
      select: {
        receiptNumber: true,
        receiptKey: true,
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

  const extraReceipts =
    lateReceiptNumbers.length > 0
      ? await prisma.receipt.findMany({
          where: {
            AND: [
              ...(ownerOr ? [{ OR: ownerOr }] : []),
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
              select: {
                orderNumber: true,
                totalAmount: true,
                attendantId: true,
                items: {
                  select: {
                    quantity: true,
                  },
                },
              },
            },
          },
        })
      : [];

  const receipts = [...baseReceipts, ...extraReceipts] as PosReceiptRow[];
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

  // Filter at the application layer:
  // - exclude POD pending always
  // - include only settled receipts for totals
  //   POD counts once delivered and the linked order is already PAID, even if
  //   the separate POD `paidAt` marker has not been set yet.
  const filteredReceipts = receipts.filter((r: any) => {
    if (isPodReceipt(r)) {
      return isPodSettledForSales(r);
    }
    return isPosPaid(r);
  }).filter((receipt) => matchesOwnershipMode(receipt, period.userId, period.ownershipMode));

  // Optional fallback costs: latest ProductCost per productId.
  const productCostMap = new Map<string, number>();
  try {
    const productIds = new Set<string>();
    for (const r of filteredReceipts as any[]) {
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
  } catch {
    // best-effort
  }

  // Optional fallback costs: support ledger buying totals, keyed by receiptNumber/receiptKey.
  const supportBuyingTotals = new Map<string, number>();
  try {
    const candidates = new Set<string>();
    for (const r of filteredReceipts as any[]) {
      const orderRef = String(r?.order?.orderNumber ?? "");
      const receiptNumber = String(r?.receiptNumber ?? "");
      const key = buildReceiptKey(orderRef || receiptNumber, r.id);
      const normalizedOrder = canonicalReceiptNumber(orderRef);
      const normalizedReceipt = canonicalReceiptNumber(receiptNumber);
      if (orderRef) candidates.add(orderRef);
      if (receiptNumber) candidates.add(receiptNumber);
      if (key) candidates.add(key);
      if (normalizedOrder) candidates.add(normalizedOrder);
      if (normalizedReceipt) candidates.add(normalizedReceipt);
    }
    const candidateArray = Array.from(candidates).filter((v) => v && v.length > 0);
    if (candidateArray.length > 0) {
      const ledgerEntries = await prisma.supportReceipt.findMany({
        where: {
          OR: [{ receiptNumber: { in: candidateArray } }, { receiptKey: { in: candidateArray } }],
        },
        select: {
          receiptNumber: true,
          receiptKey: true,
          buyingTotal: true,
          items: { select: { buyingPrice: true } },
        },
      });
      for (const entry of ledgerEntries as any[]) {
        const explicitBuyingTotal = Number(entry.buyingTotal ?? 0);
        const itemsSum = Array.isArray(entry.items)
          ? entry.items.reduce((sum: number, it: any) => sum + Number(it?.buyingPrice ?? 0), 0)
          : 0;
        const buyingTotal = explicitBuyingTotal > 0 ? explicitBuyingTotal : itemsSum;
        if (!(Number.isFinite(buyingTotal) && buyingTotal > 0)) continue;

        const keys = [entry.receiptNumber, entry.receiptKey]
          .map((k: any) => (typeof k === "string" ? k : ""))
          .filter((k) => k);
        for (const k of keys) {
          if (!supportBuyingTotals.has(k)) supportBuyingTotals.set(k, buyingTotal);
          const normalized = canonicalReceiptNumber(k);
          if (normalized && !supportBuyingTotals.has(normalized)) supportBuyingTotals.set(normalized, buyingTotal);
        }
      }
    }
  } catch {
    // best-effort
  }

  const computeProfitFromCosts = (row: PosReceiptRow) => {
    const selling = extractSales(row);
    const agentSaleCommission = Number((row?.data as any)?.agentSale?.commissionAmount ?? 0) || 0;
    const orderRef = String(row?.order?.orderNumber ?? "");
    const receiptNumber = String(row?.receiptNumber ?? "");
    const keyCandidates = [
      orderRef,
      receiptNumber,
      buildReceiptKey(orderRef || receiptNumber, row.id),
      canonicalReceiptNumber(orderRef),
      canonicalReceiptNumber(receiptNumber),
    ].filter((v): v is string => Boolean(v));
    let supportBuying: number | undefined;
    for (const k of keyCandidates) {
      const v = supportBuyingTotals.get(k);
      if (typeof v === "number" && v > 0) {
        supportBuying = v;
        break;
      }
    }

    const totals = row.totals ?? {};
    const data = row.data ?? {};
    const aggregateCostRaw =
      toNumber((row as any)?.buyingTotal) ||
      toNumber((data as any)?.buyingTotal) ||
      toNumber((totals as any)?.buyingTotal);
    const aggregateCost = supportBuying && supportBuying > 0 ? supportBuying : aggregateCostRaw;

    const items = row.order?.items ?? [];
    const perItemUnitCosts = items.map((item: any) => {
      const costs = Array.isArray(item?.orderCosts) ? item.orderCosts : [];
      const buyingSum = costs.reduce((sum: number, c: any) => sum + Number(c?.unitCost ?? 0), 0);
      const snap = Array.isArray(item?.profitSnapshots) ? item.profitSnapshots[0] : null;
      const snapUnitCost = snap ? Number(snap?.unitCost ?? 0) : 0;
      const productLastBuying = Number(item?.product?.lastBuyingPrice ?? 0) || 0;
      const productCost = productCostMap.get(String(item?.productId ?? "")) ?? 0;
      const fallbackUnitCost =
        snapUnitCost > 0 ? snapUnitCost : productLastBuying > 0 ? productLastBuying : productCost > 0 ? productCost : 0;
      return buyingSum > 0 ? buyingSum : fallbackUnitCost;
    });
    const costFromItems = items.reduce((sum: number, item: any, idx: number) => {
      const qty = Math.max(1, Math.trunc(Number(item?.quantity ?? 1)));
      const unit = Number(perItemUnitCosts[idx] ?? 0);
      return sum + unit * qty;
    }, 0);
    const allItemsPriced = items.length > 0 && perItemUnitCosts.every((u: number) => Number(u) > 0);
    const hasAggregateCost = Number.isFinite(aggregateCost) && aggregateCost > 0;
    const explicitProfit = parseExplicitProfit(row);

    if (hasAggregateCost || allItemsPriced) {
      const buyingSum = hasAggregateCost ? aggregateCost : costFromItems;
      return selling - buyingSum - agentSaleCommission;
    }
    if (explicitProfit !== undefined) return explicitProfit - agentSaleCommission;
    return 0;
  };

  const seen = new Map<string, string>();
  const periodLabel = `${period.start.toISOString()}_${period.end.toISOString()}`;
  let totalSales = 0;
  let totalProfit = 0;
  let totalItems = 0;
  let totalReceipts = 0;
  const paymentStats = {
    totalSalesMpesa: 0,
    totalSalesCash: 0,
    countMpesaReceipts: 0,
    countCashReceipts: 0,
  };

  const candidateReceiptNumbers = Array.from(
    new Set(
      filteredReceipts.flatMap((receipt) => {
        const salesDate =
          receipt.generatedAt instanceof Date
            ? receipt.generatedAt
            : receipt.createdAt instanceof Date
              ? receipt.createdAt
              : null;
        const variants = collectReceiptVariants(
          receipt.order?.orderNumber ?? undefined,
          receipt.receiptNumber ?? undefined,
        );
        const datedKeys =
          salesDate != null
            ? variants
                .map((variant) => buildDatedReceiptKey(salesDate, variant))
                .filter((value): value is string => Boolean(value))
            : [];
        return [...variants, ...datedKeys];
      }),
    ),
  );

  const supportProfitByReceipt = new Map<string, { profit: number; buyingTotal: number }>();
  if (candidateReceiptNumbers.length > 0) {
    const supportRows = await prisma.supportSale.findMany({
      where: {
        ...(Object.keys(supportDailyEntryWhere).length ? { entry: supportDailyEntryWhere } : {}),
        createdAt: { gte: period.start, lte: period.end },
        receiptNumber: { in: candidateReceiptNumbers },
      },
      select: {
        receiptNumber: true,
        sellingPrice: true,
        buyingPrice: true,
      },
    });

    for (const row of supportRows) {
      const selling = Number(row.sellingPrice ?? 0);
      const buying = Number(row.buyingPrice ?? 0);
      for (const rawKey of collectReceiptVariants(row.receiptNumber ?? undefined)) {
        const canonical = canonicalReceiptNumber(rawKey);
        if (!canonical) continue;
        const existing = supportProfitByReceipt.get(canonical);
        if (!existing) {
          supportProfitByReceipt.set(canonical, {
            profit: selling - buying,
            buyingTotal: buying,
          });
          continue;
        }
        supportProfitByReceipt.set(canonical, {
          profit: existing.profit + (selling - buying),
          buyingTotal: existing.buyingTotal + buying,
        });
      }
    }
  }

  for (const receipt of filteredReceipts) {
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
    const salesDate =
      receipt.generatedAt instanceof Date ? receipt.generatedAt : receipt.createdAt instanceof Date ? receipt.createdAt : null;
    const salesIncluded = isDateInRange(salesDate, period.start, period.end);
    const canonicalOrderNumber =
      canonicalReceiptNumber(receipt.order?.orderNumber ?? undefined) ??
      canonicalReceiptNumber(receipt.receiptNumber ?? undefined) ??
      null;
    const supportContext = canonicalOrderNumber ? supportProfitByReceipt.get(canonicalOrderNumber) : undefined;
    const profit =
      supportContext
        ? supportContext.profit - (Number((receipt?.data as any)?.agentSale?.commissionAmount ?? 0) || 0)
        : extractProfit(receipt, sales);

    if (salesIncluded && sales > 0) {
      totalSales += sales;
      totalItems += countItems(receipt);
      totalReceipts += 1;

      const method = normalizePaymentMethod(
        (receipt.data?.paymentMethod as unknown) ??
          (receipt.totals?.paymentMethod as unknown) ??
          "MPESA",
      );
      if (method === "CASH") {
        paymentStats.totalSalesCash += sales;
        paymentStats.countCashReceipts += 1;
      } else {
        paymentStats.totalSalesMpesa += sales;
        paymentStats.countMpesaReceipts += 1;
      }
    }

    const profitIncluded =
      period.profitRecognitionMode === "salesDate"
        ? salesIncluded
        : Boolean(supportContext) || isDateInRange(salesDate, period.start, period.end);
    if (profit && profitIncluded) {
      totalProfit += profit;
    }
  }

  return {
    totalSales,
    totalProfit,
    totalItems,
    totalReceipts,
    receiptKeys: Array.from(seen.entries())
      .filter(([receiptId]) => {
        const row = filteredReceipts.find((receipt) => canonicalKeyForRow(receipt) === receiptId);
        const salesDate =
          row?.generatedAt instanceof Date ? row.generatedAt : row?.createdAt instanceof Date ? row.createdAt : null;
        return isDateInRange(salesDate, period.start, period.end);
      })
      .map(([receiptId]) => receiptId),
    paymentStats,
  };
}

// Back-compat alias: older call sites referenced "for user" naming during refactors.
export async function summarizePosReceiptsForPeriodForUser(period: { start: Date; end: Date; userId?: string | null }) {
  return summarizePosReceiptsForPeriod(period);
}
