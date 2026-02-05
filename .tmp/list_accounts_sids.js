const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  try {
    const accs = await prisma.marketplaceAccount.findMany({ where: { platform: 'JUMIA' }, select: { id: true, displayName: true, jumiaShopSid: true } });
    console.log('id,displayName,jumiaShopSid');
    for (const a of accs) {
      console.log(`${a.id},${(a.displayName||'').replace(/,/g,'')},${a.jumiaShopSid}`);
    }
  } catch (err) { console.error(err); } finally { await prisma.$disconnect(); }
})();
