const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
function getTradingPeriodFor(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const year = d.getFullYear();
  const month = d.getMonth();
  const day = d.getDate();

  let startYear, startMonth, endYear, endMonth;
  if (day >= 25) {
    startYear = year;
    startMonth = month;
    const next = new Date(year, month + 1, 1);
    endYear = next.getFullYear();
    endMonth = next.getMonth();
  } else {
    const prev = new Date(year, month - 1, 1);
    startYear = prev.getFullYear();
    startMonth = prev.getMonth();
    endYear = year;
    endMonth = month;
  }
  const start = new Date(startYear, startMonth, 25, 0, 0, 0, 0);
  const end = new Date(endYear, endMonth, 24, 23, 59, 59, 999);
  return { start, end };
}
(async ()=>{
  try{
    const user = await prisma.user.findUnique({ where: { email: 'jeniffer@betech.co.ke' }, select: { id: true } });
    if(!user) return console.error('user not found');
    const period = getTradingPeriodFor(new Date());
    const ledger = await prisma.commissionLedger.findUnique({ where: { userId_periodStart_periodEnd: { userId: user.id, periodStart: period.start, periodEnd: period.end } } });
    console.log('Period:', period.start.toISOString(), period.end.toISOString());
    console.log('Ledger:', ledger ? { id: ledger.id, commissionTotal: ledger.commissionTotal, grossCommission: ledger.grossCommission, netCommission: ledger.netCommission, detail: ledger.detail } : null);
  }catch(e){console.error(e)}finally{await prisma.$disconnect()}
})();