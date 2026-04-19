import { prisma } from "@/lib/prisma";
import { Prisma } from '@prisma/client';
import { normalizePaymentMethod } from "@/lib/receiptKey";
import { normalizeReceiptNumber } from "@/lib/receiptKey";
import { canonicalReceiptNumber } from "@/lib/receiptGuard";

type OrderItemCandidate = {
  quantity?: number | null;
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
    period.userId && period.userId.length > 0 && period.ownershipMode !== "issuerOnly"
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
          {
            OR: [
              { data: { path: ["podDelivery"], equals: Prisma.JsonNull } },
              { NOT: { data: { path: ["podDelivery", "status"], equals: "pending" } } },
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
              {
                OR: [
                  { data: { path: ["podDelivery"], equals: Prisma.JsonNull } },
                  { NOT: { data: { path: ["podDelivery", "status"], equals: "pending" } } },
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

  // Ensure POD-pending receipts are excluded at the application layer
  // to avoid any inconsistencies with Prisma JSON path filters.
  const filteredReceipts = receipts.filter((r) => {
    const pod = r.data?.podDelivery as any | undefined;
    if (!pod) return true;
    return (pod.status || '').toString().toLowerCase() !== 'pending';
  }).filter((receipt) => matchesOwnershipMode(receipt, period.userId, period.ownershipMode));

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
        return collectReceiptVariants(receipt.order?.orderNumber ?? undefined, receipt.receiptNumber ?? undefined);
      }),
    ),
  );

  const supportContexts = new Map<string, { buyingTotal: number; latestPricedAt: Date | null }>();
  if (candidateReceiptNumbers.length > 0) {
    const supportRows = await prisma.supportReceipt.findMany({
      where: {
        ...(Object.keys(supportDailyEntryWhere).length ? { dailyEntry: supportDailyEntryWhere } : {}),
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
    });

    for (const row of supportRows) {
      const items = Array.isArray(row.items) ? row.items : [];
      const aggregateBuying = Number(row.buyingTotal ?? 0);
      const fallbackBuying = items.reduce((sum, item) => sum + Number(item.buyingPrice ?? 0), 0);
      const latestPricedAt = items.reduce<Date | null>((latest, item) => {
        if (!(item.pricedAt instanceof Date)) return latest;
        if (!latest || item.pricedAt.getTime() > latest.getTime()) return item.pricedAt;
        return latest;
      }, null);
      if (!latestPricedAt) continue;
      const buyingTotal = aggregateBuying > 0 ? aggregateBuying : fallbackBuying;
      if (buyingTotal <= 0) continue;
      for (const rawKey of [...collectReceiptVariants(row.receiptNumber ?? undefined), ...extractReceiptKeyTailVariants(row.receiptKey)]) {
        const canonical = canonicalReceiptNumber(rawKey);
        if (!canonical) continue;
        const existing = supportContexts.get(canonical);
        if (!existing) {
          supportContexts.set(canonical, { buyingTotal, latestPricedAt });
          continue;
        }
        supportContexts.set(canonical, {
          buyingTotal: Math.max(existing.buyingTotal, buyingTotal),
          latestPricedAt:
            latestPricedAt.getTime() > (existing.latestPricedAt?.getTime() ?? 0)
              ? latestPricedAt
              : existing.latestPricedAt,
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
    const supportContext = canonicalOrderNumber ? supportContexts.get(canonicalOrderNumber) : undefined;
    const recognizedAt = supportContext?.latestPricedAt ?? salesDate;
    const profit =
      supportContext?.buyingTotal && supportContext.buyingTotal > 0
        ? sales - supportContext.buyingTotal
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

    if (profit && isDateInRange(recognizedAt, period.start, period.end)) {
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
