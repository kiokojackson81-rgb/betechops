#!/usr/bin/env node
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async ()=>{
  try{
    const weekStart = new Date('2026-01-05T00:00:00Z');
    const rows = await prisma.$queryRawUnsafe('SELECT week_start, shop_sid, total, updated_at FROM public.jumia_card_cache WHERE week_start = $1 ORDER BY shop_sid', weekStart);
    console.log('cache rows for weekStart=2026-01-05:');
    for (const r of rows) {
      console.log(JSON.stringify(r));
    }
  }catch(e){ console.error('ERR', e && e.message ? e.message : e); process.exit(1); } finally { await prisma.$disconnect(); }
})();
