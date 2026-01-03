#!/usr/bin/env node
const { Client } = require('pg');

function canonicalizeExpr() {
  // SQL expression to canonicalize receiptNumber: remove spaces/dashes and uppercase
  return "upper(regexp_replace(coalesce(r.\"receiptNumber\", ''), '\\s|-', '', 'g'))";
}

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL must be set');
    process.exit(2);
  }
  await client.connect();

  try {
    console.log('Adding receiptKey columns if missing...');
    await client.query('ALTER TABLE "MarketingReceipt" ADD COLUMN IF NOT EXISTS "receiptKey" text');
    await client.query('ALTER TABLE "SupportReceipt" ADD COLUMN IF NOT EXISTS "receiptKey" text');

    console.log('Populating receiptKey for MarketingReceipt (only when receiptNumber present)...');
    // clear receiptKey where no receiptNumber to avoid false duplicates
    await client.query(`UPDATE "MarketingReceipt" SET "receiptKey" = NULL WHERE coalesce(trim("receiptNumber"),'') = ''`);
    await client.query(
      `UPDATE "MarketingReceipt" r SET "receiptKey" = (
         upper(to_char(d.date, 'YYYY-MM-DD') || '_' || regexp_replace(coalesce(r."receiptNumber", ''), '\\s|-', '', 'g') || '_' || coalesce(r."paymentMethod"::text, 'MPESA'))
       ) FROM "MarketingDailyEntry" d WHERE r."dailyEntryId" = d.id AND (r."receiptKey" IS NULL OR r."receiptKey" = '') AND coalesce(trim(r."receiptNumber"),'') <> ''`
    );

    // clear receiptKey where no receiptNumber to avoid false duplicates
    await client.query(`UPDATE "SupportReceipt" SET "receiptKey" = NULL WHERE coalesce(trim("receiptNumber"),'') = ''`);
    await client.query(
      `UPDATE "SupportReceipt" r SET "receiptKey" = (
         upper(to_char(d.date, 'YYYY-MM-DD') || '_' || regexp_replace(coalesce(r."receiptNumber", ''), '\\s|-', '', 'g') || '_' || coalesce(r."paymentMethod"::text, 'MPESA'))
       ) FROM "SupportDailyEntry" d WHERE r."dailyEntryId" = d.id AND (r."receiptKey" IS NULL OR r."receiptKey" = '') AND coalesce(trim(r."receiptNumber"),'') <> ''`
    );

    console.log('Checking for duplicate receiptKey in MarketingReceipt...');
    const dupM = await client.query(
      `SELECT "receiptKey", count(*) FROM "MarketingReceipt" WHERE coalesce("receiptKey", '') <> '' GROUP BY "receiptKey" HAVING count(*) > 1`
    );
    if (dupM.rowCount > 0) {
      console.error('Found duplicate receiptKey values in MarketingReceipt (will not create unique index):');
      console.error(dupM.rows.slice(0, 20));
      await client.end();
      process.exit(3);
    }

    console.log('Checking for duplicate receiptKey in SupportReceipt...');
    const dupS = await client.query(
      `SELECT "receiptKey", count(*) FROM "SupportReceipt" WHERE coalesce("receiptKey", '') <> '' GROUP BY "receiptKey" HAVING count(*) > 1`
    );
    if (dupS.rowCount > 0) {
      console.error('Found duplicate receiptKey values in SupportReceipt (will not create unique index):');
      console.error(dupS.rows.slice(0, 20));
      await client.end();
      process.exit(4);
    }

    console.log('Checking for intra-entry duplicates (dailyEntryId, receiptNumber, paymentMethod) in MarketingReceipt...');
    const dupM2 = await client.query(
      `SELECT "dailyEntryId","receiptNumber","paymentMethod", count(*) FROM "MarketingReceipt" WHERE coalesce("receiptNumber", '') <> '' GROUP BY "dailyEntryId","receiptNumber","paymentMethod" HAVING count(*) > 1`
    );
    if (dupM2.rowCount > 0) {
      console.error('Found intra-entry duplicates in MarketingReceipt (will not create composite unique index):');
      console.error(dupM2.rows.slice(0, 20));
      await client.end();
      process.exit(5);
    }

    console.log('Checking for intra-entry duplicates in SupportReceipt...');
    const dupS2 = await client.query(
      `SELECT "dailyEntryId","receiptNumber","paymentMethod", count(*) FROM "SupportReceipt" WHERE coalesce("receiptNumber", '') <> '' GROUP BY "dailyEntryId","receiptNumber","paymentMethod" HAVING count(*) > 1`
    );
    if (dupS2.rowCount > 0) {
      console.error('Found intra-entry duplicates in SupportReceipt (will not create composite unique index):');
      console.error(dupS2.rows.slice(0, 20));
      await client.end();
      process.exit(6);
    }

    // Helper to check index existence
    async function indexExists(indexName) {
      const res = await client.query(`SELECT 1 FROM pg_class WHERE relkind = 'i' AND relname = $1`, [indexName]);
      return res.rowCount > 0;
    }

    console.log('Creating unique indexes concurrently where missing...');

    // Marketing receiptKey unique index
    if (!(await indexExists('uniq_marketing_receipt_receiptkey')) ) {
      console.log('Creating uniq_marketing_receipt_receiptkey');
      await client.query('CREATE UNIQUE INDEX CONCURRENTLY uniq_marketing_receipt_receiptkey ON "MarketingReceipt" ("receiptKey")');
    } else {
      console.log('Index uniq_marketing_receipt_receiptkey already exists');
    }

    // Support receiptKey unique index
    if (!(await indexExists('uniq_support_receipt_receiptkey')) ) {
      console.log('Creating uniq_support_receipt_receiptkey');
      await client.query('CREATE UNIQUE INDEX CONCURRENTLY uniq_support_receipt_receiptkey ON "SupportReceipt" ("receiptKey")');
    } else {
      console.log('Index uniq_support_receipt_receiptkey already exists');
    }

    // Composite unique indexes (names from Prisma schema)
    if (!(await indexExists('uniq_marketing_receipt_in_entry')) ) {
      console.log('Creating uniq_marketing_receipt_in_entry');
      await client.query('CREATE UNIQUE INDEX CONCURRENTLY uniq_marketing_receipt_in_entry ON "MarketingReceipt" ("dailyEntryId","receiptNumber","paymentMethod")');
    } else {
      console.log('Index uniq_marketing_receipt_in_entry already exists');
    }

    if (!(await indexExists('uniq_support_receipt_in_entry')) ) {
      console.log('Creating uniq_support_receipt_in_entry');
      await client.query('CREATE UNIQUE INDEX CONCURRENTLY uniq_support_receipt_in_entry ON "SupportReceipt" ("dailyEntryId","receiptNumber","paymentMethod")');
    } else {
      console.log('Index uniq_support_receipt_in_entry already exists');
    }

    console.log('Done.');
    await client.end();
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    try { await client.end(); } catch (e) {}
    process.exit(2);
  }
}

main();
