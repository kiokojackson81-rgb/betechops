#!/usr/bin/env node
const { Client } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || process.argv[2];
if (!DATABASE_URL) {
  console.error('Usage: DATABASE_URL=... node scripts/apply_pos_product_columns.js');
  process.exit(1);
}

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    console.log('Connected to DB. Locating product table...');
    const tblRes = await client.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND (LOWER(table_name) = 'product' OR table_name = 'Product') LIMIT 1;`
    );
    if (tblRes.rowCount === 0) {
      console.error('Product table not found in public schema. Aborting.');
      return;
    }
    const tableName = tblRes.rows[0].table_name;
    console.log('Found product table:', tableName);

    const quoteIdent = (s) => (/[^a-z0-9_]/i.test(s) || s !== s.toLowerCase()) ? '"' + s.replace(/"/g, '""') + '"' : s;
    const t = quoteIdent(tableName);

    // 1) create enum if not exists
    const createEnumSQL = `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'buyingpricetype') THEN CREATE TYPE "BuyingPriceType" AS ENUM ('FIXED','VARIABLE'); END IF; END $$;`;
    console.log('Ensuring enum BuyingPriceType exists...');
    await client.query(createEnumSQL);

    // Helper to add column if not exists
    async function addColumnIfNotExists(colName, colType, defaultClause) {
      const existsRes = await client.query(
        `SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 AND column_name=$2 LIMIT 1;`,
        [tableName, colName.toLowerCase()]
      );
      if (existsRes.rowCount > 0) {
        console.log(`Column ${colName} already exists on ${tableName}`);
        return;
      }
      const def = defaultClause ? ` DEFAULT ${defaultClause}` : '';
      const sql = `ALTER TABLE ${t} ADD COLUMN IF NOT EXISTS "${colName}" ${colType}${def};`;
      console.log('Running:', sql);
      await client.query(sql);
      console.log(`Added column ${colName}`);
    }

    // Add columns conservatively
    await addColumnIfNotExists('sku', 'text', null);
    await addColumnIfNotExists('category', 'text', `'pos'`);
    await addColumnIfNotExists('lastBuyingPrice', 'double precision', null);
    await addColumnIfNotExists('buyingPriceType', '"BuyingPriceType"', `'FIXED'`);
    await addColumnIfNotExists('isActive', 'boolean', 'true');

    console.log('Done. You may want to backfill `sku` and add constraints (unique, not null) later.');
  } catch (err) {
    console.error('Error during migration:', err);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main();
