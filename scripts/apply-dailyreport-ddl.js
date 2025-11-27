require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const statements = [
    `CREATE TABLE IF NOT EXISTS \"DailyReport\" (
      \"id\" TEXT NOT NULL,
      \"date\" TIMESTAMP(3) NOT NULL,
      \"userId\" TEXT,
      \"productsCount\" INTEGER NOT NULL,
      \"totalSales\" DECIMAL(12,2) NOT NULL,
      \"createdAt\" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \"updatedAt\" TIMESTAMP(3) NOT NULL,
      CONSTRAINT \"DailyReport_pkey\" PRIMARY KEY (\"id\")
    );`,
    `DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'DailyReport_date_idx') THEN
        CREATE INDEX \"DailyReport_date_idx\" ON \"DailyReport\"(\"date\");
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'DailyReport_userId_idx') THEN
        CREATE INDEX \"DailyReport_userId_idx\" ON \"DailyReport\"(\"userId\");
      END IF;
    END$$;`,
    `DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='DailyReport' AND column_name='day') THEN
        ALTER TABLE \"DailyReport\" ADD COLUMN \"day\" TEXT DEFAULT 'MONDAY';
        ALTER TABLE \"DailyReport\" ALTER COLUMN \"day\" SET NOT NULL;
        ALTER TABLE \"DailyReport\" ALTER COLUMN \"day\" DROP DEFAULT;
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='DailyReport' AND column_name='tasks') THEN
        ALTER TABLE \"DailyReport\" ADD COLUMN \"tasks\" JSONB;
      END IF;
    END$$;`,
  ];

  console.log('Applying DDL to ensure DailyReport table exists...');
  for (const s of statements) {
    await prisma.$executeRawUnsafe(s);
  }
  // conditionally add FK only if User table exists
  const userTable = await prisma.$queryRawUnsafe("SELECT 1 FROM pg_class WHERE relname = 'User'");
  if (userTable && userTable.length > 0) {
    await prisma.$executeRawUnsafe(`DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DailyReport_userId_fkey') THEN
        ALTER TABLE \"DailyReport\" ADD CONSTRAINT \"DailyReport_userId_fkey\" FOREIGN KEY (\"userId\") REFERENCES \"User\"(\"id\") ON DELETE SET NULL ON UPDATE CASCADE;
      END IF;
    END$$;`);
    console.log('Foreign key to User applied.');
  } else {
    console.log('User table not found — skipping foreign key creation.');
  }
  console.log('DDL applied.');
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
