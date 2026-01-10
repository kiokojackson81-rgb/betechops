const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main(){
  try{
    // Check existence using information_schema to avoid regclass deserialization
    const res = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int as cnt FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'WeeklySale'`);
    const exists = res && res[0] && Number(res[0].cnt) > 0;
    if (exists) {
      console.log('WeeklySale table already exists; nothing to do.');
      return;
    }
    console.log('Creating WeeklySale table...');
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "WeeklySale" (
        "id" TEXT PRIMARY KEY,
        "shopId" TEXT,
        "userId" TEXT,
        "weekStart" timestamptz NOT NULL,
        "weekEnd" timestamptz NOT NULL,
        "amount" numeric(12,2) NOT NULL,
        "platform" TEXT NOT NULL DEFAULT 'JUMIA',
        "source" TEXT NOT NULL DEFAULT 'AUTOMATIC',
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        "status" TEXT NOT NULL DEFAULT 'PENDING',
        "createdBy" TEXT,
        "approvedBy" TEXT
      );
    `);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "WeeklySale_shopId_weekStart_idx" ON "WeeklySale"("shopId", "weekStart");`);
    await prisma.$executeRawUnsafe(`ALTER TABLE IF EXISTS "WeeklySale" ADD CONSTRAINT IF NOT EXISTS "WeeklySale_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE SET NULL ON UPDATE CASCADE;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE IF EXISTS "WeeklySale" ADD CONSTRAINT IF NOT EXISTS "WeeklySale_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;`);
    console.log('WeeklySale table created.');
  } catch(e){
    console.error('Failed to create WeeklySale:', e.message || e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
