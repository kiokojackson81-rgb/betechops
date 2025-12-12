#!/usr/bin/env node
/*
  Backfill script for pricedAt fields.

  Usage:
    # dry-run (shows counts and sample rows)
    node scripts/backfill_pricedAt.js --dry-run

    # run with batching (default batch 500)
    DATABASE_URL="postgresql://..." node scripts/backfill_pricedAt.js --batch=500

  Behavior:
    - For MarketingSale where pricedAt IS NULL, sets pricedAt = createdAt.
    - For SupportReceiptItem where pricedAt IS NULL and buyingPrice IS NOT NULL, sets pricedAt = updatedAt.
    - Works in batches and logs progress. Safe to run multiple times (idempotent).
*/

const { PrismaClient } = require('@prisma/client');
const argv = require('minimist')(process.argv.slice(2));

const prisma = new PrismaClient();

async function backfillMarketingSales({ dryRun, batch }) {
  console.log('Backfilling MarketingSale.pricedAt (pricedAt IS NULL)');
  let total = 0;
  while (true) {
    const rows = await prisma.marketingSale.findMany({
      where: { pricedAt: null },
      select: { id: true, createdAt: true },
      take: batch,
    });
    if (rows.length === 0) break;
    total += rows.length;
    console.log(`Found ${rows.length} marketingSale rows (batch).`);
    if (dryRun) break;
    for (const r of rows) {
      await prisma.marketingSale.update({ where: { id: r.id }, data: { pricedAt: r.createdAt } });
    }
  }
  console.log(`MarketingSale: processed ${total} rows (dryRun=${dryRun})`);
}

async function backfillSupportReceiptItems({ dryRun, batch }) {
  console.log('Backfilling SupportReceiptItem.pricedAt (pricedAt IS NULL && buyingPrice IS NOT NULL)');
  let total = 0;
  while (true) {
    const rows = await prisma.supportReceiptItem.findMany({
      where: { pricedAt: null, buyingPrice: { not: null } },
      select: { id: true, updatedAt: true },
      take: batch,
    });
    if (rows.length === 0) break;
    total += rows.length;
    console.log(`Found ${rows.length} supportReceiptItem rows (batch).`);
    if (dryRun) break;
    for (const r of rows) {
      await prisma.supportReceiptItem.update({ where: { id: r.id }, data: { pricedAt: r.updatedAt } });
    }
  }
  console.log(`SupportReceiptItem: processed ${total} rows (dryRun=${dryRun})`);
}

async function main() {
  const dryRun = !!argv['dry-run'] || !!argv.dryRun || !!argv.dry;
  const batch = Number(argv.batch || argv.b || 500);

  console.log(`Starting backfill (dryRun=${dryRun}, batch=${batch})`);
  try {
    await backfillMarketingSales({ dryRun, batch });
    await backfillSupportReceiptItems({ dryRun, batch });
    console.log('Backfill complete');
  } catch (err) {
    console.error('Backfill failed', err);
    process.exitCode = 2;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) main();
