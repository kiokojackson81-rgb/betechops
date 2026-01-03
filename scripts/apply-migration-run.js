const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Starting safe migration apply...');
  // 1) Create a lightweight backup table (in same DB) if not exists
  try {
    console.log('Creating backup table shop_backup if not exists...');
    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'shop_backup') THEN
          CREATE TABLE shop_backup AS TABLE "Shop" WITH NO DATA;
        END IF;
      END$$;
    `);
    // Copy data into backup (append) to ensure snapshot
    await prisma.$executeRawUnsafe(`INSERT INTO shop_backup SELECT * FROM "Shop";`);
    console.log('Backup table created and data copied to shop_backup.');
  } catch (e) {
    console.error('Backup step failed:', e.message || e);
    throw e;
  }

  // 2) Apply non-destructive schema change: add column if not exists
  try {
    console.log('Altering Shop table to add disableAutoSync column if missing...');
    await prisma.$executeRawUnsafe('ALTER TABLE IF EXISTS "Shop" ADD COLUMN IF NOT EXISTS "disableAutoSync" boolean DEFAULT false;');
    console.log('ALTER TABLE executed.');
  } catch (e) {
    console.error('ALTER TABLE failed:', e.message || e);
    throw e;
  }

  // 3) Backfill NULL values to false
  try {
    console.log('Backfilling NULL disableAutoSync values to false...');
    const res = await prisma.$executeRawUnsafe('UPDATE "Shop" SET "disableAutoSync" = false WHERE "disableAutoSync" IS NULL;');
    console.log('Backfill executed.');
  } catch (e) {
    console.error('Backfill failed:', e.message || e);
    throw e;
  }

  console.log('Migration apply completed successfully.');
}

main()
  .catch((e) => {
    console.error('Migration apply encountered an error:', e.message || e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
