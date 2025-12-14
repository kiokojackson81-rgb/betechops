#!/usr/bin/env node
require('dotenv').config();
const { Client } = require('pg');
(async () => {
  const DATABASE_URL = process.env.DATABASE_URL || process.env.DIRECT_URL;
  if (!DATABASE_URL) {
    console.error('DATABASE_URL or DIRECT_URL not set in environment.');
    process.exit(2);
  }

  const client = new Client({ connectionString: DATABASE_URL });
  try {
    await client.connect();
    const res = await client.query("SELECT table_schema, table_name FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog','information_schema') ORDER BY table_schema, table_name");
    console.log('tables:', JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error('Error listing tables:');
    console.error(err && err.message ? err.message : err);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
})();
