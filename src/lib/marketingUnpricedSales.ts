import { prisma } from "@/lib/prisma";
import { getCurrentTradingPeriodFor } from "./marketingPeriod";
import { nowInNairobi } from "@/lib/timezone";
import { canonicalReceiptNumber } from "./receiptGuard";
import { readReceiptProjectFlow } from "./receiptProjects";
import { recalcSupportEntry } from "./marketingReceiptCleanup";

export type PendingReceiptItem = {
  id: string;
  productName: string;
  buyingPrice: number | null;
  catalogProductId?: string | null;
};

export type UnpricedSale = {
  id: string;
  source: "daily-sale" | "support";
  saleDate: string;
  day: string | null;
  productName: string;
  sellingPrice: number;
  paymentMethod: "MPESA" | "CASH" | null;
  receiptNumber: string;
  receiptId?: string | null;
  attendantName: string;
  attendantEmail: string | null;
  receiptTotal?: number;
  receiptItems?: PendingReceiptItem[];
  itemsPending?: number;
  itemsTotal?: number;
};

type UnpricedRangeInput = {
  startDate: Date;
  endDate: Date;
};

type LinkedReceiptOrderItem = {
  name: string;
  productId: string | null;
  hasCost: boolean;
  resolvedBuyingPrice: number;
  quantity: number;
};

type LinkedReceiptContext = {
  items: LinkedReceiptOrderItem[];
  aggregateBuyingTotal: number;
};

type LinkedReceiptPayloadItem = {
  name: string;
  productId: string | null;
  isDeliveryFee: boolean;
};

function isMeaningfulProductName(value: string | null | undefined): value is string {
  const normalized = String(value ?? "").trim();
  if (!normalized) return false;
  return normalized.toLowerCase() !== "item";
}

function summarizeReceiptProductName(names: string[], receiptNumber: string | null | undefined): string {
  const uniqueNames = Array.from(new Set(names.filter(isMeaningfulProductName)));
  if (uniqueNames.length === 1) return uniqueNames[0];
  if (uniqueNames.length > 1) return `${uniqueNames[0]} +${uniqueNames.length - 1} more`;
  return `Receipt ${receiptNumber || ""}`.trim() || "Support receipt";
}

