const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async ()=>{
  try{
    const stmt = 'PS251229KE12DWN';
    const rows = await prisma.marketplacePayoutWeek.findMany({ where: { statementNumber: stmt }, select: { id:true, accountId:true, statementNumber:true, rawPayload:true } });
    for(const r of rows){
      console.log('ROW', r.id, r.accountId, r.statementNumber, JSON.stringify(r.rawPayload));
    }
  }catch(err){console.error(err)}finally{await prisma.$disconnect()}
})();
