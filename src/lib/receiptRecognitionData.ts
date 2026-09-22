import { prisma } from "@/lib/prisma";
import { normalizeReceiptNumber as canonicalReceiptNumber } from "@/lib/receiptKey";
import { recognitionDate } from "@/lib/receiptRecognition";

/** Resolve legacy support pricing evidence in one batch, without rewriting historical receipts. */
export async function attachReceiptPricingEvidence(receipts: any[], client: any = prisma) {
  const keys = [...new Set(receipts.flatMap(row => [row.receiptNumber, row.order?.orderNumber, canonicalReceiptNumber(row.receiptNumber), canonicalReceiptNumber(row.order?.orderNumber)]).filter(Boolean))];
  if (!keys.length) return;
  const rows = await client.supportReceipt.findMany({
    where: { OR: [{ receiptNumber: { in: keys } }, { receiptKey: { in: keys } }, ...keys.map(key => ({ receiptKey: { endsWith: `:${canonicalReceiptNumber(key)}` } }))] },
    select: { receiptNumber: true, receiptKey: true, buyingTotal: true, items: { select: { buyingPrice: true, pricedAt: true } } },
  });
  const evidence = new Map<string, { complete: boolean; pricedAt: Date | null }>();
  for (const row of rows) {
    const items = row.items ?? [];
    const complete = items.length ? items.every((item: any) => Number(item.buyingPrice) > 0) : Number(row.buyingTotal) > 0;
    const pricedAt = items.map((item: any) => recognitionDate(item.pricedAt)).filter(Boolean).sort((a: Date, b: Date) => b.getTime() - a.getTime())[0] ?? null;
    for (const raw of [row.receiptNumber, row.receiptKey]) {
      const key = canonicalReceiptNumber(String(raw ?? "").replace(/^\d{4}-\d{2}-\d{2}:/, ""));
      if (key && (!evidence.has(key) || (pricedAt?.getTime() ?? 0) > (evidence.get(key)?.pricedAt?.getTime() ?? 0))) evidence.set(key, { complete, pricedAt });
    }
  }
  for (const row of receipts) {
    const key = canonicalReceiptNumber(row.order?.orderNumber ?? row.receiptNumber);
    if (key && evidence.has(key)) row.financialPricingEvidence = evidence.get(key);
  }
}
