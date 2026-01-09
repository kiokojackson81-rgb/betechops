#!/usr/bin/env node
const { prisma } = require('../.worker-dist/src/lib/prisma');

const WEEK_START_ISO = '2026-01-05T00:00:00.000Z';

(async ()=>{
  try{
    const weekStart = new Date(WEEK_START_ISO);
    // search for rows with weekStart within +/-24h of the supplied iso (handles stored UTC vs Nairobi canonicalization)
    const lower = new Date(weekStart.getTime() - 24*3600*1000);
    const upper = new Date(weekStart.getTime() + 24*3600*1000);
    const payouts = await prisma.marketplacePayoutWeek.findMany({
      where: { weekStart: { gte: lower, lte: upper }, currency: 'KES' }
    });

    // exclude placeholder rows in JS (Prisma JSON path filters not supported here)
    const payoutsFiltered = payouts.filter(p => !(p.rawPayload && p.rawPayload.placeholder === true));

    const sumByPlatform = payoutsFiltered.reduce((acc,r)=>{
      const p = r.platform || 'UNKNOWN';
      acc[p] = (acc[p] || 0) + Number(r.payoutAmount || 0);
      acc.__total = (acc.__total || 0) + Number(r.payoutAmount || 0);
      return acc;
    },{});

    const sql = `SELECT total FROM public.jumia_card_cache WHERE week_start = timestamptz '${WEEK_START_ISO}'`;
    const cacheRows = await prisma.$queryRawUnsafe(sql);
    let cacheTotal = 0;
    for(const r of cacheRows){ cacheTotal += Number(r.total || 0); }

    console.log('DB payouts count (all):', payouts.length);
    console.log('DB payouts count (excluding placeholders):', payoutsFiltered.length);
    console.log('DB sum by platform (excluding placeholders):', JSON.stringify(sumByPlatform, null, 2));
    console.log('Cache total:', cacheTotal);

  }catch(e){ console.error(e); process.exit(1);} finally { await prisma.$disconnect(); }
})();
