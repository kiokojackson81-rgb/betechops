import { getReceiptRecognitionDate } from "@/lib/receiptRecognition";
import { attachReceiptPricingEvidence } from "@/lib/receiptRecognitionData";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { buildReceiptKey, normalizePaymentMethod, normalizeReceiptNumber } from "@/lib/receiptKey";
import { canonicalReceiptNumber } from "@/lib/receiptGuard";
import { buildReceiptKey as buildDatedReceiptKey } from "@/lib/receipts/utils";
import { adjustProfitForPodDeliveryFee, getPodDeliveryFee } from "@/lib/podDeliveryFee";
import { computeRecognizedReceiptProfit } from "@/lib/recognizedReceiptProfit";
import { calculateAggregateReceiptProfit, readReceiptAggregatePricing } from "@/lib/receiptAggregatePricing";
import {
  getReceiptProjectCompletionDate,
  isReceiptProjectRecognizedForSales,
  readReceiptProjectFlow,
} from "@/lib/receiptProjects";
import { isReceiptCancelledForSales } from "@/lib/receiptSalesEligibility";
import { receiptFinancialExclusion, receiptSalesOwner } from "@/lib/receiptFinancialState";

type OrderItemCandidate = {
  sellingPrice?: number;
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
  docType?: string;
  order?: {
    orderNumber?: string | null;
    totalAmount?: number | null;
    paidAmount?: number | null;
    customerName?: string | null;
    attendantId?: string | null;
    paymentStatus?: string | null;
    status?: string | null;
    items?: OrderItemCandidate[];
  } | null;
};

