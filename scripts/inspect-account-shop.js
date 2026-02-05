try{require('dotenv').config();}catch{}
(async ()=>{
  const prisma = require('../.worker-dist/src/lib/prisma').prisma;
  try{
    const acctId='0307b9d2-5971-4abd-ab3b-d75bed0bab74';
    const ma = await prisma.marketplaceAccount.findUnique({ where: { id: acctId } });
    console.log('MarketplaceAccount:', JSON.stringify(ma, null, 2));
    const shop = await prisma.shop.findFirst({ where: { jumiaShopSid: 'db15d4e6-19a0-4cc1-b8c9-0619c5388643' } });
    console.log('Shop:', JSON.stringify(shop, null, 2));
  }catch(e){console.error(e);process.exit(1);}finally{await prisma.$disconnect().catch(()=>{});} 
})();
