#!/usr/bin/env node
require('dotenv/config');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function cents(n){ return Math.round(Number(n) * 100); }

(async function main(){
  try {
    const isoStart = new Date('2026-01-05T00:00:00.000Z');
    const isoEnd = new Date('2026-01-13T00:00:00.000Z');

    // find rows in week window
    const rows = await prisma.marketplacePayoutWeek.findMany({
      where: { weekStart: { gte: isoStart, lt: isoEnd } },
      select: { accountId: true, payoutAmount: true, grossSales: true, rawPayload: true }
    });

    // aggregate by shopSid from rawPayload.shopSid when available
    const shopMap = new Map();
    for (const r of rows) {
      const shopSid = (r.rawPayload && (r.rawPayload.shopSid || r.rawPayload.shop_id || r.rawPayload.shop)) || null;
      const key = shopSid || r.accountId || '(unknown)';
      const amt = Number(r.payoutAmount ?? r.grossSales ?? 0);
      shopMap.set(key, (shopMap.get(key) || 0) + amt);
    }

    const items = Array.from(shopMap.entries()).map(([shopSid, amount]) => ({ shopSid, amount }));
    console.log('Shops found:', items.length);
    for (const it of items) console.log(it.shopSid, it.amount.toFixed(2));

    const target = 767281.06;
    const tC = cents(target);
    const n = items.length;

    // try tolerances
    const tolerances = [1,10,100,1000,2500,5000];
    function findWithinTol(tol){
      const tolC = Math.round(tol*100);
      for (let mask=1; mask < (1<<n); mask++){
        let sumC=0; const sel=[];
        for (let i=0;i<n;i++) if(mask & (1<<i)){ sumC += cents(items[i].amount); sel.push(items[i]); }
        const diff = Math.abs(sumC - tC);
        if (diff <= tolC) return { sel, sumC, diff };
      }
      return null;
    }

    for (const tol of tolerances) {
      const r = findWithinTol(tol);
      if (r) {
        console.log(`Found subset within tolerance ${tol} KES:`);
        for (const s of r.sel) console.log(' -', s.shopSid, s.amount.toFixed(2));
        console.log('Sum:', (r.sumC/100).toFixed(2), 'diff:', (r.diff/100).toFixed(2));
        process.exit(0);
      }
    }

    // closest overall
    let best=null;
    for (let mask=1; mask < (1<<n); mask++){
      let sumC=0; const sel=[];
      for (let i=0;i<n;i++) if(mask & (1<<i)){ sumC += cents(items[i].amount); sel.push(items[i]); }
      const diff = Math.abs(sumC - tC);
      if (!best || diff < best.diff) best={ sel, sumC, diff };
    }
    if (best) {
      console.log('No subset within tolerances. Closest match:');
      for (const s of best.sel) console.log(' -', s.shopSid, s.amount.toFixed(2));
      console.log('Sum:', (best.sumC/100).toFixed(2), 'diff:', (best.diff/100).toFixed(2));
    }

    process.exit(0);
  } catch (e) {
    console.error('failed', e);
    process.exit(2);
  } finally {
    await prisma.$disconnect().catch(()=>{});
  }
})();
