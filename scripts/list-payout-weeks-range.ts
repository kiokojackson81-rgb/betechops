import 'dotenv/config';
import { prisma } from '../src/lib/prisma.ts';

async function main() {
  const now = new Date();
  const start = new Date(now.getTime() - 90 * 24 * 3600 * 1000);

  const rows = await prisma.marketplacePayoutWeek.findMany({
    where: {
      AND: [
        { weekStart: { gte: start } },
        { weekStart: { lte: now } },
        { account: { platform: 'JUMIA' } },
      ],
    },
    include: { account: true },
    orderBy: { weekStart: 'desc' },
    take: 1000,
  });

  console.log('Found', rows.length, 'JUMIA payout week rows between', start.toISOString(), 'and', now.toISOString());
  for (const r of rows.slice(0, 200)) {
    console.log(r.id, r.account?.displayName ?? r.accountId, r.weekStart?.toISOString(), '->', r.weekEnd?.toISOString(), 'stmt:', r.statementNumber, 'gross:', String(r.grossSales), 'payout:', String(r.payoutAmount), 'paid:', r.isPaid);
  }

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); prisma.$disconnect().catch(()=>{}); process.exit(1); });
