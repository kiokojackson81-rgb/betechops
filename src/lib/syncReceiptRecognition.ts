import type { Prisma } from "@prisma/client";
import { getReceiptRecognitionDate, recognitionDay } from "@/lib/receiptRecognition";
import { attachReceiptPricingEvidence } from "@/lib/receiptRecognitionData";
import { recalcMarketingEntry, recalcSupportEntry } from "@/lib/marketingReceiptCleanup";
import { canonicalReceiptNumber } from "@/lib/receiptGuard";
import { getTradingPeriodFor } from "@/lib/tradingPeriod";
import { recomputeSupportCommissionLedger } from "@/lib/supportCommission";
import { recomputeMarketingCommissionLedger } from "@/lib/marketingPeriodTotals";

export type RecognitionLedgerTarget = { userId: string; date: Date };
export { recognitionDay } from "@/lib/receiptRecognition";

/** Called in the pricing transaction: move linked ledger rows, never the receipt creation timestamp. */
export async function syncReceiptRecognition(tx: Prisma.TransactionClient, receiptId: string): Promise<RecognitionLedgerTarget[]> {
  const receipt = await tx.receipt.findUnique({ where: { id: receiptId }, include: { order: { include: { items: { include: { orderCosts: { orderBy: { createdAt: "desc" }, take: 1 }, product: true } } } } } });
  if (!receipt) return [];
  await attachReceiptPricingEvidence([receipt], tx);
  const at = getReceiptRecognitionDate(receipt);
  if (!at) return [];
  const data = (receipt.data && typeof receipt.data === "object" && !Array.isArray(receipt.data) ? receipt.data : {}) as Record<string, any>;
  await tx.receipt.update({ where: { id: receiptId }, data: { data: { ...data, financialRecognitionAt: at.toISOString() } } });
  const keys = [...new Set([receipt.receiptNumber, receipt.order?.orderNumber, canonicalReceiptNumber(receipt.order?.orderNumber)].filter((key): key is string => Boolean(key)))];
  const where = { OR: [{ receiptNumber: { in: keys } }, { receiptKey: { in: keys } }] };
  const affected: RecognitionLedgerTarget[] = [];
  const day = recognitionDay(at);
  for (const kind of ["support", "marketing"] as const) {
    const receiptModel = kind === "support" ? tx.supportReceipt : tx.marketingReceipt;
    const entryModel = kind === "support" ? tx.supportDailyEntry : tx.marketingDailyEntry;
    const rows = await (receiptModel.findMany as any)({ where, include: { dailyEntry: true } });
    for (const row of rows) {
      const userId = row.dailyEntry?.submittedById;
      if (!userId) continue;
      let entry = await (entryModel.findFirst as any)({ where: { submittedById: userId, date: { gte: day.start, lte: day.end } } });
      if (!entry) entry = await (entryModel.create as any)({ data: { submittedById: userId, date: at, dayOfWeek: at.toLocaleDateString("en-KE", { weekday: "long", timeZone: "Africa/Nairobi" }), totalSales: 0, totalProfit: 0 } });
      await (receiptModel.update as any)({ where: { id: row.id }, data: { dailyEntryId: entry.id } });
      if (kind === "support") {
        await tx.supportSale.updateMany({ where: { receiptNumber: { in: keys }, entry: { submittedById: userId } }, data: { entryId: entry.id, createdAt: at } });
        await recalcSupportEntry(tx, row.dailyEntryId);
        if (row.dailyEntryId !== entry.id) await recalcSupportEntry(tx, entry.id);
      } else {
        await tx.marketingSale.updateMany({ where: { receiptNumber: { in: keys }, entryId: row.dailyEntryId }, data: { entryId: entry.id } });
        await recalcMarketingEntry(tx, row.dailyEntryId);
        if (row.dailyEntryId !== entry.id) await recalcMarketingEntry(tx, entry.id);
      }
      affected.push({ userId, date: row.dailyEntry.date }, { userId, date: at });
    }
  }
  return affected;
}

export async function refreshRecognitionLedgers(targets: RecognitionLedgerTarget[]) {
  const seen = new Set<string>();
  for (const target of targets) {
    const period = getTradingPeriodFor(target.date);
    const key = `${target.userId}:${period.start.toISOString()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    await recomputeSupportCommissionLedger({ userId: target.userId, period });
    await recomputeMarketingCommissionLedger({ userId: target.userId, period });
  }
}
