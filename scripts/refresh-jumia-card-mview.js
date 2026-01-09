#!/usr/bin/env node
const { spawnSync } = require('child_process');
const { PrismaClient } = require('@prisma/client');

function runQuickSync() {
  console.log('[refresh-mview] Running quick Jumia sync (dist runner)...');
  const res = spawnSync(process.execPath, ['scripts/run-jumia-one-shot-dist.js'], {
    stdio: 'inherit',
    env: process.env,
    shell: false,
  });
  if (res.error) {
    console.error('[refresh-mview] sync spawn error:', res.error);
    return false;
  }
  if (res.status !== 0) {
    console.error('[refresh-mview] sync exited with code', res.status);
    return false;
  }
  return true;
}

async function refreshMview() {
  const prisma = new PrismaClient();
  try {
    console.log('[refresh-mview] Refreshing materialized view jumia_card_mview');
    await prisma.$executeRawUnsafe('REFRESH MATERIALIZED VIEW CONCURRENTLY jumia_card_mview;');
    console.log('[refresh-mview] REFRESH completed');
  } catch (err) {
    console.error('[refresh-mview] REFRESH failed:', err);
    throw err;
  } finally {
    await prisma.$disconnect();
  }
}

(async function main() {
  try {
    const ok = runQuickSync();
    if (!ok) {
      console.warn('[refresh-mview] quick sync failed — proceeding to attempt refresh anyway');
    }
    await refreshMview();
    console.log('[refresh-mview] Done');
    process.exit(0);
  } catch (err) {
    console.error('[refresh-mview] error:', err);
    process.exit(2);
  }
})();
