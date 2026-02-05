const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async ()=>{
  try{
    const sid = 'db15d4e6-19a0-4cc1-b8c9-0619c5388643';
    const acc = await prisma.marketplaceAccount.findFirst({ where: { jumiaShopSid: sid } });
    console.log(acc);
  }catch(err){console.error(err)}finally{await prisma.$disconnect()}
})();
