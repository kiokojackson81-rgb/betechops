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
    console.log('Connected — inspecting columns for table Attendant...');
    const cols = await client.query(
      `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'Attendant' ORDER BY ordinal_position`
    );
    console.log('Columns:', JSON.stringify(cols.rows, null, 2));

    const desired = ['id', 'email', 'name', 'attendantCategory', 'isActive', 'createdAt'];
    const present = cols.rows.map(r => r.column_name);
    const selectCols = desired.filter(c => present.includes(c));
    if (selectCols.length === 0) {
      console.error('None of the desired columns present on Attendant — falling back to SELECT * LIMIT 5');
      const any = await client.query('SELECT * FROM "Attendant" LIMIT 5');
      console.log('Sample rows:', JSON.stringify(any.rows, null, 2));
    } else {
      const q = `SELECT ${selectCols.map(c=>"\""+c+"\"").join(', ')} FROM "Attendant" WHERE email IN ('benjamin@betech.co.ke','stephen@betech.co.ke')`;
      const res = await client.query(q);
      console.log('Matched rows:', JSON.stringify(res.rows, null, 2));
    }
  } catch (err) {
    console.error('Error inspecting Attendant:');
    console.error(err && err.message ? err.message : err);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
})();
