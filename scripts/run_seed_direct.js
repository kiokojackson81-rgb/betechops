#!/usr/bin/env node
(async () => {
  try {
    require('dotenv').config();
    const fs = require('fs');
    const path = require('path');
    const { Client } = require('pg');

    const sqlPath = path.join(__dirname, 'seed_marketplace_accounts.sql');
    if (!fs.existsSync(sqlPath)) {
      console.error('Seed SQL file not found at', sqlPath);
      process.exit(2);
    }

    const DATABASE_URL = process.env.DATABASE_URL || process.env.DIRECT_URL;
    if (!DATABASE_URL) {
      console.error('DATABASE_URL or DIRECT_URL not set in environment.');
      process.exit(2);
    }

    const sql = fs.readFileSync(sqlPath, 'utf8');

    const client = new Client({ connectionString: DATABASE_URL });
    await client.connect();
    console.log('Connected to DB, executing seed...');

    try {
      const res = await client.query(sql);
      console.log('Seed script executed. Result:', res && res.command ? res.command : 'OK');
    } catch (err) {
      console.error('Error executing seed SQL:');
      console.error(err && err.message ? err.message : err);
      // Try to surface Postgres notices if present
      if (err && err.routine) console.error('Routine:', err.routine);
      process.exitCode = 1;
    } finally {
      await client.end();
    }
  } catch (e) {
    console.error('Fatal error:', e && e.message ? e.message : e);
    process.exit(2);
  }
})();
