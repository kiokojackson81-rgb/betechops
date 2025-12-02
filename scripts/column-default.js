const { Client } = require('pg');
(async ()=>{
  const conn = process.env.DATABASE_URL;
  const client = new Client({ connectionString: conn, ssl: { rejectUnauthorized: false } });
  await client.connect();
  const q = `SELECT column_name, column_default FROM information_schema.columns WHERE table_name='User' AND column_name='attendantCategory';`;
  const r = await client.query(q);
  console.table(r.rows);
  await client.end();
})();