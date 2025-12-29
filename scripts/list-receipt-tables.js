const { Client } = require('pg');
(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const r = await client.query("select tablename from pg_tables where schemaname='public' and tablename ilike '%receipt%';");
    console.log(JSON.stringify(r.rows, null, 2));
  } catch (e) {
    console.error('query failed', e.message || e);
  } finally {
    await client.end();
  }
})();
