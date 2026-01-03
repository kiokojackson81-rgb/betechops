const { Client } = require('pg');
const c = new Client({ connectionString: process.env.DATABASE_URL });
(async () => {
  try {
    await c.connect();
    const res = await c.query("SELECT table_schema, table_name, column_name FROM information_schema.columns WHERE table_name ILIKE 'receipt' ORDER BY table_schema, table_name, ordinal_position;");
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (e) {
    console.error('ERR', e);
  } finally {
    await c.end();
  }
})();
