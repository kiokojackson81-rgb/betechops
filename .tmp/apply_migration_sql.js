const fs = require('fs');
const { Client } = require('pg');

async function main() {
  const file = process.argv[2] || 'prisma/migrations/20260105_add_unique_statement_week/migration.sql';
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }
  const sql = fs.readFileSync(file, 'utf8');
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    console.log('Connected to DB, executing migration:', file);
    await client.query(sql);
    console.log('Migration executed successfully');
  } catch (err) {
    console.error('Migration failed:', err.message || err);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main();
