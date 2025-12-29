import 'dotenv/config';
import { prisma } from '../src/lib/prisma.ts';
import { getTradingPeriodFor } from '../src/lib/tradingPeriod.ts';

async function main() {
  const userId = process.argv[2] || 'cmimxqfnr0005v5mc05nwhg9o';
  const period = getTradingPeriodFor(new Date('2025-12-29'));
  console.log('Listing receipt keys for', userId, 'period', period.label);

  const mEntries = await prisma.marketingDailyEntry.findMany({ where: { submittedById: userId, date: { gte: period.start, lte: period.end } }, include: { receipts: true, sales: true } });
  const sEntries = await prisma.supportDailyEntry.findMany({ where: { submittedById: userId, date: { gte: period.start, lte: period.end } }, include: { receipts: true } });

  console.log('marketing entries:', mEntries.length, 'support entries:', sEntries.length);

  const receipts: Array<{ key: string; selling: number; buying: number; source: string }>=[];

  for (const e of mEntries) {
    for (const r of e.receipts ?? []) receipts.push({ key: (r.receiptNumber||r.id).toString(), selling: Number(r.sellingTotal||0), buying: Number(r.buyingTotal||0), source: 'marketing_receipt' });
    for (const s of e.sales ?? []) receipts.push({ key: `sale-${s.id}`, selling: Number((s as any).sellingPrice||0), buying: Number((s as any).buyingPrice||0), source: 'marketing_sale' });
  }

  for (const e of sEntries) {
    for (const r of e.receipts ?? []) receipts.push({ key: (r.receiptNumber||r.id).toString(), selling: Number(r.sellingTotal||0), buying: Number(r.buyingTotal||0), source: 'support_receipt' });
  }

  const map = new Map<string, { selling: number; buying: number; sources: Set<string> }>();
  for (const r of receipts) {
    const existing = map.get(r.key);
    if (existing) {
      existing.selling += r.selling; existing.buying += r.buying; existing.sources.add(r.source);
    } else map.set(r.key, { selling: r.selling, buying: r.buying, sources: new Set([r.source]) });
  }

  console.log('Unique receipt keys count:', map.size);
  for (const [k,v] of map) { console.log('key', k, 'selling', v.selling, 'buying', v.buying, 'sources', Array.from(v.sources).join(',')); }

  await prisma.$disconnect();
}

main().catch(e=>{ console.error(e); prisma.$disconnect().catch(()=>{}); process.exit(1); });
