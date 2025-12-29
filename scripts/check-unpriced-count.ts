import { prisma } from '../src/lib/prisma.ts';

(async function(){
  const startDate = new Date('2025-12-25T00:00:00Z');
  const endDate = new Date('2026-01-24T23:59:59Z');
  const supportReceipts = await prisma.supportReceipt.findMany({
    where: {
      dailyEntry: { date: { gte: startDate, lte: endDate } },
      items: { some: { buyingPrice: 0 } },
      sellingTotal: { gt: 0 },
    },
    include: { dailyEntry: { include: { submittedBy: true } }, items: true },
    orderBy: { createdAt: 'asc' },
  });
  console.log('Support receipts (unpriced, sellingTotal>0) count:', supportReceipts.length);
  for (const r of supportReceipts) console.log(r.id, r.receiptNumber, r.sellingTotal, r.items.length, r.dailyEntry?.submittedBy?.email);
  await prisma.$disconnect();
})();