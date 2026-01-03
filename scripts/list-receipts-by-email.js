const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2] || 'stephen@betech.co.ke';
  console.log('Looking up receipts for', email);

  const userRes = await prisma.$queryRaw`
    SELECT id, name, email FROM "User" WHERE email = ${email} LIMIT 1
  `;
  if (!Array.isArray(userRes) || userRes.length === 0) {
    console.log('No user found for', email);
    return;
  }
  const user = userRes[0];
  const uid = user.id;

  const receipts = await prisma.$queryRaw`
    SELECT r.id, r.receipt_number AS receipt_number, r."generatedAt",
      COALESCE((r.totals->>'total')::numeric, 0) AS total,
      COALESCE(jsonb_array_length(r.data->'items'), 0) AS items_count,
      o."attendantId" AS order_attendant
    FROM "Receipt" r
    LEFT JOIN "Order" o ON r."orderId" = o.id
    WHERE o."attendantId" = ${uid}
       OR r."issuedById" = ${uid}
       OR (r.data->>'attendantId') = ${uid}
    ORDER BY r."generatedAt" DESC
  `;

  if (!Array.isArray(receipts) || receipts.length === 0) {
    console.log('No receipts found for user', email);
    return;
  }

  let totalSales = 0;
  let totalItems = 0;
  receipts.forEach((r) => {
    totalSales += Number(r.total || 0);
    totalItems += Number(r.items_count || 0);
  });

  console.log('Summary:');
  console.log(`- User: ${user.name || user.email} (${user.id})`);
  console.log(`- Receipts: ${receipts.length} · Items: ${totalItems}`);
  console.log(`- Total sales (sum of receipt totals): KES ${totalSales.toLocaleString()}`);
  console.log('');

  console.log('Receipts:');
  receipts.forEach((r) => {
    console.log(`- ${r.receipt_number} | Date: ${r.generatedAt} | Items: ${r.items_count} | Total: KES ${Number(r.total || 0).toLocaleString()}`);
  });
}

main()
  .catch((e) => {
    console.error('Failed:', e.message || e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
