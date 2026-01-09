#!/usr/bin/env node
try { require('dotenv/config'); } catch {}
const { spawnSync } = require('child_process');
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

function runQuickSync(lookbackDays) {
  console.log('[refresh-mview] Running quick Jumia sync (dist runner)...');
  const args = ['scripts/run-jumia-one-shot-dist.js'];
  if (lookbackDays) args.push(`--lookbackDays=${lookbackDays}`);
  const res = spawnSync(process.execPath, args, { stdio: 'inherit', env: process.env, shell: false });
  if (res.error) {
    console.error('[refresh-mview] sync spawn error:', res.error && res.error.message ? res.error.message : res.error);
    return false;
  }
  if (res.status !== 0) {
    console.error('[refresh-mview] sync exited with code', res.status);
    return false;
  }
  return true;
}

async function ensureCacheTable(prisma) {
  const sqlFile = path.join(__dirname, 'sql', 'create_jumia_card_cache.sql');
  if (!fs.existsSync(sqlFile)) return;
  const sql = fs.readFileSync(sqlFile, 'utf8');
  try {
    await prisma.$executeRawUnsafe(sql);
    console.log('[refresh-mview] ensured jumia_card_cache exists');
  } catch (err) {
    // If already exists or other error, log and continue
    console.warn('[refresh-mview] ensure cache table warning:', err && err.message ? err.message : err);
  }
}

async function computeAndUpsert(weekStart) {
  const prisma = new PrismaClient();
  try {
    await ensureCacheTable(prisma);

    const weekDate = new Date(weekStart + 'T00:00:00Z');
    console.log('[refresh-mview] computing PS statement sums for', weekStart);

    const rows = await prisma.marketplacePayoutWeek.findMany({ where: { weekStart: weekDate } });

    const map = new Map();
    for (const r of rows) {
      const stmt = r.statementNumber || '';
      if (!stmt.startsWith('PS')) continue;
      const shop = (r.rawPayload && r.rawPayload.shopSid) || null;
      const cur = map.get(shop) || 0;
      map.set(shop, cur + Number(r.payoutAmount || 0));
    }

    if (map.size === 0) {
      console.log('[refresh-mview] no PS statements found for', weekStart);
    }

    for (const [shop, total] of map.entries()) {
      try {
        await prisma.$executeRawUnsafe(
          'INSERT INTO public.jumia_card_cache(week_start, shop_sid, total, updated_at) VALUES ($1, $2, $3, now()) ON CONFLICT (week_start, shop_sid) DO UPDATE SET total = EXCLUDED.total, updated_at = now()',
          weekDate,
          shop,
          total
        );
        console.log(`[refresh-mview] upserted week=${weekStart} shop=${shop} total=${Number(total).toFixed(2)}`);
      } catch (err) {
        console.error('[refresh-mview] upsert failed for', shop, err && err.message ? err.message : err);
      }
    }
  } finally {
    await prisma.$disconnect();
  }
}

(async function main() {
  try {
    const wkArg = process.argv.find(a => a.startsWith('--weekStart='));
    const lookbackArg = process.argv.find(a => a.startsWith('--lookbackDays='));
    const weekStart = wkArg ? wkArg.split('=')[1] : new Date().toISOString().slice(0,10);
    const lookbackDays = lookbackArg ? Number(lookbackArg.split('=')[1]) : undefined;

    const ok = runQuickSync(lookbackDays);
    if (!ok) {
      console.warn('[refresh-mview] quick sync failed — continuing to compute/upsert from DB');
    }

    await computeAndUpsert(weekStart);
    console.log('[refresh-mview] Done');
    process.exit(0);
  } catch (err) {
    console.error('[refresh-mview] error:', err && err.message ? err.message : err);
    process.exit(2);
  }
})();
