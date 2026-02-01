const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
  const needle = process.argv[2];
  if (!needle) {
    console.error('Usage: node search-receipt-broad.js <receiptId|orderNumber|fragment>');
    process.exit(2);
  }
  console.log('Searching for:', needle);
  const like = `%${needle}%`;

  const rows = await prisma.$queryRaw`
    SELECT id, "receipt_number", data->>'customerPhone' AS phone, data as data
    FROM "Receipt"
    WHERE id = ${needle} OR "receipt_number" = ${needle} OR data::text ILIKE ${like}
    LIMIT 20
  `;

  if (!Array.isArray(rows) || rows.length === 0) {
    console.log('No receipts matched search:', needle);
    await prisma.$disconnect();
    return;
  }

  console.log('Matches:', rows.length);
  for (const r of rows) {
    console.log('---');
    console.log('id:', r.id);
    console.log('receipt_number:', r.receipt_number);
    console.log('phone (data.customerPhone):', r.phone);
    const pod = r.data && r.data.podDelivery ? r.data.podDelivery : null;
    console.log('podDelivery present:', pod ? 'YES' : 'NO');
    if (pod) console.dir(pod, { depth: 2 });
  }

  await prisma.$disconnect();
}

main().catch((e) => { console.error('Script failed:', e && e.message ? e.message : e); process.exitCode = 1; });
