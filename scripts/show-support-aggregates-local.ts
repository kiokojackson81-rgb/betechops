import 'dotenv/config';
import { prisma } from '../src/lib/prisma.ts';
import { getTradingPeriodFor } from '../src/lib/tradingPeriod.ts';

function buildReceiptKey(receiptNumber: string | null, id: string) {
  if (receiptNumber && receiptNumber.trim().length > 0) return receiptNumber.trim();
  return `ID:${id}`;
}

function normalizePaymentMethod(method: unknown) {
  if (typeof method !== 'string') return 'MPESA';
  return method.toUpperCase() === 'CASH' ? 'CASH' : 'MPESA';
}

async function main() {
  const userId = process.argv[2] || 'cmimxqfnr0005v5mc05nwhg9o';
  const period = getTradingPeriodFor(new Date());

  const entries = await prisma.supportDailyEntry.findMany({
    where: { submittedById: userId, date: { gte: period.start, lte: period.end } },
    include: { receipts: { select: { id: true, receiptNumber: true, sellingTotal: true, buyingTotal: true, paymentMethod: true, items: { select: { id: true } } } } },
  });

  const seen = new Map();
  for (const entry of entries) {
    for (const r of entry.receipts ?? []) {
      const key = buildReceiptKey(r.receiptNumber ?? null, r.id);
      const selling = Number(r.sellingTotal ?? 0);
      const buying = Number(r.buyingTotal ?? 0);
      const itemsCount = Array.isArray(r.items) ? r.items.length : 0;
      const method = normalizePaymentMethod(r.paymentMethod);
      const existing = seen.get(key);
      if (existing) {
        existing.sales += selling;
        existing.profit += selling - buying;
        existing.items += itemsCount;
        if (method === 'CASH') existing.cash += selling; else existing.mpesa += selling;
      } else {
        seen.set(key, { id: r.id, sales: selling, profit: selling - buying, items: itemsCount, mpesa: method === 'MPESA' ? selling : 0, cash: method === 'CASH' ? selling : 0 });
      }
    }
  }

  let totalSales = 0, totalProfit = 0, totalReceipts = 0;
  for (const [, v] of seen) {
    totalSales += v.sales; totalProfit += v.profit; totalReceipts += 1;
  }

  console.log('Support aggregates for', userId, 'period', period.label);
  console.log('totalSales', totalSales, 'totalProfit', totalProfit, 'totalReceipts', totalReceipts);
  console.log('perReceipts:', Object.fromEntries(Array.from(seen.entries())));

  await prisma.$disconnect();
}

main().catch(e=>{ console.error(e); prisma.$disconnect().catch(()=>{}); process.exit(1); });
