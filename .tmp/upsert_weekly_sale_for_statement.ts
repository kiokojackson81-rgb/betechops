import { PrismaClient, WeeklySaleSource, WeeklySaleStatus } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const stmt = process.argv[2] || 'PS251229KE12DBU';
  console.log('Locating MarketplacePayoutWeek for', stmt);
  const rows = await prisma.marketplacePayoutWeek.findMany({ where: { statementNumber: stmt } });
  if (!rows.length) {
    console.log('No payout rows found for', stmt);
    process.exit(0);
  }
  for (const r of rows) {
    const shopId = r.accountId; // shops were created with id == account.id in earlier runs
    const platform = 'JUMIA' as any;
    const weekStart = new Date(r.weekStart);
    const weekEnd = new Date(r.weekEnd);
    const amount = Number(r.payoutAmount ?? r.grossSales ?? 0);
    console.log('Upserting WeeklySale for shop', shopId, 'week', weekStart.toISOString().slice(0,10), '->', weekEnd.toISOString().slice(0,10), 'amount', amount);

    try {
      const res = await prisma.weeklySale.upsert({
        where: { shopId_platform_weekStart_weekEnd: { shopId, platform, weekStart, weekEnd } },
        create: {
          shopId,
          platform,
          weekStart,
          weekEnd,
          amount,
          userId: null,
          status: WeeklySaleStatus.PENDING,
          source: WeeklySaleSource.AUTOMATIC,
          createdBy: null,
        },
        update: { amount },
      });
      console.log('WeeklySale upserted id=', res.id);
    } catch (err) {
      console.error('Failed upserting WeeklySale', err);
    }
  }
}

main().catch(e => { console.error(e); process.exit(1); });
