import { PaymentMethod, Prisma } from "@prisma/client";
import { getReceiptProjectCompletionDate, type ReceiptProjectFlow } from "@/lib/receiptProjects";
import { buildReceiptKey, canonicalReceiptNumber, parsePaymentMethod } from "@/lib/receipts/utils";
import { isDeliveryFeePayloadItem } from "@/lib/supportPricing";
import { recalcSupportEntry } from "@/lib/marketingReceiptCleanup";

type ProjectReceiptForPricingSync = {
  id: string;
  createdAt: Date;
  receiptNumber?: string | null;
  issuedById?: string | null;
  totals?: Prisma.JsonValue | null;
  data?: Prisma.JsonValue | null;
  order?: {
    orderNumber?: string | null;
    totalAmount?: number | null;
    attendantId?: string | null;
  } | null;
};

type SupportReceiptSeedItem = {
  productName: string;
  buyingPrice: number | null;
};

function extractSupportReceiptItems(data: Record<string, unknown>) {
  const rawItems = data.items;
  if (!Array.isArray(rawItems)) return [] as SupportReceiptSeedItem[];

  return rawItems
    .map((item) => {
      const entry = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
      const productName = String(
        entry.title ??
          entry.productName ??
          entry.name ??
          ((entry.product as Record<string, unknown> | undefined)?.name ?? ""),
      ).trim();
      if (!productName || isDeliveryFeePayloadItem(entry)) return null;
      const quantity = Math.max(1, Math.trunc(Number(entry.quantity ?? 1) || 1));
      const unitBuyingPrice = Number(entry.costPrice ?? entry.buyingPrice ?? 0);
      const buyingPrice = Number.isFinite(unitBuyingPrice) && unitBuyingPrice > 0
        ? Math.max(0, Math.round(unitBuyingPrice * quantity))
        : null;
      return { productName, buyingPrice };
    })
    .filter((item): item is SupportReceiptSeedItem => Boolean(item));
}

export async function syncCompletedProjectReceiptToPricing(
  tx: Prisma.TransactionClient,
  receipt: ProjectReceiptForPricingSync,
  projectFlow: ReceiptProjectFlow,
) {
  const receiptData =
    receipt.data && typeof receipt.data === "object" && !Array.isArray(receipt.data)
      ? (receipt.data as Record<string, unknown>)
      : {};
  const attendantId = String(receipt.order?.attendantId ?? receipt.issuedById ?? "").trim() || null;
  const rawReceiptNumber = String(receipt.order?.orderNumber ?? receipt.receiptNumber ?? "").trim();
  const normalizedReceiptNumber = canonicalReceiptNumber(rawReceiptNumber);
  const completionDate = getReceiptProjectCompletionDate(projectFlow, projectFlow.updatedAt, receipt.createdAt);

  if (!attendantId || !normalizedReceiptNumber || !completionDate) {
    return { ok: false as const, reason: "missing-sync-primitives" };
  }

  const dayStart = new Date(completionDate);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(completionDate);
  dayEnd.setHours(23, 59, 59, 999);
  const dayOfWeek = completionDate.toLocaleDateString("en-KE", { weekday: "long" });
  const sellingTotal = Math.max(
    0,
    Math.round(
      Number(
        ((receipt.totals as Record<string, unknown> | null)?.total as number | undefined) ??
          receipt.order?.totalAmount ??
          0,
      ),
    ),
  );
  const receiptItems = extractSupportReceiptItems(receiptData);
  const derivedBuyingTotal = receiptItems.reduce((sum, item) => sum + Number(item.buyingPrice ?? 0), 0);
  const receiptKey = buildReceiptKey(completionDate, normalizedReceiptNumber);
  const paymentMethod = parsePaymentMethod(
    receiptData.paymentMethod,
    PaymentMethod,
  );

  const supportEntry =
    await tx.supportDailyEntry.findFirst({
      where: { submittedById: attendantId, date: { gte: dayStart, lte: dayEnd } },
      select: { id: true },
    }) ??
    (await tx.supportDailyEntry.create({
      data: {
        date: dayStart,
        dayOfWeek,
        totalSales: 0,
        totalProfit: 0,
        newBatteries: 0,
        changedBatteries: 0,
        submittedById: attendantId,
      },
      select: { id: true },
    }));

  const existingSupportReceipt = await tx.supportReceipt.findFirst({
    where: {
      OR: [
        { receiptNumber: normalizedReceiptNumber },
        ...(receiptKey ? [{ receiptKey }] : []),
      ],
    },
    include: {
      items: true,
    },
  });

  if (existingSupportReceipt) {
    const nextBuyingTotal =
      derivedBuyingTotal > 0 || (existingSupportReceipt.items?.length ?? 0) === 0
        ? derivedBuyingTotal
        : Number(existingSupportReceipt.buyingTotal ?? 0);
    const shouldSeedItems = (existingSupportReceipt.items?.length ?? 0) === 0 && receiptItems.length > 0;
    if (shouldSeedItems) {
      await tx.supportReceiptItem.deleteMany({ where: { receiptId: existingSupportReceipt.id } });
    }
    await tx.supportReceipt.update({
      where: { id: existingSupportReceipt.id },
      data: {
        dailyEntryId: supportEntry.id,
        receiptNumber: normalizedReceiptNumber,
        receiptKey,
        paymentMethod: existingSupportReceipt.paymentMethod ?? paymentMethod,
        sellingTotal,
        buyingTotal: nextBuyingTotal,
        ...(shouldSeedItems ? { items: { create: receiptItems } } : {}),
      },
    });
    await recalcSupportEntry(tx, supportEntry.id);
    if (existingSupportReceipt.dailyEntryId !== supportEntry.id) {
      await recalcSupportEntry(tx, existingSupportReceipt.dailyEntryId);
    }
    return {
      ok: true as const,
      action: "updated" as const,
      receiptNumber: normalizedReceiptNumber,
      completionDate: completionDate.toISOString(),
      supportEntryId: supportEntry.id,
    };
  }

  await tx.supportReceipt.create({
    data: {
      dailyEntryId: supportEntry.id,
      receiptNumber: normalizedReceiptNumber,
      receiptKey,
      paymentMethod,
      sellingTotal,
      buyingTotal: derivedBuyingTotal,
      ...(receiptItems.length ? { items: { create: receiptItems } } : {}),
    },
  });
  await recalcSupportEntry(tx, supportEntry.id);
  return {
    ok: true as const,
    action: "created" as const,
    receiptNumber: normalizedReceiptNumber,
    completionDate: completionDate.toISOString(),
    supportEntryId: supportEntry.id,
  };
}
