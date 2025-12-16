const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
function getTradingPeriodFor(date) {
  const d = new Date(date);
  d.setHours(0,0,0,0);
  const year = d.getFullYear();
  const month = d.getMonth();
  const day = d.getDate();
  let startYear, startMonth, endYear, endMonth;
  if (day >= 25) {
    startYear = year; startMonth = month;
    const next = new Date(year, month + 1, 1);
    endYear = next.getFullYear(); endMonth = next.getMonth();
  } else {
    const prev = new Date(year, month - 1, 1);
    startYear = prev.getFullYear(); startMonth = prev.getMonth();
    endYear = year; endMonth = month;
  }
  const start = new Date(startYear, startMonth, 25, 0,0,0,0);
  const end = new Date(endYear, endMonth, 24,23,59,59,999);
  const label = `${start.toLocaleDateString('en-US')} – ${end.toLocaleDateString('en-US')}`;
  const key = `${start.toISOString().split('T')[0]}_${end.toISOString().split('T')[0]}`;
  return { start, end, label, key };
}

(async ()=>{
  try {
    const period = getTradingPeriodFor(new Date());
    const weekly = await p.weeklySale.count({ where: { status: 'APPROVED', AND: [{ weekEnd: { gte: period.start } }, { weekStart: { lte: period.end } }] } });
    console.log('approvedWeeklySaleCount=' + weekly);
    const ledgerCnt = await p.commissionLedger.count();
    console.log('commissionLedgerCount=' + ledgerCnt);
    const rows = await p.commissionLedger.findMany({ take: 5, orderBy: { createdAt: 'desc' } });
    console.log('lastRows=' + JSON.stringify(rows.map(r => ({ id: r.id, userId: r.userId, periodStart: r.periodStart, periodEnd: r.periodEnd, grossCommission: r.grossCommission, netCommission: r.netCommission, penalties: r.penalties })), null, 2));
  } catch (err) {
    console.error('err', err);
    process.exit(2);
  } finally {
    await p.$disconnect();
  }
})();
