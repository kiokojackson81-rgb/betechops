const { Client } = require('pg');
(async ()=>{
  const conn = process.env.DATABASE_URL;
  const client = new Client({ connectionString: conn, ssl: { rejectUnauthorized: false } });
  await client.connect();
  const q = `SELECT table_name, column_name, column_default FROM information_schema.columns WHERE (table_name='User' AND column_name='attendantCategory') OR (table_name='AttendantActivity' AND column_name='category') OR (table_name='AttendantCategoryAssignment' AND column_name='category') ORDER BY table_name;`;
  const r = await client.query(q);
  console.table(r.rows);
  await client.end();
})();