function normalizeProductName(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function getUnpricedDailySalesForRange({
  startDate,
  endDate,
}: UnpricedRangeInput): Promise<UnpricedSale[]> {
  const [dailyReportSales, supportReceipts] = await Promise.all([
    prisma.dailySale.findMany({
      where: {
        dailyReport: {
          date: {
            gte: startDate,
            lte: endDate,
          },
        },
        marketingSales: { none: {} },
      },
      include: {
        dailyReport: {
          include: { user: true },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.supportReceipt.findMany({
      where: {
        dailyEntry: {
          date: {
            gte: startDate,
            lte: endDate,
          },
        },
        items: {
          some: {
            OR: [
              { buyingPrice: null },
              { buyingPrice: 0 },
            ],
          },
        },
      },
      include: {
      dailyEntry: {
        select: {
          date: true,
          dayOfWeek: true,
          submittedBy: {
            select: {
              name: true,
              email: true,
            },
          },
        },
      },
        items: true,
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const receiptNumberCandidates = Array.from(
    new Set(
      [...dailyReportSales.map((sale) => sale.receiptNumber ?? ""), ...supportReceipts.map((receipt) => receipt.receiptNumber ?? "")]
        .flatMap((value) => {
        const raw = typeof value === "string" ? value.trim() : "";
        const canonical = canonicalReceiptNumber(raw) ?? "";
        return [raw, canonical].filter((value): value is string => Boolean(value));
      }),
    ),
  );

  const supportProductNames = Array.from(
    new Set(
      supportReceipts
        .flatMap((receipt) => receipt.items.map((item) => item.productName.trim()))
        .filter(isMeaningfulProductName),
    ),
  );
  const catalogProducts = supportProductNames.length
    ? await prisma.product.findMany({
        where: {
          OR: supportProductNames.map((name) => ({ name: { equals: name, mode: "insensitive" as const } })),
        },
        select: { id: true, name: true, lastBuyingPrice: true, variableCost: true },
      })
    : [];
  const catalogProductsByName = new Map<
    string,
    { id: string; name: string; lastBuyingPrice: number | null; variableCost: boolean } | null
  >();
  for (const product of catalogProducts) {
    const key = normalizeProductName(product.name);
    catalogProductsByName.set(key, catalogProductsByName.has(key) ? null : product);
  }

  const receiptOrderItems =
    receiptNumberCandidates.length > 0
      ? await prisma.order.findMany({
          where: { orderNumber: { in: receiptNumberCandidates } },
          select: {
            orderNumber: true,
            receipt: {
              select: {
                totals: true,
                data: true,
              },
            },
            items: {
              select: {
                productId: true,
                quantity: true,
                product: { select: { name: true, lastBuyingPrice: true, variableCost: true } },
                orderCosts: {
                  orderBy: { createdAt: "desc" },
                  select: { id: true, unitCost: true },
                  take: 1,
                },
                profitSnapshots: { select: { id: true }, take: 1 },
              },
            },
          },
        })
      : [];
  const linkedReceipts =
    receiptNumberCandidates.length > 0
      ? await prisma.receipt.findMany({
          where: {
            OR: [
              { receiptNumber: { in: receiptNumberCandidates } },
              { order: { orderNumber: { in: receiptNumberCandidates } } },
            ],
          },
          select: {
            id: true,
            receiptNumber: true,
            data: true,
            order: { select: { orderNumber: true } },
          },
        })
      : [];

  const orderItemsByReceiptNumber = new Map<string, LinkedReceiptContext>();
  const payloadItemsByReceiptNumber = new Map<string, LinkedReceiptPayloadItem[]>();
  const receiptIdByReceiptNumber = new Map<string, string>();

  const registerPayloadItems = (
    key: string | null | undefined,
    items: LinkedReceiptPayloadItem[],
  ) => {
    const normalizedKey = String(key ?? "").trim();
    if (!normalizedKey || !items.length) return;
    const canonical = canonicalReceiptNumber(normalizedKey) ?? "";
    if (!payloadItemsByReceiptNumber.has(normalizedKey)) {
      payloadItemsByReceiptNumber.set(normalizedKey, items);
    }
    if (canonical && !payloadItemsByReceiptNumber.has(canonical)) {
      payloadItemsByReceiptNumber.set(canonical, items);
    }
  };

  const registerReceiptId = (key: string | null | undefined, receiptId: string | null | undefined) => {
    const normalizedKey = String(key ?? "").trim();
    const normalizedReceiptId = String(receiptId ?? "").trim();
    if (!normalizedKey || !normalizedReceiptId) return;
    const canonical = canonicalReceiptNumber(normalizedKey) ?? "";
    if (!receiptIdByReceiptNumber.has(normalizedKey)) {
      receiptIdByReceiptNumber.set(normalizedKey, normalizedReceiptId);
    }
    if (canonical && !receiptIdByReceiptNumber.has(canonical)) {
      receiptIdByReceiptNumber.set(canonical, normalizedReceiptId);
    }
  };

  for (const receipt of linkedReceipts) {
    registerReceiptId(receipt.receiptNumber, receipt.id);
    registerReceiptId(receipt.order?.orderNumber, receipt.id);
    const projectFlow = readReceiptProjectFlow(
      receipt?.data && typeof receipt.data === "object" && !Array.isArray(receipt.data)
        ? (receipt.data as Record<string, unknown>).projectFlow
        : null,
    );
    const rawItems = (receipt.data as any)?.items;
    if (!Array.isArray(rawItems)) continue;
    const payloadItems = rawItems
      .map((item: any) => {
        const name = String(
          item?.title ??
            item?.productName ??
            item?.name ??
            item?.product?.name ??
            "",
        ).trim();
        const rawProductId =
          typeof item?.productId === "string"
            ? item.productId
            : typeof item?.product?.id === "string"
              ? item.product.id
              : typeof item?.product === "string"
                ? item.product
                : "";
        return {
          name,
          productId: rawProductId.trim() || null,
          isDeliveryFee: Boolean(item?.isDeliveryFee),
        };
      })
      .filter((item) => isMeaningfulProductName(item.name));
    if (!payloadItems.length) continue;
    registerPayloadItems(receipt.receiptNumber, payloadItems);
    registerPayloadItems(receipt.order?.orderNumber, payloadItems);
  }

  for (const order of receiptOrderItems) {
    const linkedItems = order.items
      .map((item) => {
        const recordedCost = Number(item.orderCosts?.[0]?.unitCost ?? 0);
        const catalogCost = item.product?.variableCost ? 0 : Number(item.product?.lastBuyingPrice ?? 0);
        const resolvedBuyingPrice = recordedCost > 0 ? recordedCost : catalogCost > 0 ? catalogCost : 0;
        return {
          name: String(item.product?.name || "").trim(),
          productId: item.productId ? String(item.productId).trim() : null,
          hasCost: resolvedBuyingPrice > 0 || (item.profitSnapshots?.length ?? 0) > 0,
          resolvedBuyingPrice,
          quantity: Math.max(1, Number(item.quantity ?? 1)),
        };
      })
      .filter((item) => isMeaningfulProductName(item.name));
    if (!linkedItems.length) continue;
    const raw = order.orderNumber?.trim();
    const canonical = canonicalReceiptNumber(order.orderNumber ?? undefined);
    const totals = (order as { receipt?: { totals?: any; data?: any } | null }).receipt?.totals as any;
    const dataTotals = ((order as { receipt?: { totals?: any; data?: any } | null }).receipt?.data as any)?.totals as any;
    const aggregateBuyingTotal = Number(totals?.buyingTotal ?? dataTotals?.buyingTotal ?? 0);
    const context: LinkedReceiptContext = {
      items: linkedItems,
      aggregateBuyingTotal: Number.isFinite(aggregateBuyingTotal) ? aggregateBuyingTotal : 0,
    };
    if (raw) orderItemsByReceiptNumber.set(raw, context);
    if (canonical) orderItemsByReceiptNumber.set(canonical, context);
  }

  // Repair stale support-ledger costs before building the pending queue.
  for (const receipt of supportReceipts) {
    const receiptNumber = receipt.receiptNumber?.trim() ?? "";
    const linkedContext =
      orderItemsByReceiptNumber.get(receiptNumber) ??
      orderItemsByReceiptNumber.get(canonicalReceiptNumber(receiptNumber) ?? "") ??
      null;
    const orderedItems = [...receipt.items].sort((left, right) => {
      const byCreatedAt = left.createdAt.getTime() - right.createdAt.getTime();
      return byCreatedAt !== 0 ? byCreatedAt : left.id.localeCompare(right.id);
    });
    const updates: Array<{ id: string; buyingPrice: number }> = [];
    orderedItems.forEach((item, index) => {
      if (Number(item.buyingPrice ?? 0) > 0) return;
      const normalizedName = normalizeProductName(item.productName);
      const linkedItem =
        (normalizedName
          ? linkedContext?.items.find((candidate) => normalizeProductName(candidate.name) === normalizedName)
          : undefined) ?? linkedContext?.items[index];
      const catalogProduct = normalizedName ? catalogProductsByName.get(normalizedName) : null;
      const catalogBuyingPrice = catalogProduct?.variableCost ? 0 : Number(catalogProduct?.lastBuyingPrice ?? 0);
      const resolvedBuyingPrice = linkedItem?.resolvedBuyingPrice || catalogBuyingPrice;
      if (resolvedBuyingPrice <= 0) return;
      updates.push({
        id: item.id,
        buyingPrice: Math.round(resolvedBuyingPrice * (linkedItem?.quantity ?? 1)),
      });
    });
    if (!updates.length) continue;

    const updateById = new Map(updates.map((item) => [item.id, item.buyingPrice]));
    await prisma.$transaction(async (tx) => {
      for (const update of updates) {
        await tx.supportReceiptItem.update({
          where: { id: update.id },
          data: { buyingPrice: update.buyingPrice, pricedAt: new Date() },
        });
      }
      const buyingTotal = receipt.items.reduce(
        (sum, item) => sum + (updateById.get(item.id) ?? Number(item.buyingPrice ?? 0)),
        0,
      );
      await tx.supportReceipt.update({ where: { id: receipt.id }, data: { buyingTotal } });
      await recalcSupportEntry(tx, receipt.dailyEntryId);
    });
    for (const item of receipt.items) {
      const repairedPrice = updateById.get(item.id);
      if (repairedPrice !== undefined) item.buyingPrice = repairedPrice;
    }
  }

  const marketingSales: UnpricedSale[] = dailyReportSales.map((sale) => {
    const rawReceiptNumber = sale.receiptNumber ?? "";
    const canonicalReceipt = canonicalReceiptNumber(rawReceiptNumber) ?? "";
    return {
      id: sale.id,
      source: "daily-sale",
      saleDate: (sale.dailyReport?.date ?? sale.createdAt).toISOString(),
      day: sale.dailyReport?.day ?? null,
      productName: sale.productName,
      sellingPrice: Number(sale.price),
      paymentMethod: (sale.paymentMethod as "MPESA" | "CASH" | null) ?? null,
      receiptNumber: rawReceiptNumber,
      receiptId:
        receiptIdByReceiptNumber.get(rawReceiptNumber.trim()) ??
        receiptIdByReceiptNumber.get(canonicalReceipt) ??
        null,
      attendantName: sale.dailyReport?.submittedBy ?? sale.dailyReport?.user?.name ?? "Unknown",
      attendantEmail: sale.dailyReport?.user?.email ?? null,
      receiptTotal: Number(sale.price),
      itemsPending: 1,
      itemsTotal: 1,
    };
  });

  const supportSales: UnpricedSale[] = supportReceipts
    .map((receipt) => {
      const entry = receipt.dailyEntry;
      const receiptNumber = receipt.receiptNumber?.trim() ?? "";
      const linkedReceiptContext =
        orderItemsByReceiptNumber.get(receiptNumber) ??
        orderItemsByReceiptNumber.get(canonicalReceiptNumber(receiptNumber) ?? "") ??
        null;
      const linkedReceipt =
        linkedReceipts.find((entry) => entry.receiptNumber?.trim() === receiptNumber) ??
        linkedReceipts.find((entry) => entry.order?.orderNumber?.trim() === receiptNumber) ??
        linkedReceipts.find(
          (entry) =>
            canonicalReceiptNumber(entry.receiptNumber ?? undefined) === canonicalReceiptNumber(receiptNumber) ||
            canonicalReceiptNumber(entry.order?.orderNumber ?? undefined) === canonicalReceiptNumber(receiptNumber),
        ) ??
        null;
      const linkedProjectFlow = readReceiptProjectFlow(
        linkedReceipt?.data && typeof linkedReceipt.data === "object" && !Array.isArray(linkedReceipt.data)
          ? (linkedReceipt.data as Record<string, unknown>).projectFlow
          : null,
      );
      if (linkedProjectFlow?.isProject && linkedProjectFlow.stage !== "COMPLETED_POSTED") {
        return null;
      }
      const payloadItems =
        payloadItemsByReceiptNumber.get(receiptNumber) ??
        payloadItemsByReceiptNumber.get(canonicalReceiptNumber(receiptNumber) ?? "") ??
        [];
      const payloadItemsExcludingDelivery = payloadItems.filter((item) => !item.isDeliveryFee);
      const payloadItemNames = payloadItemsExcludingDelivery.map((item) => item.name);
      const linkedReceiptItems = linkedReceiptContext?.items ?? [];
      const receiptItemsOrdered = [...(receipt.items || [])].sort((left, right) => {
        const byCreatedAt = left.createdAt.getTime() - right.createdAt.getTime();
        if (byCreatedAt !== 0) return byCreatedAt;
        return left.id.localeCompare(right.id);
      });
      const catalogProductIdByReceiptItemId = new Map<string, string | null>();
      receiptItemsOrdered.forEach((item, index) => {
        const payloadItem = payloadItemsExcludingDelivery[index] ?? null;
        const linkedOrderItem = linkedReceiptItems[index] ?? null;
        catalogProductIdByReceiptItemId.set(
          item.id,
          payloadItem?.productId?.trim() ||
            linkedOrderItem?.productId?.trim() ||
            catalogProductsByName.get(normalizeProductName(item.productName))?.id ||
            null,
        );
      });
      const pendingItems = (receipt.items || []).filter((item, index) => {
        if (Number(item.buyingPrice ?? 0) > 0) return false;
        const itemName = normalizeProductName(item.productName);
        const matchedLinkedItem =
          (itemName
            ? linkedReceiptItems.find((linked) => normalizeProductName(linked.name) === itemName)
            : undefined) ?? linkedReceiptItems[index];
        const catalogProduct = itemName ? catalogProductsByName.get(itemName) : null;
        const hasFixedCatalogCost =
          Boolean(catalogProduct) &&
          !catalogProduct?.variableCost &&
          Number(catalogProduct?.lastBuyingPrice ?? 0) > 0;
        return !matchedLinkedItem?.hasCost && !hasFixedCatalogCost;
      });
      if (!pendingItems.length) return null;
      const fallbackItemNames = [
        ...payloadItemNames,
        ...linkedReceiptItems.map((item) => item.name),
      ];
      const resolvedReceiptItems = pendingItems.map((item, index) => {
        const resolvedName = isMeaningfulProductName(item.productName) ? item.productName.trim() : fallbackItemNames[index] || fallbackItemNames[0] || "Item";
        return {
          id: item.id,
          productName: resolvedName,
          buyingPrice: item.buyingPrice ? Number(item.buyingPrice) : null,
          catalogProductId: catalogProductIdByReceiptItemId.get(item.id) ?? null,
        };
      });
      return {
        id: receipt.id,
        source: "support" as const,
        saleDate: (entry?.date ?? receipt.createdAt ?? new Date()).toISOString(),
        day: entry?.dayOfWeek ?? null,
        productName: summarizeReceiptProductName(
          resolvedReceiptItems.map((item) => item.productName),
          receipt.receiptNumber,
        ),
        sellingPrice: Number(receipt.sellingTotal ?? 0),
        paymentMethod: (receipt.paymentMethod as "MPESA" | "CASH" | null) ?? null,
        receiptNumber,
        receiptId: linkedReceipt?.id ?? null,
        attendantName: entry?.submittedBy?.name ?? "Support attendant",
        attendantEmail: entry?.submittedBy?.email ?? null,
        receiptTotal: Number(receipt.sellingTotal ?? 0),
        receiptItems: resolvedReceiptItems,
        itemsPending: pendingItems.length,
        itemsTotal: receipt.items.length || pendingItems.length,
      };
    })
    .filter(Boolean) as UnpricedSale[];

  // Exclude support receipts with zero sellingTotal from the unpriced list
  const filteredSupportSales = supportSales.filter((s) => (s.receiptTotal ?? 0) > 0);

  return [...marketingSales, ...filteredSupportSales];
}

export async function getUnpricedDailySalesForCurrentPeriod(): Promise<UnpricedSale[]> {
  const { startDate, endDate } = await getCurrentTradingPeriodFor(nowInNairobi());
  return getUnpricedDailySalesForRange({ startDate, endDate });
}
