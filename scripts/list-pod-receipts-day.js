const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
  const day = process.argv[2] || '2026-02-01';
  console.log('Listing POD-related receipts for day:', day);

  // Find receipts with pay_on_delivery in data or receipt_number variants for that day
  const rows = await prisma.$queryRaw`
    SELECT id, "receipt_number", "generatedAt", data->'podDelivery' AS pod
    FROM "Receipt"
    WHERE (data::text ILIKE ${`%pay_on_delivery%`} OR "receipt_number" ILIKE ${`%${day.replace(/-/g, '')}%`})
      AND "generatedAt"::date = ${day}::date
    ORDER BY "generatedAt" ASC
    LIMIT 200
  `;

  if (!Array.isArray(rows) || rows.length === 0) {
    console.log('No POD-related receipts found for', day);
    await prisma.$disconnect();
    return;
  }

  console.log('Found', rows.length, 'receipts:');
  for (const r of rows) {
    const pod = r.pod ?? null;
    console.log('---');
    console.log('id:', r.id);
    console.log('receipt_number:', r.receipt_number);
    console.log('generatedAt:', r.generatedAt);
    console.log('podDelivery present:', pod ? 'YES' : 'NO');
    if (pod) console.dir(pod, { depth: 2 });
  }

  await prisma.$disconnect();
}

main().catch((e) => { console.error('Script failed:', e && e.message ? e.message : e); process.exitCode = 1; });
