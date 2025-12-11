import { Prisma } from "@prisma/client";
import { canonicalReceiptNumber } from "@/lib/receiptGuard";

type EntryTotals = {
  entryId: string;
  totalSales: number;
  totalProfit: number;
};

const recalcMarketingEntry = async (tx: Prisma.TransactionClient, entryId: string) => {
  const entryWithReceipts = await tx.marketingDailyEntry.findUnique({
    where: { id: entryId },
    include: { receipts: { include: { items: true } } },
  });
  if (!entryWithReceipts) return null;
  const totalSales = entryWithReceipts.receipts.reduce((sum, r) => sum + Number(r.sellingTotal ?? 0), 0);
  const totalProfit = entryWithReceipts.receipts.reduce((sum, r) => {
    const buying = (r.items ?? []).reduce((inner, it) => inner + Number(it.buyingPrice ?? 0), 0);
    return sum + (Number(r.sellingTotal ?? 0) - buying);
  }, 0);
  await tx.marketingDailyEntry.update({
    where: { id: entryId },
    data: { totalSales, totalProfit },
  });
  return { entryId, totalSales, totalProfit };
};

const recalcSupportEntry = async (tx: Prisma.TransactionClient, entryId: string) => {
  const entryReceipts = await tx.supportReceipt.findMany({
    where: { dailyEntryId: entryId },
    include: { items: true },
  });
  const totalSales = entryReceipts.reduce((sum, r) => sum + Number(r.sellingTotal ?? 0), 0);
  const totalProfit = entryReceipts.reduce((sum, r) => {
    const buying = (r.items ?? []).reduce((inner, it) => inner + Number(it.buyingPrice ?? 0), 0);
    return sum + (Number(r.sellingTotal ?? 0) - buying);
  }, 0);
  await tx.supportDailyEntry.update({
    where: { id: entryId },
    data: { totalSales, totalProfit },
  });
  return { entryId, totalSales, totalProfit };
};

export async function cleanupMarketingReceipts(
  tx: Prisma.TransactionClient,
  receiptNumber?: string,
  receiptId?: string,
): Promise<EntryTotals[]> {
  const normalized = canonicalReceiptNumber(receiptNumber ?? "");
  const where = normalized
    ? { receiptNumber: normalized }
    : receiptId
      ? { id: receiptId }
      : null;
  if (!where) return [];

  const receipts = await tx.marketingReceipt.findMany({
    where,
    include: { items: true },
  });
  if (!receipts.length) return [];

  const entryMap = new Map<string, { receiptIds: string[] }>();
  for (const receipt of receipts) {
    if (!receipt.dailyEntryId) continue;
    const group = entryMap.get(receipt.dailyEntryId) ?? { receiptIds: [] };
    group.receiptIds.push(receipt.id);
    entryMap.set(receipt.dailyEntryId, group);
  }

  const deletedReceiptIds = receipts.map((r) => r.id);
  await tx.marketingReceiptItem.deleteMany({ where: { receiptId: { in: deletedReceiptIds } } });
  await tx.marketingReceipt.deleteMany({ where: { id: { in: deletedReceiptIds } } });

  const result: EntryTotals[] = [];
  for (const [entryId] of entryMap) {
    const totals = await recalcMarketingEntry(tx, entryId);
    if (totals) result.push(totals);
  }

  return result;
}

export async function cleanupSupportReceipts(
  tx: Prisma.TransactionClient,
  receiptNumber?: string,
  receiptId?: string,
): Promise<EntryTotals[]> {
  const normalized = canonicalReceiptNumber(receiptNumber ?? "");
  const where = normalized
    ? { receiptNumber: normalized }
    : receiptId
      ? { id: receiptId }
      : null;
  if (!where) return [];

  const receipts = await tx.supportReceipt.findMany({
    where,
    include: { items: true },
  });
  if (!receipts.length) return [];

  const entryGroups = new Map<string, string[]>();
  const receiptIds = receipts.map((r) => r.id);
  for (const receipt of receipts) {
    if (!receipt.dailyEntryId) continue;
    const group = entryGroups.get(receipt.dailyEntryId) ?? [];
    group.push(receipt.id);
    entryGroups.set(receipt.dailyEntryId, group);
  }

  await tx.supportReceiptItem.deleteMany({ where: { receiptId: { in: receiptIds } } });
  await tx.supportReceipt.deleteMany({ where: { id: { in: receiptIds } } });

  const result: EntryTotals[] = [];
  for (const [entryId] of entryGroups) {
    const totals = await recalcSupportEntry(tx, entryId);
    if (totals) result.push(totals);
  }

  return result;
}

export async function deleteReceiptOrderCascade(tx: Prisma.TransactionClient, receiptNumber: string): Promise<boolean> {
  const normalized = canonicalReceiptNumber(receiptNumber);
  if (!normalized) return false;
  const order = await tx.order.findUnique({
    where: { orderNumber: normalized },
    include: {
      receipt: true,
      items: true,
      layawayPlan: true,
    },
  });
  if (!order) return false;
  const receipt = order.receipt;
  if (!receipt) return false;

  await cleanupMarketingReceipts(tx, normalized);
  await cleanupSupportReceipts(tx, normalized);

  const itemIds = (order.items || []).map((item) => item.id);
  if (itemIds.length) {
    await tx.commissionEarning.deleteMany({ where: { orderItemId: { in: itemIds } } });
  }
  await tx.commissionRecord.deleteMany({ where: { orderId: order.id } });
  await tx.returnAdjustment.deleteMany({ where: { returnCase: { orderId: order.id } } });
  await tx.returnCase.deleteMany({ where: { orderId: order.id } });
  await tx.settlementRow.deleteMany({ where: { orderId: order.id } });
  if (order.layawayPlan) {
    await tx.layawayPlan.delete({ where: { id: order.layawayPlan.id } });
  }
  await tx.orderItem.deleteMany({ where: { orderId: order.id } });
  await tx.receipt.delete({ where: { id: receipt.id } });
  await tx.order.delete({ where: { id: order.id } });
  return true;
}
