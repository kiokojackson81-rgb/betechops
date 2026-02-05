#!/usr/bin/env node
require('dotenv/config');
const { PrismaClient } = require('@prisma/client');

(async () => {
  const prisma = new PrismaClient();
  try {
    console.log('[query_cache] checking jumia_card_cache for 2026-01-05');
    const rows = await prisma.$queryRawUnsafe("SELECT shop_sid, total FROM public.jumia_card_cache WHERE week_start = timestamptz '2026-01-05T00:00:00Z' ORDER BY shop_sid");
    console.log(JSON.stringify(rows, null, 2));
    const tot = await prisma.$queryRawUnsafe("SELECT COALESCE(SUM(total),0) AS total FROM public.jumia_card_cache WHERE week_start = timestamptz '2026-01-05T00:00:00Z'");
    console.log('[query_cache] GRAND_TOTAL:', tot && tot[0] ? tot[0].total : tot);
  } catch (err) {
    console.error('[query_cache] error', err && err.message ? err.message : err);
    process.exit(2);
  } finally {
    await prisma.$disconnect();
  }
})();
