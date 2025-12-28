#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const crypto = require('crypto');

function pickLatestPlan(dir) {
  const files = fs.readdirSync(dir).filter(f => f.startsWith('receipts-merge-plan-') && f.endsWith('.json'));
  if (!files.length) return null;
  files.sort();
  return path.join(dir, files[files.length - 1]);
}

async function main() {
  const argv = process.argv.slice(2);
  const planArgIndex = argv.findIndex(a => a === '--plan');
  let planPath = null;
  if (planArgIndex !== -1 && argv[planArgIndex + 1]) planPath = argv[planArgIndex + 1];
  if (!planPath) planPath = pickLatestPlan(path.join(process.cwd(), 'tmp'));
  if (!planPath || !fs.existsSync(planPath)) {
    console.error('No merge plan found. Provide --plan <path> or place a plan in ./tmp');
    process.exit(2);
  }

  const apply = argv.includes('--apply');
  const recompute = argv.includes('--recompute');
  if (!apply) {
    console.log('Plan exists at', planPath, '-- run with --apply to execute');
    process.exit(0);
  }

  const raw = JSON.parse(fs.readFileSync(planPath, 'utf8'));
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('DATABASE_URL must be set in environment');
    process.exit(2);
  }

  const client = new Client({ connectionString: dbUrl });
  await client.connect();

  try {
    await client.query('BEGIN');
    const affectedEntryIds = new Set();

    // process marketing
    for (const grp of raw.marketing || []) {
      const keeperId = grp.keeperId;
      for (const op of grp.ops || []) {
        const srcId = op.srcId;
        // copy items from src to keeper
        const itemsRes = await client.query('SELECT "productName", "buyingPrice" FROM "MarketingReceiptItem" WHERE "receiptId" = $1', [srcId]);
        for (const row of itemsRes.rows) {
          const newId = crypto.randomUUID();
          await client.query('INSERT INTO "MarketingReceiptItem" ("id","receiptId","productName","buyingPrice","createdAt","updatedAt") VALUES ($1,$2,$3,$4,NOW(),NOW())', [newId, keeperId, row.productname || row.productName, row.buyingprice || row.buyingPrice]);
        }
        // update keeper totals
        await client.query('UPDATE "MarketingReceipt" SET "sellingTotal" = COALESCE("sellingTotal",0) + $1, "buyingTotal" = COALESCE("buyingTotal",0) + $2 WHERE "id" = $3', [op.srcSelling || 0, op.srcBuying || 0, keeperId]);
        // record affected dailyEntryIds
        const resKeeper = await client.query('SELECT "dailyEntryId" FROM "MarketingReceipt" WHERE "id" = $1', [keeperId]);
        const resSrc = await client.query('SELECT "dailyEntryId" FROM "MarketingReceipt" WHERE "id" = $1', [srcId]);
        if (resKeeper.rows[0] && (resKeeper.rows[0].dailyentryid || resKeeper.rows[0].dailyEntryId)) affectedEntryIds.add(resKeeper.rows[0].dailyentryid || resKeeper.rows[0].dailyEntryId);
        if (resSrc.rows[0] && (resSrc.rows[0].dailyentryid || resSrc.rows[0].dailyEntryId)) affectedEntryIds.add(resSrc.rows[0].dailyentryid || resSrc.rows[0].dailyEntryId);
        // delete source items then source
        await client.query('DELETE FROM "MarketingReceiptItem" WHERE "receiptId" = $1', [srcId]);
        await client.query('DELETE FROM "MarketingReceipt" WHERE "id" = $1', [srcId]);
      }
    }

    // process support
    for (const grp of raw.support || []) {
      const keeperId = grp.keeperId;
      for (const op of grp.ops || []) {
        const srcId = op.srcId;
        const itemsRes = await client.query('SELECT "productName", "buyingPrice" FROM "SupportReceiptItem" WHERE "receiptId" = $1', [srcId]);
        for (const row of itemsRes.rows) {
          const newId = crypto.randomUUID();
          await client.query('INSERT INTO "SupportReceiptItem" ("id","receiptId","productName","buyingPrice","createdAt","updatedAt") VALUES ($1,$2,$3,$4,NOW(),NOW())', [newId, keeperId, row.productname || row.productName, row.buyingprice || row.buyingPrice]);
        }
        await client.query('UPDATE "SupportReceipt" SET "sellingTotal" = COALESCE("sellingTotal",0) + $1, "buyingTotal" = COALESCE("buyingTotal",0) + $2 WHERE "id" = $3', [op.srcSelling || 0, op.srcBuying || 0, keeperId]);
        const resKeeper = await client.query('SELECT "dailyEntryId" FROM "SupportReceipt" WHERE "id" = $1', [keeperId]);
        const resSrc = await client.query('SELECT "dailyEntryId" FROM "SupportReceipt" WHERE "id" = $1', [srcId]);
        if (resKeeper.rows[0] && (resKeeper.rows[0].dailyentryid || resKeeper.rows[0].dailyEntryId)) affectedEntryIds.add(resKeeper.rows[0].dailyentryid || resKeeper.rows[0].dailyEntryId);
        if (resSrc.rows[0] && (resSrc.rows[0].dailyentryid || resSrc.rows[0].dailyEntryId)) affectedEntryIds.add(resSrc.rows[0].dailyentryid || resSrc.rows[0].dailyEntryId);
        await client.query('DELETE FROM "SupportReceiptItem" WHERE "receiptId" = $1', [srcId]);
        await client.query('DELETE FROM "SupportReceipt" WHERE "id" = $1', [srcId]);
      }
    }

    // recompute totals
    if (recompute) {
      for (const entryId of Array.from(affectedEntryIds)) {
        // marketing
        const mAgg = await client.query('SELECT COALESCE(SUM("sellingTotal"),0) as sumSelling, COALESCE(SUM("buyingTotal"),0) as sumBuying FROM "MarketingReceipt" WHERE "dailyEntryId" = $1', [entryId]);
        if (mAgg.rows[0]) {
          const sumSelling = Number(mAgg.rows[0].sumselling || 0);
          const sumBuying = Number(mAgg.rows[0].sumbuying || 0);
          await client.query('UPDATE "MarketingDailyEntry" SET "totalSales" = $1, "totalProfit" = $2 WHERE "id" = $3', [sumSelling, sumSelling - sumBuying, entryId]);
        }
        // support
        const sAgg = await client.query('SELECT COALESCE(SUM("sellingTotal"),0) as sumSelling, COALESCE(SUM("buyingTotal"),0) as sumBuying FROM "SupportReceipt" WHERE "dailyEntryId" = $1', [entryId]);
        if (sAgg.rows[0]) {
          const sumSelling = Number(sAgg.rows[0].sumselling || 0);
          const sumBuying = Number(sAgg.rows[0].sumbuying || 0);
          await client.query('UPDATE "SupportDailyEntry" SET "totalSales" = $1, "totalProfit" = $2 WHERE "id" = $3', [sumSelling, sumSelling - sumBuying, entryId]);
        }
      }
    }

    await client.query('COMMIT');
    console.log('Merge applied successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error applying merge plan:', err);
    process.exitCode = 2;
  } finally {
    await client.end();
  }
}

main();
