#!/usr/bin/env node
const { prisma } = require('../.worker-dist/src/lib/prisma');

function canonicalNairobiWeekStartUtc(dateUtc) {
  const NAIROBI_TZ = 'Africa/Nairobi';
  const formatter = new Intl.DateTimeFormat('en-GB', { timeZone: NAIROBI_TZ, day: '2-digit', month: '2-digit', year: 'numeric' });
  const parts = formatter.formatToParts(dateUtc);
  const year = Number(parts.find(p => p.type === 'year')?.value || dateUtc.getUTCFullYear());
  const month = Number(parts.find(p => p.type === 'month')?.value || (dateUtc.getUTCMonth() + 1));
  const day = Number(parts.find(p => p.type === 'day')?.value || dateUtc.getUTCDate());
  const nairobiDateUtc = new Date(Date.UTC(year, month -1, day, 0,0,0,0));
  const currentDay = nairobiDateUtc.getUTCDay();
  const deltaToMonday = (currentDay + 6) % 7;
  nairobiDateUtc.setUTCDate(nairobiDateUtc.getUTCDate() - deltaToMonday);
  return nairobiDateUtc;
}

function endInclusive(start){ return new Date(start.getTime() + 7*24*3600*1000 -1); }

(async ()=>{
  try{
    const today = new Date();
    let cursor = canonicalNairobiWeekStartUtc(today);
    const weekStarts = [];
    for(let i=0;i<4;i++){ weekStarts.push(new Date(cursor)); cursor = new Date(cursor.getTime() - 7*24*3600*1000); }
    const oldestStart = weekStarts[weekStarts.length-1];
    const newestEndExclusive = new Date(weekStarts[0].getTime() + 7*24*3600*1000);

    const assignments = await prisma.marketplaceAccountAssignment.findMany({ include: { account: true } });

    const payload = [];
    for(const assignment of assignments){
      const rows = await prisma.marketplacePayoutWeek.findMany({ where: { accountId: assignment.accountId, weekStart: { gte: oldestStart }, weekEnd: { lte: newestEndExclusive } }, orderBy: [{ weekStart: 'desc' }, { createdAt: 'desc' }] });
      const grouped = new Map();
      for(const r of rows){
        const key = canonicalNairobiWeekStartUtc(new Date(r.weekStart)).toISOString();
        if(!grouped.has(key)) grouped.set(key, []);
        grouped.get(key).push(r);
      }
      const weeks = weekStarts.map(start => {
        const key = start.toISOString();
        const items = grouped.get(key) || [];
        if(!items.length){ return { id:null, statementNumber:null, weekStart: start.toISOString(), weekEnd: endInclusive(start).toISOString(), grossSales:0, payoutAmount:0, currency:'KES', isPaid:false, placeholder:true }; }
        // choose authoritative: prefer any non-placeholder; among them prefer isPaid true, then updatedAt newest, then createdAt
        const realItems = items.filter(it => !(it.rawPayload && it.rawPayload.placeholder === true));
        const candidates = (realItems.length? realItems: items);
        candidates.sort((a,b)=>{
          // isPaid first
          const pa = a.isPaid?1:0; const pb = b.isPaid?1:0; if(pa!==pb) return pb-pa;
          const ua = a.updatedAt? new Date(a.updatedAt).getTime():0; const ub = b.updatedAt? new Date(b.updatedAt).getTime():0; if(ua!==ub) return ub-ua;
          const ca = a.createdAt? new Date(a.createdAt).getTime():0; const cb = b.createdAt? new Date(b.createdAt).getTime():0; return cb-ca;
        });
        const keeper = candidates[0];
        const payout = Number(keeper.payoutAmount || 0);
        const gross = Number(keeper.grossSales || payout);
        return { id: keeper.id, statementNumber: keeper.statementNumber||null, weekStart: start.toISOString(), weekEnd: endInclusive(start).toISOString(), grossSales: gross, payoutAmount: payout, currency:'KES', isPaid: !!keeper.isPaid, placeholder: Boolean(keeper.rawPayload && keeper.rawPayload.placeholder===true) };
      });
      const total4Weeks = weeks.reduce((s,w)=>s + Number(w.grossSales||0), 0);
      payload.push({ accountId: assignment.accountId, accountName: assignment.account.displayName, platform: assignment.account.platform, weeks, total4Weeks });
    }
    console.log(JSON.stringify({ accounts: payload }, null, 2));
  }catch(e){ console.error('ERR', e && e.message? e.message: e); process.exit(1);} finally { await prisma.$disconnect(); }
})();
