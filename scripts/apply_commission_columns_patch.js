#!/usr/bin/env node
/*
  Apply the `prisma/post_deploy_add_commission_columns.sql` patch to the DB referenced
  by `DATABASE_URL` environment variable or a provided CLI argument.

  Usage:
    $env:DATABASE_URL = "postgresql://..."; node scripts/apply_commission_columns_patch.js
    or
    node scripts/apply_commission_columns_patch.js "postgresql://..."
*/
const fs = require('fs');
const { Client } = require('pg');
const path = require('path');

async function main() {
  const sqlPath = path.join(__dirname, '../prisma/post_deploy_add_commission_columns.sql');
  if (!fs.existsSync(sqlPath)) {
    console.error('SQL patch not found at', sqlPath);
    process.exit(2);
  }

  const sql = fs.readFileSync(sqlPath, 'utf8');
  const dbUrl = process.argv[2] || process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('No DATABASE_URL provided. Set env var or pass as first argument.');
    process.exit(3);
  }

  const client = new Client({ connectionString: dbUrl });
  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('Applying CommissionLedger patch...');
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('Patch applied successfully.');
  } catch (err) {
    console.error('Error applying patch:', err && err.message ? err.message : err);
    try { await client.query('ROLLBACK'); } catch (e) { /* ignore */ }
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main();
