const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async ()=>{
  try{
    const stmt = 'PS251229KE12DWN';
    const rows = await prisma.marketplacePayoutWeek.findMany({ where: { statementNumber: stmt }, include: { account: true } });
    console.log('Found', rows.length, 'rows for', stmt);
    for(const r of rows){
      console.log(r.accountId, r.account?.displayName, r.weekStart.toISOString().slice(0,10), r.weekEnd.toISOString().slice(0,10), Number(r.payoutAmount).toFixed(2));
    }
  }catch(err){console.error(err)}finally{await prisma.$disconnect()}
})();
