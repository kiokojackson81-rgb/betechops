const { prisma } = require('../.worker-dist/src/lib/prisma');
const WEEK_START = new Date('2026-01-05T00:00:00.000Z');
(async ()=>{
  try{
    const lower = new Date(WEEK_START.getTime() - 24*3600*1000);
    const upper = new Date(WEEK_START.getTime() + 24*3600*1000);
    const rows = await prisma.marketplacePayoutWeek.findMany({ where: { weekStart: { gte: lower, lte: upper } }, orderBy: [{ accountId: 'asc' }]});
    console.log('Total rows found:', rows.length);
    const map = new Map();
    for(const r of rows){
      const a = map.get(r.accountId) || { accountId: r.accountId, rows: [], total: 0 };
      a.rows.push({ id: r.id, statementNumber: r.statementNumber, payout: Number(r.payoutAmount||0), placeholder: r.rawPayload && r.rawPayload.placeholder===true });
      a.total += Number(r.payoutAmount||0);
      map.set(r.accountId, a);
    }
    const accounts = await prisma.marketplaceAccount.findMany({ where: { id: { in: Array.from(map.keys()) } }, select: { id: true, displayName: true, platform: true, isActive: true }});
    for(const acc of accounts){
      const a = map.get(acc.id);
      console.log('\nAccount:', acc.displayName, acc.id, acc.platform, 'active=', acc.isActive);
      console.log(' rows:', JSON.stringify(a.rows, null, 2));
      console.log(' total:', a.total);
    }
    // also list all active JUMIA accounts count
    const totalActive = await prisma.marketplaceAccount.count({ where: { platform: 'JUMIA', isActive: true } });
    console.log('\nTotal active JUMIA accounts:', totalActive);
  }catch(e){ console.error(e);} finally{ await prisma.$disconnect(); }
})();
