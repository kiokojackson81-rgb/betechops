import { prisma } from '../src/lib/prisma';
import { Prisma } from '@prisma/client';

async function main() {
  console.log('Scanning receipts for existing fileUrl in receipt.data...');
  const receipts = await prisma.receipt.findMany({ where: { data: { not: Prisma.JsonNull } }, select: { id: true, data: true } });
  let created = 0;
  for (const r of receipts) {
    const data = r.data as any;
    if (data?.fileUrl) {
      try {
        await prisma.receiptFile.create({ data: { receiptId: r.id, url: data.fileUrl, contentType: 'application/pdf', uploadedBy: data.issuedById ?? null } });
        created++;
      } catch (e) {
        // ignore
      }
    }
  }
  console.log(`Backfill complete. Created ${created} ReceiptFile records.`);
}

main().catch((err) => { console.error(err); process.exit(1); });
