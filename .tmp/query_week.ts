import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
(async () => {
  const rows = await prisma.marketplacePayoutWeek.findMany({
    where: {
      weekStart: { gte: new Date('2025-12-29T00:00:00.000Z'), lt: new Date('2026-01-05T00:00:00.000Z') },
    },
    include: { account: true },
  });
  rows.forEach((r) => {
    console.log({
      id: r.id,
      statement: r.statementNumber,
      weekStart: r.weekStart.toISOString(),
      weekEnd: r.weekEnd.toISOString(),
      account: r.account?.displayName,
    });
  });
  await prisma.$disconnect();
})();
