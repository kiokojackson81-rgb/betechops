const { Client } = require('pg');

const SHOP_SQL = `DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'Shop') THEN
    ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "jumiaShopSid" TEXT;
    IF NOT EXISTS (
      SELECT 1 FROM pg_class WHERE relname = 'shop_platform_jumiasid_unique'
    ) THEN
      CREATE UNIQUE INDEX shop_platform_jumiasid_unique ON "Shop" ("platform", "jumiaShopSid");
    END IF;
  END IF;
END$$;`;

async function main() {
  const databaseUrl = process.env.DATABASE_URL || process.env.DIRECT_URL;
  if (!databaseUrl) {
    console.error('Missing DATABASE_URL or DIRECT_URL in environment.');
    process.exit(2);
  }
  const client = new Client({ connectionString: databaseUrl });
  try {
    await client.connect();
    console.log('Connected to DB. Applying Shop.jumiaShopSid SQL...');
    await client.query('BEGIN');
    await client.query(SHOP_SQL);
    await client.query('COMMIT');
    console.log('Shop.jumiaShopSid column and index ensured.');
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    console.error('Error applying Shop SQL:', err && err.message ? err.message : err);
    process.exit(3);
  } finally {
    await client.end();
  }
}

if (require.main === module) main();
