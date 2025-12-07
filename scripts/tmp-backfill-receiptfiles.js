// scripts/tmp-backfill-receiptfiles.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Temporary backfill (receiptfiles) started');

  // ensure Receipt table exists
  const tableExists = await prisma.$queryRawUnsafe(
    `SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name = 'Receipt' LIMIT 1`
  );
  if (!tableExists || tableExists.length === 0) {
    console.log('Receipt table not present - skipping.');
    return;
  }

  // Select receipts with non-null data
  const receipts = await prisma.$queryRawUnsafe(`SELECT id, data FROM "Receipt" WHERE data IS NOT NULL`);
  let created = 0;
  for (const r of receipts) {
    // r.data may be returned as string or object depending on driver
    let data = r.data;
    if (typeof data === 'string') {
      try { data = JSON.parse(data); } catch (e) { continue; }
    }
    if (data && data.fileUrl) {
      try {
        await prisma.receiptFile.create({ data: { receiptId: r.id, url: data.fileUrl, contentType: 'application/pdf', uploadedBy: data.issuedById ?? null } });
        created++;
      } catch (e) {
        // ignore duplicates or errors
      }
    }
  }

  console.log(`Temporary receiptfile backfill complete. Created ${created} ReceiptFile records.`);
}

main().then(() => prisma.$disconnect()).catch(async (err) => { console.error(err); await prisma.$disconnect(); process.exit(1); });
