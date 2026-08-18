import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/nextAuth";
import { isBenjaminSupervisorEmail } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { getTradingPeriodFor } from "@/lib/tradingPeriod";
import { recomputeSupportCommissionLedger } from "@/lib/supportCommission";
import { publishSummaryUpdate } from "@/lib/receiptSseBroker";
import { canonicalReceiptNumber } from "@/lib/receiptGuard";
import { cleanupMarketingReceipts, recalcSupportEntry } from "@/lib/marketingReceiptCleanup";
import { getOrCreateCommissionPeriod, computeSalesCommissionFromTiers } from "@/lib/commission";
import { summarizePosReceiptsForPeriod } from "@/lib/posReceiptSummary";
import { allocateSupportSellingShares, encodeSupportSaleProduct } from "@/lib/supportPricing";

export const dynamic = "force-dynamic";

type SupportPricePayload = {
  receiptItemId: string;
  buyingPrice: number;
  saveToCatalog?: boolean;
};

const SPECIAL_EMAIL = "jeniffer@betech.co.ke";

function normalizeLinkedProductId(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized || null;
}

function getLinkedReceiptPayloadItems(data: unknown) {
  if (!data || typeof data !== "object") return [] as Array<{ productId: string | null; isDeliveryFee: boolean }>;
  const rawItems = (data as { items?: unknown }).items;
  if (!Array.isArray(rawItems)) return [] as Array<{ productId: string | null; isDeliveryFee: boolean }>;
  return rawItems.map((item) => {
    const entry = item as Record<string, unknown>;
    return {
      productId:
        normalizeLinkedProductId(entry.productId) ??
        normalizeLinkedProductId((entry.product as Record<string, unknown> | undefined)?.id) ??
        normalizeLinkedProductId(entry.product),
      isDeliveryFee: Boolean(entry.isDeliveryFee),
    };
  });
}

async function resolveSupportReceiptItemCatalogProductId(
  receiptItem: {
    id: string;
    productName: string;
    receipt?: {
      receiptNumber?: string | null;
      items?: Array<{ id: string; createdAt: Date }> | null;
    } | null;
  },
) {
  const receipt = receiptItem.receipt;
  if (!receipt) return null;

  const orderedSupportItems = [...(receipt.items || [])].sort((left, right) => {
    const byCreatedAt = left.createdAt.getTime() - right.createdAt.getTime();
    if (byCreatedAt !== 0) return byCreatedAt;
    return left.id.localeCompare(right.id);
  });
  const supportItemIndex = orderedSupportItems.findIndex((item) => item.id === receiptItem.id);
  if (supportItemIndex < 0) return null;

  const receiptNumber = String(receipt.receiptNumber ?? "").trim();
  const canonicalReceipt = canonicalReceiptNumber(receiptNumber) ?? receiptNumber;
  const candidates = Array.from(new Set([receiptNumber, canonicalReceipt].filter(Boolean)));
  const resolveUniqueProductByName = async () => {
    const matchingProducts = await prisma.product.findMany({
      where: { name: { equals: receiptItem.productName.trim(), mode: "insensitive" } },
      select: { id: true },
      take: 2,
    });
    return matchingProducts.length === 1 ? matchingProducts[0].id : null;
  };
  if (!candidates.length) return resolveUniqueProductByName();

  const [linkedReceipt, linkedOrder] = await Promise.all([
    prisma.receipt.findFirst({
      where: {
        OR: [
          { receiptNumber: { in: candidates } },
          { order: { orderNumber: { in: candidates } } },
        ],
      },
      select: { data: true },
    }),
    prisma.order.findFirst({
      where: { orderNumber: { in: candidates } },
      select: {
        items: {
          orderBy: { id: "asc" },
          select: { productId: true },
        },
      },
    }),
  ]);

  const payloadItems = getLinkedReceiptPayloadItems(linkedReceipt?.data).filter((item) => !item.isDeliveryFee);
  const payloadProductId = payloadItems[supportItemIndex]?.productId ?? null;
  if (payloadProductId) return payloadProductId;

  const orderProductId = linkedOrder?.items?.[supportItemIndex]?.productId;
  if (orderProductId) return String(orderProductId).trim();

  return resolveUniqueProductByName();
}

