#!/usr/bin/env node
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');

  console.log(`Mode=${apply ? 'APPLY' : 'DRY-RUN'}`);

  // Collect marketing receipt identifiers (receiptKey or receiptNumber)
  const marketing = await prisma.marketingReceipt.findMany({ select: { id: true, receiptKey: true, receiptNumber: true } });
  const keySet = new Set();
  for (const m of marketing) {
    if (m.receiptKey) keySet.add(String(m.receiptKey));
    if (m.receiptNumber) keySet.add(String(m.receiptNumber));
  }
  const keys = Array.from(keySet);
  console.log('Marketing receipts indexed:', keys.length);

  if (keys.length === 0) {
    console.log('No marketing keys found, nothing to do.');
    await prisma.$disconnect();
    return;
  }

  // Find support rows that match any marketing receiptKey/receiptNumber
  const supportRows = await prisma.supportReceipt.findMany({
    where: {
      OR: [
        { receiptKey: { in: keys } },
        { receiptNumber: { in: keys } },
      ],
    },
    select: { id: true, receiptKey: true, receiptNumber: true, sellingTotal: true, paymentMethod: true, createdAt: true, dailyEntryId: true },
    orderBy: { createdAt: 'desc' },
  });

  console.log('Support rows matching marketing keys:', supportRows.length);
  if (supportRows.length === 0) {
    await prisma.$disconnect();
    return;
  }

  const sample = supportRows.slice(0, 20);
  console.log('Sample rows to remove:');
  sample.forEach((r) => console.log(r));

  if (!apply) {
    console.log('Dry-run complete. Re-run with --apply to delete these support rows.');
    await prisma.$disconnect();
    return;
  }

  // Backup support rows to JSON file before deletion
  const backupsDir = path.join(process.cwd(), 'backups');
  if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true });
  const now = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(backupsDir, `support-duplicates-backup-${now}.json`);
  fs.writeFileSync(backupPath, JSON.stringify(supportRows, null, 2), 'utf8');
  console.log('Backup written to', backupPath);

  // Perform deletion in a transaction for safety
  const ids = supportRows.map((r) => r.id);
  console.log('Deleting', ids.length, 'support rows...');
  await prisma.$transaction(async (tx) => {
    // chunk deletes to avoid large query issues
    const chunkSize = 200;
    for (let i = 0; i < ids.length; i += chunkSize) {
      const chunk = ids.slice(i, i + chunkSize);
      await tx.supportReceipt.deleteMany({ where: { id: { in: chunk } } });
    }
  });

  console.log('Deletion complete. Deleted rows:', ids.length);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