export type PosReceiptSummary = {
  recordedSales: number;
  commissionEligibleSales: number;
  receiptBreakdown: ReceiptSalesBreakdown[];
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

export type ReceiptSalesBreakdown = {
  receiptId: string; receiptKey: string; customerName: string; source: string; docType: string;
  salesDate: Date | null; createdAt: Date | null; sales: number; eligibleSales: number;
  profit: number; buyingTotal?: number; itemCount: number; paymentMethod: string; paymentStatus: string;
  reason: string; eligible: boolean; commission?: number;
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
  const directProfit =
    toNumber((row as any)?.profit) ||
    toNumber((totals as any)?.profit) ||
    toNumber((data as any)?.profit);
  const agentSaleCommission = toNumber((data as any)?.agentSale?.commissionAmount);
  if (directProfit > 0) {
    return Math.max(0, directProfit - agentSaleCommission);
  }
  const buying = toNumber(totals.buyingTotal) || toNumber(data.buyingTotal);
  if (buying > 0) {
    return adjustProfitForPodDeliveryFee(sales - buying - agentSaleCommission, getPodDeliveryFee(row.data));
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

const getProjectHandlerStaffId = (receipt: PosReceiptRow) => {
  const rawData =
    receipt.data && typeof receipt.data === "object" && !Array.isArray(receipt.data)
      ? (receipt.data as Record<string, unknown>)
      : {};
  const flow = readReceiptProjectFlow(rawData.projectFlow);
  return normalizeOptionalId(flow?.handlerStaffId);
};

const isCompletedProjectReceiptForSales = (receipt: PosReceiptRow) => {
  const rawData =
    receipt.data && typeof receipt.data === "object" && !Array.isArray(receipt.data)
      ? (receipt.data as Record<string, unknown>)
      : {};
  const flow = readReceiptProjectFlow(rawData.projectFlow);
  if (!flow?.isProject) return true;
  return isReceiptProjectRecognizedForSales(rawData.projectFlow);
};

const getReceiptSalesRecognitionDate = getReceiptRecognitionDate;

const matchesOwnershipMode = (
  receipt: PosReceiptRow,
  userId: string | null | undefined,
  ownershipMode: "hybrid" | "issuerOnly" | "staffOnly" | "staffDisplay" = "hybrid",
) => {
  if (!userId) return true;
  if (ownershipMode === "issuerOnly") return receipt.issuedById === userId;
  return receiptSalesOwner(receipt) === userId;
};

export async function summarizePosReceiptsForPeriod(period: {
  start: Date;
  end: Date;
  userId?: string | null;
  ownershipMode?: "hybrid" | "issuerOnly" | "staffOnly" | "staffDisplay";
  supportPricingScope?: "user" | "any";
  profitRecognitionMode?: "recognizedDate" | "salesDate";
  paymentScope?: "paidOnly" | "all";
  docType?: string | null;
  paymentMethod?: "MPESA" | "CASH" | null;
  search?: string;
  customerType?: string;
  podStatus?: string;
  client?: Prisma.TransactionClient;
}) {
  const client = period.client ?? prisma;
  const ownerOr =
    period.userId && period.userId.length > 0
      ? period.ownershipMode === "issuerOnly"
        ? [{ issuedById: period.userId }]
        : period.ownershipMode === "staffOnly"
          ? [
              { order: { attendantId: period.userId } },
              { data: { path: ["attendantId"], equals: period.userId } },
              { data: { path: ["projectFlow", "handlerStaffId"], equals: period.userId } },
              { issuedById: period.userId },
            ]
        : period.ownershipMode === "staffDisplay"
          ? [
              { issuedById: period.userId },
              { order: { attendantId: period.userId } },
              { data: { path: ["attendantId"], equals: period.userId } },
              { data: { path: ["projectFlow", "handlerStaffId"], equals: period.userId } },
              { issuedById: period.userId },
            ]
        : [
            { issuedById: period.userId },
            { order: { attendantId: period.userId } },
            { data: { path: ["attendantId"], equals: period.userId } },
            { data: { path: ["projectFlow", "handlerStaffId"], equals: period.userId } },
            { issuedById: period.userId },
          ]
      : null;

  const supportDailyEntryWhere =
    period.supportPricingScope !== "any" &&
    period.userId &&
    period.userId.length > 0 &&
    period.ownershipMode !== "issuerOnly"
      ? { submittedById: period.userId }
      : {};

  const baseReceipts = await client.receipt.findMany({
      where: {
        AND: [
          { createdAt: { lte: period.end } },
          ...(period.docType ? [{ docType: period.docType as any }] : []),
          ...(ownerOr ? [{ OR: ownerOr }] : []),
          ...(period.paymentMethod ? [{ data: { path: ["paymentMethod"], equals: period.paymentMethod } }] : []),
          ...(period.customerType === "pod" ? [{ data: { path: ["customerType"], equals: "pod" } }] : []),
          ...(period.podStatus ? [{ data: { path: ["podDelivery", "status"], equals: period.podStatus === "failed" ? "delivery_failed" : period.podStatus } }] : []),
          ...(period.search ? [{ OR: [
            { receiptNumber: { contains: period.search, mode: "insensitive" as const } },
            { order: { orderNumber: { contains: period.search, mode: "insensitive" as const } } },
            { order: { customerName: { contains: period.search, mode: "insensitive" as const } } },
            { order: { customerPhone: { contains: period.search, mode: "insensitive" as const } } },
            { order: { customerEmail: { contains: period.search, mode: "insensitive" as const } } },
            { order: { attendant: { name: { contains: period.search, mode: "insensitive" as const } } } },
            { issuedBy: { name: { contains: period.search, mode: "insensitive" as const } } },
          ] }] : []),
        ],
      },
      include: {
        order: {
          select: {
            orderNumber: true,
            totalAmount: true,
            paidAmount: true,
            customerName: true,
            attendantId: true,
            paymentStatus: true,
            status: true,
            items: {
              select: {
                productId: true,
                quantity: true,
                sellingPrice: true,
                orderCosts: { orderBy: { createdAt: "desc" }, take: 1, select: { unitCost: true, createdAt: true } },
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
    });
  const receipts = [...new Map(baseReceipts.map(row => [row.id, row])).values()] as PosReceiptRow[];
  await attachReceiptPricingEvidence(receipts, client);
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
  const filteredReceipts = receipts
    .filter((r: any) => {
      if (period.paymentScope === "all") return !isReceiptCancelledForSales(r) && isCompletedProjectReceiptForSales(r);
      return receiptFinancialExclusion(r) === null;
    })
    .filter((receipt) => matchesOwnershipMode(receipt, period.userId, period.ownershipMode));

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
      const costs = await client.productCost.findMany({
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
      const ledgerEntries = await client.supportReceipt.findMany({
        where: {
          OR: [{ receiptNumber: { in: candidateArray } }, { receiptKey: { in: candidateArray } }, ...candidateArray.map(key => ({ receiptKey: { endsWith: `:${canonicalReceiptNumber(key)}` } }))],
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

        const keys = [entry.receiptNumber, entry.receiptKey, String(entry.receiptKey ?? "").split(":").pop()]
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
    const aggregatePricing = readReceiptAggregatePricing(row);
    if (!aggregatePricing.isAuthoritativeTotal && ((row.data as any)?.needsPricing === true || (row.totals as any)?.needsPricing === true)) return 0;

    const agentSaleCommission = Number((row?.data as any)?.agentSale?.commissionAmount ?? 0) || 0;
    const deliveryFee = getPodDeliveryFee(row.data);
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

    const aggregateCost = aggregatePricing.isAuthoritativeTotal
      ? aggregatePricing.buyingTotal
      : supportBuying && supportBuying > 0
        ? supportBuying
        : aggregatePricing.buyingTotal;

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
    if (aggregatePricing.isAuthoritativeTotal || (supportBuying && (row as any).financialPricingEvidence?.complete)) {
      return calculateAggregateReceiptProfit({
        sellingTotal: selling,
        buyingTotal: aggregateCost,
        commissionTotal: agentSaleCommission,
        deliveryFee,
      });
    }
    const recognized = computeRecognizedReceiptProfit({
        items: items.map((item: any, idx: number) => ({
          quantity: item?.quantity,
          sellingPrice: item?.sellingPrice ?? item?.unitPrice ?? 0,
          buyingPrice: Number(perItemUnitCosts[idx] ?? 0),
        })),
        aggregateSellingTotal: selling,
        aggregateBuyingTotal: aggregateCost,
        commissionTotal: agentSaleCommission,
        deliveryFee,
      });
    return recognized.hasPendingItems ? 0 : recognized.recognizedProfit;
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
        const salesDate = getReceiptSalesRecognitionDate(receipt);
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

  const supportProfitByReceipt = new Map<string, { profit: number; buyingTotal: number; sellingTotal: number }>();
  if (candidateReceiptNumbers.length > 0) {
    const supportRows = await client.supportSale.findMany({
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
      for (const rawKey of new Set(collectReceiptVariants(row.receiptNumber ?? undefined).map(value => canonicalReceiptNumber(value)))) {
        const canonical = canonicalReceiptNumber(rawKey);
        if (!canonical) continue;
        const existing = supportProfitByReceipt.get(canonical);
        if (!existing) {
          supportProfitByReceipt.set(canonical, {
            profit: selling - buying,
            buyingTotal: buying,
            sellingTotal: selling,
          });
          continue;
        }
        supportProfitByReceipt.set(canonical, {
          profit: existing.profit + (selling - buying),
          buyingTotal: existing.buyingTotal + buying,
          sellingTotal: existing.sellingTotal + selling,
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
    const salesDate = getReceiptSalesRecognitionDate(receipt);
    const salesIncluded = isDateInRange(salesDate, period.start, period.end);
    const canonicalOrderNumber =
      canonicalReceiptNumber(receipt.order?.orderNumber ?? undefined) ??
      canonicalReceiptNumber(receipt.receiptNumber ?? undefined) ??
      null;
    const supportContextCandidate = canonicalOrderNumber ? supportProfitByReceipt.get(canonicalOrderNumber) : undefined;
    const supportContext =
      supportContextCandidate && supportContextCandidate.buyingTotal > 0 && Math.round(supportContextCandidate.sellingTotal) === Math.round(sales)
        ? supportContextCandidate
        : undefined;
    const profit =
      supportContext
        ? adjustProfitForPodDeliveryFee(supportContext.profit - (Number((receipt?.data as any)?.agentSale?.commissionAmount ?? 0) || 0), getPodDeliveryFee(receipt.data))
        : computeProfitFromCosts(receipt);

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

    const profitIncluded = salesIncluded;
    if (profit && profitIncluded) {
      totalProfit += profit;
    }
  }

  const receiptBreakdown: ReceiptSalesBreakdown[] = [];
  const breakdownSeen = new Set<string>();
  for (const receipt of receipts) {
    if (!matchesOwnershipMode(receipt, period.userId, period.ownershipMode)) continue;
    if (period.docType && receipt.docType !== period.docType) continue;
    const key = canonicalKeyForRow(receipt);
    if (breakdownSeen.has(key)) continue;
    breakdownSeen.add(key);
    const date = getReceiptSalesRecognitionDate(receipt);
    const created = receipt.createdAt ?? receipt.generatedAt ?? null;
    if (!isDateInRange(date, period.start, period.end) && !isDateInRange(created, period.start, period.end)) continue;
    const reason = receiptFinancialExclusion(receipt) || (!date ? "Awaiting complete buying prices" : !isDateInRange(date, period.start, period.end) ? "Recognized in another period" : "Eligible");
    const eligible = reason === "Eligible";
    const sales = extractSales(receipt);
    const support = supportProfitByReceipt.get(key);
    const profit = eligible ? (support && support.buyingTotal > 0 && Math.round(support.sellingTotal) === Math.round(sales)
      ? adjustProfitForPodDeliveryFee(support.profit - (Number(receipt.data?.agentSale && (receipt.data.agentSale as any).commissionAmount) || 0), getPodDeliveryFee(receipt.data))
      : computeProfitFromCosts(receipt)) : 0;
    receiptBreakdown.push({ receiptId: receipt.id, receiptKey: receipt.receiptNumber || receipt.order?.orderNumber || receipt.id,
      customerName: receipt.order?.customerName || "", source: "POS", docType: receipt.docType || "RECEIPT",
      salesDate: date, createdAt: created, sales, eligibleSales: eligible ? sales : 0, profit, buyingTotal: eligible ? sales - profit - getPodDeliveryFee(receipt.data) - (Number((receipt.data as any)?.agentSale?.commissionAmount) || 0) : 0, itemCount: countItems(receipt),
      paymentMethod: normalizePaymentMethod(receipt.data?.paymentMethod ?? receipt.totals?.paymentMethod) || "MPESA",
      paymentStatus: receipt.order?.paymentStatus || "", reason, eligible });
  }
  return {
    recordedSales: receiptBreakdown.filter(row => row.reason !== "Cancelled").reduce((sum, row) => sum + row.sales, 0),
    commissionEligibleSales: totalSales,
    receiptBreakdown: receiptBreakdown.sort((a, b) => ((b.salesDate ?? b.createdAt)?.getTime() ?? 0) - ((a.salesDate ?? a.createdAt)?.getTime() ?? 0)),
    totalSales,
    totalProfit,
    totalItems,
    totalReceipts,
    receiptKeys: Array.from(seen.entries())
      .filter(([receiptId]) => {
        const row = filteredReceipts.find((receipt) => canonicalKeyForRow(receipt) === receiptId);
        const salesDate = row ? getReceiptSalesRecognitionDate(row) : null;
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
