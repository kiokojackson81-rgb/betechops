const { Client } = require('pg');
const connection = process.env.DATABASE_URL;
if (!connection) {
  console.error('Please set DATABASE_URL');
  process.exit(2);
}

(async () => {
  const client = new Client({ connectionString: connection });
  try {
    await client.connect();
    const res = await client.query(`
      SELECT t.typname, array_agg(e.enumlabel ORDER BY e.enumsortorder) AS labels
      FROM pg_type t
      JOIN pg_enum e ON t.oid = e.enumtypid
      WHERE t.typname = 'attendantcategory' OR t.typname = 'AttendantCategory'
      GROUP BY t.typname
    `);
    if (res.rows.length === 0) {
      // try listing any types that look like AttendantCategory
      const alt = await client.query("SELECT t.typname, array_agg(e.enumlabel ORDER BY e.enumsortorder) AS labels FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid GROUP BY t.typname ORDER BY t.typname");
      console.log('No exact match for AttendantCategory; full enum list below (first 100 rows):');
      console.log(JSON.stringify(alt.rows.slice(0,100), null, 2));
    } else {
      console.log('Found enums:');
      console.log(JSON.stringify(res.rows, null, 2));
    }
  } catch (err) {
    console.error('Query failed:', err.message || err);
    process.exit(1);
  } finally {
    await client.end();
  }
})();
