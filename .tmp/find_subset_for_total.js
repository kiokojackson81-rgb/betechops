#!/usr/bin/env node
require('dotenv/config');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function cents(n) { return Math.round(Number(n) * 100); }

(async function main(){
  try {
    const isoStart = new Date('2026-01-05T00:00:00.000Z');
    const isoEnd = new Date('2026-01-13T00:00:00.000Z');
    const rows = await prisma.marketplacePayoutWeek.findMany({
      where: { weekStart: { gte: isoStart, lt: isoEnd } },
      select: { accountId: true, payoutAmount: true, grossSales: true }
    });
    const map = new Map();
    for (const r of rows) {
      const amt = Number(r.payoutAmount ?? r.grossSales ?? 0);
      map.set(r.accountId, (map.get(r.accountId) || 0) + amt);
    }
    const items = Array.from(map.entries()).map(([accountId, amount]) => ({ accountId, amount }));
    console.log('Accounts found:', items.length);
    for (const it of items) console.log(it.accountId, it.amount.toFixed(2));

    const target = 767281.06;
    const targetC = cents(target);

    const n = items.length;
    const solutions = [];
    for (let mask = 1; mask < (1<<n); mask++) {
      let sumC = 0;
      const sel = [];
      for (let i=0;i<n;i++) if (mask & (1<<i)) { sumC += cents(items[i].amount); sel.push(items[i]); }
      if (Math.abs(sumC - targetC) <= 1) {
        solutions.push({ sel, sum: sumC/100 });
      }
    }

    if (solutions.length===0) {
      console.log('No exact subset found. Closest candidates:');
      // find closest
      let best = null;
      for (let mask = 1; mask < (1<<n); mask++) {
        let sumC = 0; const sel=[];
        for (let i=0;i<n;i++) if (mask & (1<<i)) { sumC += cents(items[i].amount); sel.push(items[i]); }
        const diff = Math.abs(sumC - targetC);
        if (!best || diff < best.diff) best = { sel, sum: sumC/100, diff };
      }
      if (best) {
        console.log('Best match sum:', best.sum.toFixed(2), 'diff cents=', best.diff);
        console.log('Accounts:');
        for (const s of best.sel) console.log(' -', s.accountId, s.amount.toFixed(2));
      }
    } else {
      console.log('Found solutions:');
      for (const sol of solutions) {
        console.log('Sum:', sol.sum.toFixed(2));
        for (const s of sol.sel) console.log(' -', s.accountId, s.amount.toFixed(2));
      }
    }
    process.exit(0);
  } catch (e) {
    console.error('failed', e);
    process.exit(2);
  } finally {
    await prisma.$disconnect().catch(()=>{});
  }
})();
