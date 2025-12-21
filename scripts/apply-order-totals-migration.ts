/*
 * Idempotent application of JumiaOrder totals columns in case Prisma migration did not run on target DB.
 */
export {};
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { prisma: prismaApplyOrderTotals } = require('../src/lib/prisma.ts');

async function ensureColumns() {
  // Check if column exists via information_schema
  const rows: Array<{ column_name: string }> = await prismaApplyOrderTotals.$queryRawUnsafe(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'JumiaOrder' AND column_name IN ('totalAmountLocalCurrency','totalAmountLocalValue')`
  );
  const haveCurrency = rows.some(r => r.column_name === 'totalAmountLocalCurrency');
  const haveValue = rows.some(r => r.column_name === 'totalAmountLocalValue');
  if (haveCurrency && haveValue) {
    console.log('[apply-migration] Columns already present, nothing to do');
    return;
  }
  console.log('[apply-migration] Applying ALTER TABLE to add missing columns');
  await prismaApplyOrderTotals.$executeRawUnsafe(`ALTER TABLE "JumiaOrder" ADD COLUMN IF NOT EXISTS "totalAmountLocalCurrency" TEXT`);
  await prismaApplyOrderTotals.$executeRawUnsafe(`ALTER TABLE "JumiaOrder" ADD COLUMN IF NOT EXISTS "totalAmountLocalValue" DOUBLE PRECISION`);
  console.log('[apply-migration] Columns ensured');
}

ensureColumns()
  .catch(err => {
    console.error('[apply-migration] fatal', err);
    process.exitCode = 1;
  })
  .finally(() => prismaApplyOrderTotals.$disconnect());
