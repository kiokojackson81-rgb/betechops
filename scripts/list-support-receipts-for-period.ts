import { prisma } from '../src/lib/prisma.ts';
(async function(){
  try {
    const start = new Date('2025-12-25T00:00:00Z');
    const end = new Date('2026-01-24T23:59:59Z');
    const userId = 'cmimxqfnr0005v5mc05nwhg9o';
    const rows = await prisma.supportReceipt.findMany({
      where: { dailyEntry: { submittedById: userId, date: { gte: start, lte: end } } },
      select: { id: true, receiptNumber: true, sellingTotal: true, buyingTotal: true, paymentMethod: true, createdAt: true, dailyEntryId: true }
    });
    console.log('Found', rows.length, 'support receipts in period:');
    rows.forEach(r => console.log(r));
  } catch(e){
    console.error(e);
  } finally { await prisma.$disconnect(); }
})();