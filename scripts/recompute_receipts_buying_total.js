const { PrismaClient } = require('@prisma/client');

async function run({ from, to, dryRun = false }) {
  const prisma = new PrismaClient();
  try {
    const receipts = await prisma.supportReceipt.findMany({
      where: {
        AND: [
          { createdAt: { gte: new Date(from) } },
          { createdAt: { lte: new Date(to) } },
        ],
      },
      select: { id: true, receiptNumber: true },
    });
    console.log(`Found ${receipts.length} support receipts between ${from} and ${to}`);
    let updated = 0;
    for (const r of receipts) {
      const items = await prisma.supportReceiptItem.findMany({ where: { receiptId: r.id }, select: { id: true, buyingPrice: true } });
      const sum = items.reduce((s, it) => s + Number(it.buyingPrice ?? 0), 0);
      const current = await prisma.supportReceipt.findUnique({ where: { id: r.id }, select: { buyingTotal: true } });
      if (!current) continue;
      if (Number(current.buyingTotal ?? 0) !== sum) {
        console.log(`Receipt ${r.receiptNumber || r.id}: buyingTotal ${current.buyingTotal} -> ${sum}`);
        if (!dryRun) {
          await prisma.supportReceipt.update({ where: { id: r.id }, data: { buyingTotal: sum } });
        }
        updated++;
      }
    }
    console.log(`Processed ${receipts.length} receipts, updated ${updated} rows (dryRun=${dryRun})`);
  } catch (err) {
    console.error('ERROR', err);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  const argv = require('minimist')(process.argv.slice(2));
  const from = argv.from || argv.f || (new Date('2025-12-12T00:00:00+03:00')).toISOString();
  const to = argv.to || argv.t || (new Date('2025-12-12T23:59:59.999+03:00')).toISOString();
  const dryRun = argv['dry-run'] || argv.dry || false;
  run({ from, to, dryRun }).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
