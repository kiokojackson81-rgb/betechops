const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async ()=>{
  try{
    const acc = await prisma.marketplaceAccount.findFirst({ where: { displayName: { contains: 'JUDE', mode: 'insensitive' } } });
    console.log(acc);
  }catch(err){console.error(err)}finally{await prisma.$disconnect()}
})();
