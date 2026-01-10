try{require('dotenv').config();}catch{}
(async ()=>{
  const prisma = require('../.worker-dist/src/lib/prisma').prisma;
  const sid = 'db15d4e6-19a0-4cc1-b8c9-0619c5388643';
  try{
    let s = await prisma.shop.findFirst({ where: { jumiaShopSid: sid } });
    if (!s) {
      s = await prisma.shop.create({ data: { name: 'JM Latest Collections (db15)', jumiaShopSid: sid } });
      console.log('created', s.id);
    } else {
      console.log('exists', s.id);
    }
  }catch(e){
    console.error(e);
    process.exit(1);
  }finally{
    await prisma.$disconnect().catch(()=>{});
  }
})();
