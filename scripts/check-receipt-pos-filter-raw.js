const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const id = process.argv[2];
  if (!id) {
    console.error('Usage: node scripts/check-receipt-pos-filter-raw.js <receiptId>');
    process.exit(2);
  }
  try {
    const rows = await prisma.$queryRaw`
      SELECT
        r.id,
        r.data->'podDelivery' IS NULL AS pod_is_null,
        (r.data->'podDelivery'->>'status') = 'pending' AS status_is_pending,
        r.data->'podDelivery'->>'status' AS status_text
      FROM "Receipt" r
      WHERE r.id = ${id}
      LIMIT 1
    `;

    console.log(rows);
  } catch (err) {
    console.error('Raw query failed', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
