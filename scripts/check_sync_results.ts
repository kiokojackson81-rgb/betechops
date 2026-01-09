import 'dotenv/config';

async function main() {
  const { prisma } = await import('../src/lib/prisma');

  const payoutPlaceholders = await prisma.marketplacePayoutWeek.count({
    where: { statementNumber: { startsWith: 'AUTO:' } },
  });

  const totalAccounts = await prisma.marketplaceAccount.count({ where: { platform: 'JUMIA' } });

  const weeklyAuto = await prisma.weeklySale.count({ where: { source: 'AUTOMATIC' } });
  const weeklyManual = await prisma.weeklySale.count({ where: { source: 'MANUAL' } });

  const dupProfit: any = await prisma.$queryRaw`
    SELECT "marketplaceOrderId", type, count(*) as cnt
    FROM "ProfitEvent"
    GROUP BY "marketplaceOrderId", type
    HAVING count(*) > 1
  `;

  console.log('MarketplaceAccount (JUMIA) count:', totalAccounts);
  console.log('MarketplacePayoutWeek AUTO placeholders:', payoutPlaceholders);
  console.log('WeeklySale AUTOMATIC count:', weeklyAuto);
  console.log('WeeklySale MANUAL count:', weeklyManual);
  console.log('Duplicate ProfitEvent rows (marketplaceOrderId,type,count):', JSON.stringify(dupProfit, null, 2));

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
