const { Client } = require('pg');
const url = process.env.DATABASE_URL;
if (!url) { console.error('DATABASE_URL not set'); process.exit(2); }
(async () => {
  const c = new Client({ connectionString: url });
  await c.connect();
  try {
    const q = `SELECT id, createdat, data->'podDelivery' AS pod, data->'receiptNumber' AS rn FROM "Receipt" WHERE (data->'podDelivery') IS NOT NULL ORDER BY createdat DESC LIMIT 20;`;
    const res = await c.query(q);
    if (res.rows.length === 0) {
      console.log('No recent POD receipts found');
    } else {
      console.table(res.rows);
    }
  } catch (err) {
    console.error('Query failed:', err.message);
    process.exit(3);
  } finally { await c.end(); }
})();
