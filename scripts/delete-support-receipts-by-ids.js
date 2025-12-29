const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const ids = ['cmjpj4uxw0008jv0464aj7gc6', 'cmjpj380s0009l604cern9bi6'];
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('Set DATABASE_URL env var');
  process.exit(2);
}

(async () => {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    // Check if SupportReceipt table exists
    const tblRes = await client.query("SELECT to_regclass('public.\"SupportReceipt\"') as exists");
    if (!tblRes.rows[0].exists) {
      console.error('SupportReceipt table not found in database; aborting');
      return;
    }

    // Select rows
    const sel = await client.query('SELECT * FROM "SupportReceipt" WHERE id = ANY($1)', [ids]);
    console.log('Found rows:', sel.rowCount);

    const backupDir = path.join(__dirname, '..', 'backups');
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
    const backupFile = path.join(backupDir, `deleted-support-receipts-${Date.now()}.json`);
    fs.writeFileSync(backupFile, JSON.stringify(sel.rows, null, 2));
    console.log('Backed up rows to', backupFile);

    if (sel.rowCount === 0) {
      console.log('No matching rows to delete');
      return;
    }

    // Delete rows
    const del = await client.query('DELETE FROM "SupportReceipt" WHERE id = ANY($1) RETURNING id', [ids]);
    console.log('Deleted rows:', del.rowCount);
    del.rows.forEach(r => console.log('Deleted id', r.id));
  } catch (e) {
    console.error('Operation failed:', e.message || e);
  } finally {
    await client.end();
  }
})();
