const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Backfilling disableAutoSync on shops where missing...');

  // Set disableAutoSync = false for any rows where column exists but is NULL
  try {
    await prisma.$executeRawUnsafe(`UPDATE "Shop" SET "disableAutoSync" = false WHERE "disableAutoSync" IS NULL;`);
    console.log('Backfill completed.');
  } catch (e) {
    console.error('Backfill failed (column may not exist yet):', e.message || e);
    process.exitCode = 1;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
