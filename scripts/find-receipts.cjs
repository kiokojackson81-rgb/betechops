const { PrismaClient } = require('@prisma/client');
(async function(){
  const p = new PrismaClient();
  try{
    const rows = await p.receipt.findMany({ where: { id: { startsWith: 'Betech-20251221' } }, select: { id: true, createdAt: true, order: { select: { orderNumber: true } } }, take: 200 });
    console.dir(rows, { depth: 2 });
  }catch(e){
    console.error(e);
  }finally{
    await p.$disconnect();
  }
})();
