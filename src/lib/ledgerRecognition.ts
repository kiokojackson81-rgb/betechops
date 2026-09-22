import { normalizeReceiptNumber as canonicalReceiptNumber } from "@/lib/receiptKey";
import { getReceiptRecognitionDate, recognitionDate } from "@/lib/receiptRecognition";
import { attachReceiptPricingEvidence } from "@/lib/receiptRecognitionData";

/** Re-date linked POS rows for historical reports without altering source records. */
export async function ledgerEntriesForRecognitionPeriod<T extends { id: string; date: Date; receipts?: any[]; sales?: any[]; [key: string]: any }>(entries: T[], start: Date, end: Date, client: any): Promise<T[]> {
  const keys = [...new Set(entries.flatMap(entry => [...(entry.receipts ?? []), ...(entry.sales ?? [])].map(row => row.receiptNumber).filter(Boolean)))];
  const receipts = keys.length ? await client.receipt.findMany({ where: { OR: [{ receiptNumber: { in: keys } }, { order: { orderNumber: { in: keys } } }] }, include: { order: { include: { items: { include: { orderCosts: { orderBy: { createdAt: "desc" }, take: 1 }, product: true } } } } } }) : [];
  await attachReceiptPricingEvidence(receipts, client);
  const byNumber = new Map<string, any>();
  for (const receipt of receipts) for (const raw of [receipt.receiptNumber, receipt.order?.orderNumber]) {
    const key = canonicalReceiptNumber(raw);
    if (key) byNumber.set(key, receipt);
  }
  const inPeriod = (at: Date | null) => at && at >= start && at <= end;
  const result: T[] = [];
  for (const entry of entries) {
    const rows = [...(entry.receipts ?? []), ...(entry.sales ?? [])];
    if (!rows.length) { if (inPeriod(entry.date)) result.push(entry); continue; }
    const buckets = new Map<string, any>();
    let preserveActivity = Boolean(inPeriod(entry.date));
    for (const kind of ["receipts", "sales"] as const) for (const row of entry[kind] ?? []) {
      const key = canonicalReceiptNumber(row.receiptNumber);
      const linked = key ? byNumber.get(key) : null;
      const at = linked ? getReceiptRecognitionDate(linked) : recognitionDate(entry.date);
      if (!inPeriod(at)) continue;
      const day = new Date(at!.getTime() + 3 * 3600000).toISOString().slice(0, 10);
      let bucket = buckets.get(day);
      if (!bucket) {
        bucket = { ...entry, id: `${entry.id}:${day}`, date: at, receipts: [], sales: [], totalSales: 0, totalProfit: 0,
          newBatteries: preserveActivity ? entry.newBatteries : 0, changedBatteries: preserveActivity ? entry.changedBatteries : 0,
          payload: preserveActivity ? entry.payload : null };
        preserveActivity = false;
        buckets.set(day, bucket);
      }
      bucket[kind].push(row);
    }
    for (const bucket of buckets.values()) {
      const seen = new Set<string>();
      for (const row of bucket.receipts) {
        const key = canonicalReceiptNumber(row.receiptNumber);
        if (key && seen.has(key)) continue;
        if (key) seen.add(key);
        const selling = Number(row.sellingTotal ?? 0);
        const items = row.items ?? [];
        const buying = Number(row.buyingTotal) || items.reduce((sum: number, item: any) => sum + Number(item.buyingPrice ?? 0), 0);
        const complete = Number(row.buyingTotal) > 0 || (items.length > 0 && items.every((item: any) => Number(item.buyingPrice) > 0));
        bucket.totalSales += selling;
        if (complete) bucket.totalProfit += selling - buying;
      }
      for (const row of bucket.sales) {
        const key = canonicalReceiptNumber(row.receiptNumber);
        if (key && seen.has(key)) continue;
        bucket.totalSales += Number(row.sellingPrice ?? 0);
        if (Number(row.buyingPrice) > 0) bucket.totalProfit += Number(row.sellingPrice ?? 0) - Number(row.buyingPrice);
      }
      result.push(bucket);
    }
  }
  return result;
}
