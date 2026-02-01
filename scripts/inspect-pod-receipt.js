const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error('Usage: node scripts/inspect-pod-receipt.js <receiptNumberOrIdFragment>');
    process.exit(2);
  }
  const q = `%${arg}%`;
  try {
    const rows = await prisma.$queryRaw`
      SELECT r.id, r.data, r.totals, o."orderNumber" as order_number
      FROM "Receipt" r
      LEFT JOIN "Order" o ON r."orderId" = o.id
      WHERE o."orderNumber" ILIKE ${q}
         OR r.id ILIKE ${q}
         OR (r.data::text ILIKE ${q})
      LIMIT 20
    `;

    if (!rows || rows.length === 0) {
      console.log('No matching receipts found for', arg);
      process.exit(0);
    }

    for (const r of rows) {
      const pod = r.data && r.data.podDelivery ? r.data.podDelivery : null;
      const receiptNumber = r.order_number || (r.data && r.data.receiptNumber) || null;
      console.log('----');
      console.log('id:', r.id);
      console.log('receiptNumber:', receiptNumber);
      console.log('totals:', r.totals);
      console.log('podDelivery:', JSON.stringify(pod, null, 2));
    }
  } catch (err) {
    console.error('Query failed', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
