const { Client } = require('pg');
const url = process.env.DATABASE_URL || process.argv[2];
if (!url) {
  console.error('No DATABASE_URL provided. Set env var or pass as argument.');
  process.exit(1);
}

(async () => {
  const client = new Client({ connectionString: url });
  try {
    await client.connect();
    const q = `
      SELECT table_schema, table_name, column_name, ordinal_position
      FROM information_schema.columns
      WHERE lower(table_name) LIKE '%daily%'
      ORDER BY table_name, ordinal_position
    `;
    const res = await client.query(q);
    if (!res.rows.length) {
      console.log('No tables matched pattern "%daily%".');
      process.exit(0);
    }
    console.log('Found columns (table_schema, table_name, column_name, ordinal_position):');
    console.table(res.rows);
  } catch (err) {
    console.error('Query failed:');
    console.error(err);
    process.exit(1);
  } finally {
    await client.end();
  }
})();