export async function POST(req: Request) {
  const session = (await getServerSession(authOptions as any)) as any;
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = (session.user as { role?: string }).role;
  const email = (session.user as { email?: string }).email?.toLowerCase();
  const isBenjamin = isBenjaminSupervisorEmail(email);
  const allowPricing =
    role === "ADMIN" ||
    isBenjamin ||
    email === SPECIAL_EMAIL ||
    email === process.env.SUPPORT_PRICING_EMAIL?.toLowerCase();

  if (!allowPricing) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let payload: SupportPricePayload | null = null;
  try {
    payload = (await req.json()) as SupportPricePayload;
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  if (!payload?.receiptItemId || typeof payload.receiptItemId !== "string") {
    return NextResponse.json({ error: "receiptItemId is required" }, { status: 400 });
  }

  const parsedBuyingPrice = Number(payload.buyingPrice);
  if (!Number.isFinite(parsedBuyingPrice) || parsedBuyingPrice <= 0) {
    return NextResponse.json({ error: "buyingPrice must be a positive number" }, { status: 400 });
  }
  const roundedPrice = Math.round(parsedBuyingPrice);

  const receiptItem = await prisma.supportReceiptItem.findUnique({
    where: { id: payload.receiptItemId },
    include: {
      receipt: {
        include: {
          dailyEntry: true,
          items: true,
        },
      },
    },
  });

  if (!receiptItem || !receiptItem.receipt?.dailyEntry) {
    return NextResponse.json({ error: "Support receipt item not found" }, { status: 404 });
  }

  const saveToCatalog = Boolean(payload.saveToCatalog);
  const catalogProductId = saveToCatalog
    ? await resolveSupportReceiptItemCatalogProductId(receiptItem)
    : null;
  if (saveToCatalog && !catalogProductId) {
    return NextResponse.json(
      { error: "Catalog product not linked, buying price cannot be saved for future use." },
      { status: 400 },
    );
  }

  const entryId = receiptItem.receipt.dailyEntry.id;
  const previous = Number(receiptItem.buyingPrice ?? 0);
  const profitDelta = previous - roundedPrice; // negative when buying price increases (reduces profit)

  // derive a per-item selling value so callers (UI) can update quick-stats
  const receipt = receiptItem.receipt;
  const itemsCount = Math.max(1, (receipt.items || []).length);
  const sellingTotal = Number(receipt.sellingTotal ?? 0);
  const sellingPrice = Math.round(sellingTotal / itemsCount);
  const now = new Date();
  let finalEntryId = entryId;
  let submitterId = receiptItem.receipt.dailyEntry.submittedById ?? null;
  let finalizedPodOrderId: string | null = null;
  let finalizedPodAt: Date | null = null;
  let recognizedSaleValue = sellingPrice;

  await prisma.$transaction(async (tx) => {
    // update the receipt item
    await tx.supportReceiptItem.update({
      where: { id: receiptItem.id },
      data: { buyingPrice: roundedPrice, pricedAt: now },
    });

    if (saveToCatalog && catalogProductId) {
      await tx.product.update({
        where: { id: catalogProductId },
        data: {
          lastBuyingPrice: roundedPrice,
          variableCost: false,
        },
      });
    }

    const refreshedReceipt = await tx.supportReceipt.findUnique({
      where: { id: receipt.id },
      include: {
        items: true,
        dailyEntry: true,
      },
    });
    if (!refreshedReceipt?.dailyEntry) return;

    submitterId = refreshedReceipt.dailyEntry.submittedById ?? submitterId;
    const receiptBuyingTotal = (refreshedReceipt.items || []).reduce(
      (sum, item) => sum + Number(item.buyingPrice ?? 0),
      0,
    );
    const allItemsPriced =
      (refreshedReceipt.items || []).length > 0 &&
      refreshedReceipt.items.every((item) => Number(item.buyingPrice ?? 0) > 0);

    await tx.supportReceipt.update({
      where: { id: refreshedReceipt.id },
      data: { buyingTotal: receiptBuyingTotal },
    });

    const rawReceiptNumber = refreshedReceipt.receiptNumber ?? undefined;
    const canonicalReceipt = canonicalReceiptNumber(rawReceiptNumber) ?? rawReceiptNumber;
    const linkedReceipt = canonicalReceipt
      ? await tx.receipt.findFirst({
          where: {
            OR: [
              { receiptNumber: canonicalReceipt },
              { order: { orderNumber: canonicalReceipt } },
              { order: { orderNumber: refreshedReceipt.receiptNumber ?? undefined } },
            ],
          },
          include: { order: true },
        })
      : null;
    const linkedData =
      linkedReceipt?.data && typeof linkedReceipt.data === "object"
        ? (linkedReceipt.data as Record<string, any>)
        : {};
    const linkedReceiptItems = Array.isArray(linkedData.items) ? linkedData.items as Array<Record<string, unknown>> : [];
    const linkedPod = linkedData?.podDelivery && typeof linkedData.podDelivery === "object"
      ? (linkedData.podDelivery as Record<string, any>)
      : null;
    const isDeliveredPod = Boolean(
      linkedReceipt?.orderId &&
      linkedPod?.status &&
      String(linkedPod.status).toLowerCase() === "delivered",
    );
    const updateLinkedReceiptTotals = async (extraData: Record<string, any> = {}) => {
      if (!linkedReceipt) return;
      const existingTotals =
        linkedReceipt.totals && typeof linkedReceipt.totals === "object"
          ? (linkedReceipt.totals as Record<string, any>)
          : {};
      const total = Number(existingTotals.total ?? linkedReceipt.order?.totalAmount ?? refreshedReceipt.sellingTotal ?? 0);
      const nextTotals = {
        ...existingTotals,
        buyingTotal: receiptBuyingTotal,
        profit: receiptBuyingTotal > 0 ? total - receiptBuyingTotal : 0,
        needsPricing: !allItemsPriced,
      };
      await tx.receipt.update({
        where: { id: linkedReceipt.id },
        data: {
          totals: nextTotals as any,
          data: {
            ...linkedData,
            totals: nextTotals,
            needsPricing: !allItemsPriced,
            ...(Object.keys(extraData).length ? extraData : {}),
          } as any,
        },
      });
    };

    const sellingShares = allocateSupportSellingShares(linkedReceiptItems, refreshedReceipt.items);
    const productLabel = encodeSupportSaleProduct(receiptItem.productName ?? "Item", receiptItem.id);
    const itemSellingPrice = Math.max(0, Math.round(Number(sellingShares.get(receiptItem.id) ?? sellingPrice)));
    recognizedSaleValue = itemSellingPrice;
    const entryIdsToRecalc = new Set<string>([entryId]);

    if (submitterId && itemSellingPrice > 0) {
      const startOfToday = new Date(now);
      startOfToday.setHours(0, 0, 0, 0);
      const endOfToday = new Date(now);
      endOfToday.setHours(23, 59, 59, 999);
      const dayOfWeek = now.toLocaleDateString("en-KE", { weekday: "long" });

      const pricingEntry =
        await tx.supportDailyEntry.findFirst({
          where: { submittedById: submitterId, date: { gte: startOfToday, lte: endOfToday } },
          select: { id: true },
        }) ??
        await tx.supportDailyEntry.create({
          data: {
            date: now,
            dayOfWeek,
            totalSales: 0,
            totalProfit: 0,
            newBatteries: 0,
            changedBatteries: 0,
            submittedById: submitterId,
          },
          select: { id: true },
        });

      const existingSale = await tx.supportSale.findFirst({
        where: { product: productLabel },
        select: { id: true, entryId: true },
      });

      entryIdsToRecalc.add(pricingEntry.id);
      if (existingSale?.entryId) {
        entryIdsToRecalc.add(existingSale.entryId);
      }

      if (existingSale) {
        await tx.supportSale.update({
          where: { id: existingSale.id },
          data: {
            entryId: pricingEntry.id,
            product: productLabel,
            buyingPrice: roundedPrice,
            sellingPrice: itemSellingPrice,
            receiptNumber: canonicalReceipt ?? refreshedReceipt.receiptNumber ?? null,
            paymentMethod: refreshedReceipt.paymentMethod,
            itemsCount: 1,
            createdAt: now,
          },
        });
      } else {
        await tx.supportSale.create({
          data: {
            entryId: pricingEntry.id,
            product: productLabel,
            buyingPrice: roundedPrice,
            sellingPrice: itemSellingPrice,
            receiptNumber: canonicalReceipt ?? refreshedReceipt.receiptNumber ?? null,
            paymentMethod: refreshedReceipt.paymentMethod,
            itemsCount: 1,
            createdAt: now,
          },
        });
      }
    }

    if (isDeliveredPod && allItemsPriced && submitterId) {
      const startOfToday = new Date(now);
      startOfToday.setHours(0, 0, 0, 0);
      const endOfToday = new Date(now);
      endOfToday.setHours(23, 59, 59, 999);
      const dayOfWeek = String(now.getDay());
      const oldEntryId = refreshedReceipt.dailyEntryId;

      const todayEntry =
        await tx.supportDailyEntry.findFirst({
          where: { submittedById: submitterId, date: { gte: startOfToday, lte: endOfToday } },
          select: { id: true },
        }) ??
        await tx.supportDailyEntry.create({
          data: {
            date: now,
            dayOfWeek,
            totalSales: 0,
            totalProfit: 0,
            newBatteries: 0,
            changedBatteries: 0,
            submittedById: submitterId,
          },
          select: { id: true },
        });

      finalEntryId = todayEntry.id;
      finalizedPodOrderId = linkedReceipt?.orderId ?? null;
      finalizedPodAt = now;

      await tx.supportReceipt.update({
        where: { id: refreshedReceipt.id },
        data: {
          dailyEntryId: todayEntry.id,
          buyingTotal: receiptBuyingTotal,
          createdAt: now,
        },
      });

      if (canonicalReceipt) {
        await cleanupMarketingReceipts(tx, canonicalReceipt);
      }

      await recalcSupportEntry(tx as any, oldEntryId);
      if (todayEntry.id !== oldEntryId) {
        await recalcSupportEntry(tx as any, todayEntry.id);
      }
      entryIdsToRecalc.delete(oldEntryId);
      entryIdsToRecalc.delete(todayEntry.id);

      await updateLinkedReceiptTotals({
        podDelivery: {
          ...linkedPod,
          pricedAt: now.toISOString(),
          financialFinalizedAt: now.toISOString(),
        },
      });
    } else if (isDeliveredPod) {
      await updateLinkedReceiptTotals({
        podDelivery: {
          ...linkedPod,
          pricedAt: now.toISOString(),
        },
      });
      await tx.supportDailyEntry.update({
        where: { id: entryId },
        data: { totalProfit: 0 },
      });
      entryIdsToRecalc.delete(entryId);
    } else {
      await updateLinkedReceiptTotals();
    }

    for (const targetEntryId of entryIdsToRecalc) {
      await recalcSupportEntry(tx as any, targetEntryId);
    }
  });

  if (submitterId) {
    try {
      const period = getTradingPeriodFor(finalizedPodAt ?? new Date(receiptItem.receipt.dailyEntry.date));
      await recomputeSupportCommissionLedger({ userId: submitterId, period });
    } catch (ledgerErr) {
      console.error("[support/price-sale] failed to recompute commission ledger", ledgerErr);
    }
  }

  if (submitterId && finalizedPodOrderId && finalizedPodAt) {
    try {
      const { period, tiers } = await getOrCreateCommissionPeriod(finalizedPodAt);
      const posSummary = await summarizePosReceiptsForPeriod({
        start: period.startDate,
        end: period.endDate,
        userId: submitterId,
      });
      const fallbackPercent = posSummary.totalProfit > 0 ? 0.05 : 0;
      const salesCommission = computeSalesCommissionFromTiers(
        posSummary.totalSales,
        posSummary.totalProfit,
        tiers as any,
        fallbackPercent,
      );

      await prisma.commissionRecord.updateMany({
        where: { orderId: finalizedPodOrderId },
        data: {
          amount: String(salesCommission),
          status: "RELEASED",
          releasedAt: finalizedPodAt,
          periodId: period.id,
        },
      });
      await prisma.commissionEarning.updateMany({
        where: { orderItem: { orderId: finalizedPodOrderId } as any, status: "PENDING" },
        data: { status: "RELEASED" },
      });
    } catch (releaseErr) {
      console.error("[support/price-sale] failed to finalize POD commission state", releaseErr);
    }
  }

  // Notify admin summary subscribers that support receipt pricing changed
  try {
    publishSummaryUpdate({ attendantId: submitterId ?? null, timestamp: new Date().toISOString() });
  } catch (e) {
    console.warn("[support/price-sale] failed to publish summary update", e);
  }

  return NextResponse.json({
    ok: true,
    entryId: finalEntryId,
    profitDelta,
    saleValue: recognizedSaleValue,
    receiptTotal: sellingTotal,
    paymentMethod: receipt.paymentMethod ?? null,
    catalogProductId,
    catalogUpdated: Boolean(saveToCatalog && catalogProductId),
  });
}
