const { Client } = require('pg');

const conn = process.env.DATABASE_URL;
if (!conn) {
  console.error('No DATABASE_URL set');
  process.exit(2);
}

(async () => {
  const client = new Client({ connectionString: conn });
  try {
    await client.connect();
    const res = await client.query(
      "SELECT table_schema, table_name, column_name FROM information_schema.columns WHERE column_name = 'attendantCategory';"
    );
    console.log('Found columns:', res.rows);
    process.exit(0);
  } catch (e) {
    console.error('Query failed:', e);
    process.exit(1);
  } finally {
    try {
      await client.end();
    } catch (_) {}
  }
})();
