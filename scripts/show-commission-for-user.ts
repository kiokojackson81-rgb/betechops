import 'dotenv/config';
import { prisma } from '../src/lib/prisma.ts';
import { getTradingPeriodFor } from '../src/lib/tradingPeriod.ts';

async function main() {
  const userId = process.argv[2] || 'cmimxqfnr0005v5mc05nwhg9o';
  const period = getTradingPeriodFor(new Date());

  console.log('Querying commissionLedger for userId:', userId);
  console.log('Period:', period.label, period.start.toISOString(), '->', period.end.toISOString());

  const rows = await prisma.commissionLedger.findMany({
    where: {
      userId,
      periodStart: period.start,
      periodEnd: period.end,
    },
  });

  if (rows.length === 0) {
    console.log('No commission ledger rows found for this user/period.');
  } else {
    for (const r of rows) {
      console.log('--- ledger id:', r.id);
      console.log('grossCommission:', r.grossCommission);
      console.log('netCommission:', r.netCommission);
      console.log('detail:', JSON.stringify(r.detail, null, 2));
    }
  }

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
