const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function main() {
  const databaseUrl = process.env.DATABASE_URL || process.env.DIRECT_URL;
  if (!databaseUrl) {
    console.error('Missing DATABASE_URL or DIRECT_URL in environment.');
    process.exit(2);
  }

  const sqlPath = path.join(__dirname, '..', 'prisma', 'sync_missing_receipt_and_shop.sql');
  if (!fs.existsSync(sqlPath)) {
    console.error('SQL file not found:', sqlPath);
    process.exit(3);
  }

  const sql = fs.readFileSync(sqlPath, 'utf8');

  const client = new Client({ connectionString: databaseUrl });
  try {
    await client.connect();
    console.log('Connected to DB. Executing SQL from', sqlPath);
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('SQL executed successfully.');
    process.exit(0);
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    console.error('Error executing SQL:', err && err.message ? err.message : err);
    process.exit(4);
  } finally {
    await client.end();
  }
}

if (require.main === module) main();
