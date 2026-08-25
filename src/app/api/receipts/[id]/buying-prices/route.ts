import { NextRequest, NextResponse } from "next/server";
import { getActorId, requireRole } from "@/lib/api";
import { canonicalReceiptNumber } from "@/lib/receiptGuard";
import { recalcMarketingEntry, recalcSupportEntry } from "@/lib/marketingReceiptCleanup";
import { prisma } from "@/lib/prisma";
import { recomputeOrderEconomics } from "@/lib/recomputeOrderEconomics";

type ParamsContext = { params: { id: string } } | { params: Promise<{ id: string }> };

type BuyingPriceInput = {
  orderItemId?: unknown;
  buyingPrice?: unknown;
};

const normalizeName = (value: string | null | undefined) =>
  String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

async function resolveParams(context: ParamsContext) {
  return await context.params;
}

export async function PATCH(request: NextRequest, context: ParamsContext) {
  const guard = await requireRole(["ADMIN", "SUPERVISOR"]);
  if (!guard.ok) return guard.res;

  const { id } = await resolveParams(context);
  const actorId = (await getActorId()) ?? "system";
  const body = (await request.json().catch(() => null)) as {
    mode?: unknown;
    buyingTotal?: unknown;
    items?: BuyingPriceInput[];
  } | null;
  const mode = String(body?.mode ?? "ITEMS").trim().toUpperCase() === "TOTAL" ? "TOTAL" : "ITEMS";
  const requestedBuyingTotal = Number(body?.buyingTotal);
  const requestedItems = Array.isArray(body?.items) ? body.items : [];

  if (mode === "TOTAL" && (!Number.isFinite(requestedBuyingTotal) || requestedBuyingTotal <= 0)) {
    return NextResponse.json({ error: "Provide a valid total buying price greater than zero" }, { status: 400 });
  }
  if (mode === "ITEMS" && (!requestedItems.length || requestedItems.length > 100)) {
    return NextResponse.json({ error: "Provide between 1 and 100 receipt items" }, { status: 400 });
  }

  const updates = requestedItems.map((item) => ({
    orderItemId: String(item.orderItemId ?? "").trim(),
    buyingPrice: Number(item.buyingPrice),
  }));
  const invalid = updates.some(
    (item) => !item.orderItemId || !Number.isFinite(item.buyingPrice) || item.buyingPrice < 0,
  );
  const duplicateIds = new Set(updates.map((item) => item.orderItemId)).size !== updates.length;
  if (mode === "ITEMS" && (invalid || duplicateIds)) {
    return NextResponse.json({ error: "Each item needs a unique valid buying price" }, { status: 400 });
  }

  const receipt = await prisma.receipt.findUnique({
    where: { id },
    include: {
      order: {
        include: {
          items: {
            include: {
              product: { select: { name: true } },
              orderCosts: { orderBy: { createdAt: "desc" }, take: 1, select: { unitCost: true } },
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
  const orderItemIds = new Set(orderItems.map((item) => item.id));
  if (mode === "ITEMS" && updates.some((item) => !orderItemIds.has(item.orderItemId))) {
    return NextResponse.json({ error: "One or more items do not belong to this receipt" }, { status: 400 });
  }

  const updateMap = new Map(updates.map((item) => [item.orderItemId, item.buyingPrice]));
  const resolvedCosts = new Map(
    orderItems.map((item) => [
      item.id,
      updateMap.get(item.id) ?? Math.max(0, Number(item.orderCosts[0]?.unitCost ?? 0)),
    ]),
  );
  const buyingTotal = orderItems.reduce(
    (sum, item) => sum + (resolvedCosts.get(item.id) ?? 0) * Math.max(1, Number(item.quantity ?? 1)),
    0,
  );
  const orderNumber = receipt.order.orderNumber ?? "";
  const normalizedOrderNumber = canonicalReceiptNumber(orderNumber);
  const receiptKeys = Array.from(new Set([orderNumber, normalizedOrderNumber].filter(Boolean)));
  const costByName = new Map<string, number>();
  for (const item of orderItems) {
    const name = normalizeName(item.product?.name);
    if (name) costByName.set(name, resolvedCosts.get(item.id) ?? 0);
  }
  const singleItemCost = orderItems.length === 1 ? resolvedCosts.get(orderItems[0].id) ?? 0 : null;

  if (mode === "TOTAL") {
    const buyingTotal = Math.round(requestedBuyingTotal);
    const previousTotals =
      receipt.totals && typeof receipt.totals === "object" && !Array.isArray(receipt.totals)
        ? (receipt.totals as Record<string, unknown>)
        : {};
    const previousData =
      receipt.data && typeof receipt.data === "object" && !Array.isArray(receipt.data)
        ? (receipt.data as Record<string, unknown>)
        : {};
    const total = Number(previousTotals.total ?? receipt.order.totalAmount ?? 0);
    const commission = Math.max(0, Number(previousTotals.posCommission ?? 0));
    const profit = total - buyingTotal - commission;
    const nextTotals = {
      ...previousTotals,
      buyingTotal,
      buyingPriceMode: "TOTAL",
      profit,
    };
    const nextData = {
      ...previousData,
      buyingPriceMode: "TOTAL",
      buyingPriceUpdatedAt: new Date().toISOString(),
      buyingPriceUpdatedById: actorId,
      totals: nextTotals,
    };

    await prisma.$transaction(async (tx) => {
      await tx.receipt.update({
        where: { id },
        data: { totals: nextTotals, data: nextData },
      });

      if (receiptKeys.length) {
        const supportReceipts = await tx.supportReceipt.findMany({
          where: {
            OR: [
              ...receiptKeys.map((value) => ({ receiptNumber: value })),
              ...receiptKeys.map((value) => ({ receiptKey: value })),
            ],
          },
        });
        for (const supportReceipt of supportReceipts) {
          await tx.supportReceipt.update({ where: { id: supportReceipt.id }, data: { buyingTotal } });
          if (supportReceipt.dailyEntryId) await recalcSupportEntry(tx, supportReceipt.dailyEntryId);
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
          await tx.marketingReceipt.update({ where: { id: marketingReceipt.id }, data: { buyingTotal } });
          if (marketingReceipt.dailyEntryId) await recalcMarketingEntry(tx, marketingReceipt.dailyEntryId);
        }
      }

      await tx.actionLog.create({
        data: {
          actorId,
          entity: "Receipt",
          entityId: id,
          action: "UPDATE_TOTAL_BUYING_PRICE",
          before: { buyingTotal: Number(previousTotals.buyingTotal ?? 0), mode: previousTotals.buyingPriceMode ?? null },
          after: { buyingTotal, mode: "TOTAL" },
        },
      });
    });

    return NextResponse.json({ ok: true, mode, updatedItems: 0, buyingTotal, profit });
  }

  await prisma.$transaction(async (tx) => {
    const previousTotals =
      receipt.totals && typeof receipt.totals === "object" && !Array.isArray(receipt.totals)
        ? (receipt.totals as Record<string, unknown>)
        : {};
    const previousData =
      receipt.data && typeof receipt.data === "object" && !Array.isArray(receipt.data)
        ? (receipt.data as Record<string, unknown>)
        : {};
    const nextTotals = { ...previousTotals, buyingPriceMode: "ITEMS" };
    await tx.receipt.update({
      where: { id },
      data: {
        totals: nextTotals,
        data: { ...previousData, buyingPriceMode: "ITEMS", totals: nextTotals },
      },
    });
    for (const item of updates) {
      await tx.orderCost.create({
        data: {
          orderItemId: item.orderItemId,
          unitCost: item.buyingPrice,
          costSource: `ADMIN_RECEIPT_BUYING_PRICE:${actorId}`,
        },
      });
    }

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

      for (const supportReceipt of supportReceipts) {
        for (const supportItem of supportReceipt.items) {
          const matchedCost = costByName.get(normalizeName(supportItem.productName)) ?? singleItemCost;
          if (matchedCost === null || matchedCost === undefined) continue;
          await tx.supportReceiptItem.update({
            where: { id: supportItem.id },
            data: { buyingPrice: Math.round(matchedCost), pricedAt: new Date() },
          });
        }
        await tx.supportReceipt.update({
          where: { id: supportReceipt.id },
          data: { buyingTotal: Math.round(buyingTotal) },
        });
        if (supportReceipt.dailyEntryId) await recalcSupportEntry(tx, supportReceipt.dailyEntryId);
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
        await tx.marketingReceipt.update({
          where: { id: marketingReceipt.id },
          data: { buyingTotal: Math.round(buyingTotal) },
        });
        if (marketingReceipt.dailyEntryId) await recalcMarketingEntry(tx, marketingReceipt.dailyEntryId);
      }
    }

    await tx.actionLog.create({
      data: {
        actorId,
        entity: "Receipt",
        entityId: id,
        action: "UPDATE_BUYING_PRICES",
        before: orderItems.map((item) => ({
          orderItemId: item.id,
          buyingPrice: Number(item.orderCosts[0]?.unitCost ?? 0),
        })),
        after: updates,
      },
    });
  });

  await recomputeOrderEconomics(receipt.orderId);

  const refreshed = await prisma.receipt.findUnique({ where: { id }, select: { totals: true, data: true } });
  const totals = (refreshed?.totals as Record<string, unknown> | null) ?? {};
  const dataTotals =
    ((refreshed?.data as Record<string, unknown> | null)?.totals as Record<string, unknown> | undefined) ?? {};

  return NextResponse.json({
    ok: true,
    updatedItems: updates.length,
    buyingTotal: Number(totals.buyingTotal ?? dataTotals.buyingTotal ?? buyingTotal),
    profit: Number(totals.profit ?? dataTotals.profit ?? 0),
  });
}
