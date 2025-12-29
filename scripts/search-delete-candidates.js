const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const start = new Date('2025-12-28T00:00:00.000Z');
const end = new Date('2025-12-28T23:59:59.999Z');

(async () => {
  try {
    console.log('Searching SupportReceipt for sellingTotal 2000 or 1000 on 2025-12-28');
    try {
      const sup = await prisma.supportReceipt.findMany({ where: { createdAt: { gte: start, lte: end }, OR: [{ sellingTotal: 2000 }, { sellingTotal: 1000 }] } });
      console.log('supportReceipt matches:', sup.length);
      sup.forEach(r => console.log(JSON.stringify(r, null, 2)));
    } catch (e) {
      console.error('supportReceipt query failed:', e.message || e);
    }

    console.log('\nSearching MarketingReceipt for sellingTotal 2000 or 1000 on 2025-12-28');
    try {
      const m = await prisma.marketingReceipt.findMany({ where: { createdAt: { gte: start, lte: end }, OR: [{ sellingTotal: 2000 }, { sellingTotal: 1000 }] } });
      console.log('marketingReceipt matches:', m.length);
      m.forEach(r => console.log(JSON.stringify(r, null, 2)));
    } catch (e) {
      console.error('marketingReceipt query failed:', e.message || e);
    }

    console.log('\nSearching WeeklySale/SupportSale/Other models for amounts');
    try {
      const ss = await prisma.supportSale.findMany({ where: { createdAt: { gte: start, lte: end }, OR: [{ sellingPrice: 2000 }, { sellingPrice: 1000 }] } });
      console.log('supportSale matches:', ss.length);
      ss.forEach(r => console.log(JSON.stringify(r, null, 2)));
    } catch (e) {
      console.error('supportSale query failed:', e.message || e);
    }

    // Also check daily reports sales JSON
    try {
      const dr = await prisma.dailySale.findMany({ where: { createdAt: { gte: start, lte: end }, OR: [{ price: '2000' }, { price: '1000' }] } });
      console.log('dailySale matches:', dr.length);
      dr.forEach(r => console.log(JSON.stringify(r, null, 2)));
    } catch (e) {
      console.error('dailySale query failed:', e.message || e);
    }

  } catch (e) {
    console.error('search failed', e);
  } finally {
    await prisma.$disconnect();
  }
})();
