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
    const patterns = ['%email%', '%phone%', '%login%', '%username%', '%user_email%', '%contact%'];
    const q = `
      SELECT table_schema, table_name, column_name, data_type
      FROM information_schema.columns
      WHERE ${patterns.map((p,i)=>`column_name ILIKE $${i+1}`).join(' OR ')}
      ORDER BY table_schema, table_name, column_name
    `;
    const res = await client.query(q, patterns);
    if (res.rows.length === 0) {
      console.log('No identity-like columns found.');
    } else {
      console.log('Identity-like columns found:');
      console.log(JSON.stringify(res.rows, null, 2));
    }
  } catch (err) {
    console.error('Error querying information_schema:', err && err.message ? err.message : err);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
})();
