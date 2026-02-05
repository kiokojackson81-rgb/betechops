import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const stmt = process.argv[2] || 'PS251229KE12DBU';
  console.log('Searching for statementNumber =', stmt);
  const rows = await prisma.marketplacePayoutWeek.findMany({
    where: { statementNumber: stmt },
    orderBy: { weekStart: 'desc' },
  });
  if (!rows.length) {
    console.log('No rows found by statementNumber. Searching by payoutAmount ~424086.62');
    const alt = await prisma.marketplacePayoutWeek.findMany({
      where: { payoutAmount: { equals: 424086.62 } },
      orderBy: { weekStart: 'desc' },
    });
    if (!alt.length) {
      console.log('No rows found by exact payoutAmount. Searching by approximate grossSales');
      const approx = await prisma.marketplacePayoutWeek.findMany({
        where: { grossSales: { gte: 424086.6, lte: 424086.7 } },
      });
      if (!approx.length) {
        console.log('No approximate matches found.');
        process.exit(0);
      }
      for (const r of approx) console.log(JSON.stringify(r, null, 2));
      process.exit(0);
    }
    for (const r of alt) console.log(JSON.stringify(r, null, 2));
    process.exit(0);
  }

  for (const r of rows) {
    // print key fields plus rawPayload
    console.log('---');
    console.log('id:', r.id);
    console.log('accountId:', r.accountId);
    console.log('statementNumber:', r.statementNumber);
    console.log('payoutAmount:', r.payoutAmount);
    console.log('grossSales:', r.grossSales);
    console.log('weekStart:', r.weekStart);
    console.log('weekEnd:', r.weekEnd);
    console.log('rawPayload:');
    console.log(JSON.stringify(r.rawPayload, null, 2));
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
