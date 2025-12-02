const { Client } = require('pg');
(async ()=>{
  const conn = process.env.DATABASE_URL;
  const client = new Client({ connectionString: conn, ssl: { rejectUnauthorized: false } });
  await client.connect();
  const q = `SELECT coalesce("attendantCategory"::text, 'NULL') AS category, COUNT(*) FROM "User" GROUP BY "attendantCategory" ORDER BY category;`;
  const r = await client.query(q);
  console.table(r.rows);
  await client.end();
})();