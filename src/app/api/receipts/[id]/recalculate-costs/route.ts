import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActorId, requireRole } from "@/lib/api";
import { canonicalReceiptNumber } from "@/lib/receiptGuard";
import { recalcMarketingEntry, recalcSupportEntry } from "@/lib/marketingReceiptCleanup";
import { recomputeOrderEconomics } from "@/lib/recomputeOrderEconomics";

type ParamsContext = { params: { id: string } } | { params: Promise<{ id: string }> };

function resolveParams(context: ParamsContext): Promise<{ id: string }> {
  const maybePromise = (context as { params?: Promise<{ id: string }> }).params;
  if (maybePromise && typeof (maybePromise as Promise<{ id: string }>).then === "function") {
    return maybePromise as Promise<{ id: string }>;
  }
  return Promise.resolve((context as { params: { id: string } }).params);
}

function normalizeName(value: string | null | undefined) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function POST(_req: NextRequest, context: ParamsContext) {
  const guard = await requireRole(["ADMIN", "SUPERVISOR"]);
  if (!guard.ok) return guard.res;

  const actorId = (await getActorId()) ?? "system";
  const { id } = await resolveParams(context);

  const receipt = await prisma.receipt.findUnique({
    where: { id },
    include: {
      order: {
        include: {
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  lastBuyingPrice: true,
                },
              },
              orderCosts: {
                orderBy: { createdAt: "desc" },
                take: 1,
                select: { unitCost: true },
              },
            },
          },
        },
      },
    },
  });

  if (!receipt?.order) {
    return NextResponse.json({ error: "Receipt order not found" }, { status: 404 });
  }

  const orderItems = receipt.order.items ?? [];
  if (!orderItems.length) {
    return NextResponse.json({ error: "Receipt has no order items" }, { status: 400 });
  }

  const recalculated = await prisma.$transaction(async (tx) => {
    let updatedItems = 0;
    const itemCosts = new Map<string, number>();

    for (const item of orderItems) {
      const latestProductCost = Number(item.product?.lastBuyingPrice ?? 0);
      const fallbackExistingCost = Number(item.orderCosts?.[0]?.unitCost ?? 0);
      const nextUnitCost =
        Number.isFinite(latestProductCost) && latestProductCost > 0
          ? latestProductCost
          : Number.isFinite(fallbackExistingCost) && fallbackExistingCost > 0
            ? fallbackExistingCost
            : 0;

      if (!(nextUnitCost > 0)) continue;

      await tx.orderCost.create({
        data: {
          orderItemId: item.id,
          unitCost: nextUnitCost,
          costSource: `receipt_recalculate:${actorId}`,
        },
      });
      updatedItems += 1;
      itemCosts.set(item.id, nextUnitCost);
    }

    const orderNumber = receipt.order?.orderNumber ?? "";
    const normalizedOrderNumber = canonicalReceiptNumber(orderNumber);
    const receiptKeys = Array.from(new Set([orderNumber, normalizedOrderNumber].filter(Boolean)));

    if (receiptKeys.length) {
      const supportReceipts = await tx.supportReceipt.findMany({
        where: {
          OR: [
            ...receiptKeys.map((value) => ({ receiptNumber: value })),
            ...receiptKeys.map((value) => ({ receiptKey: value })),
          ],
        },
        include: { items: true },
      });

      const itemNameCostMap = new Map<string, number>();
      for (const item of orderItems) {
        const cost = itemCosts.get(item.id);
        if (!(cost && cost > 0)) continue;
        const productNameKey = normalizeName(item.product?.name);
        if (productNameKey) itemNameCostMap.set(productNameKey, cost);
      }

      const singleItemCost =
        itemCosts.size === 1 ? Array.from(itemCosts.values())[0] ?? 0 : 0;

      for (const supportReceipt of supportReceipts) {
        let computedBuyingTotal = 0;
        for (const supportItem of supportReceipt.items) {
          const byName = itemNameCostMap.get(normalizeName(supportItem.productName));
          const nextBuyingPrice =
            byName && byName > 0
              ? byName
              : singleItemCost > 0
                ? singleItemCost
                : Number(supportItem.buyingPrice ?? 0);
          const safeBuyingPrice = Math.max(0, Math.round(nextBuyingPrice || 0));
          computedBuyingTotal += safeBuyingPrice;
          if (safeBuyingPrice > 0 && safeBuyingPrice !== Number(supportItem.buyingPrice ?? 0)) {
            await tx.supportReceiptItem.update({
              where: { id: supportItem.id },
              data: {
                buyingPrice: safeBuyingPrice,
                pricedAt: new Date(),
              },
            });
          }
        }

        await tx.supportReceipt.update({
          where: { id: supportReceipt.id },
          data: { buyingTotal: computedBuyingTotal },
        });
        if (supportReceipt.dailyEntryId) {
          await recalcSupportEntry(tx, supportReceipt.dailyEntryId);
        }
      }

      const marketingReceipts = await tx.marketingReceipt.findMany({
        where: {
          OR: [
            ...receiptKeys.map((value) => ({ receiptNumber: value })),
            ...receiptKeys.map((value) => ({ receiptKey: value })),
          ],
        },
      });

      for (const marketingReceipt of marketingReceipts) {
        if (marketingReceipt.dailyEntryId) {
          await recalcMarketingEntry(tx, marketingReceipt.dailyEntryId);
        }
      }
    }

    return { updatedItems };
  });

  await recomputeOrderEconomics(receipt.orderId);

  const refreshedReceipt = await prisma.receipt.findUnique({
    where: { id },
    select: {
      totals: true,
      data: true,
    },
  });

  const refreshedTotals = ((refreshedReceipt?.totals as Record<string, unknown> | null) ?? {}) as Record<
    string,
    unknown
  >;
  const refreshedDataTotals =
    ((refreshedReceipt?.data as Record<string, unknown> | null)?.totals as Record<string, unknown> | undefined) ?? {};
  const buyingTotal = Number(refreshedTotals.buyingTotal ?? refreshedDataTotals.buyingTotal ?? 0);
  const profit = Number(refreshedTotals.profit ?? refreshedDataTotals.profit ?? 0);

  return NextResponse.json({
    ok: true,
    updatedItems: recalculated.updatedItems,
    buyingTotal,
    profit,
  });
}
