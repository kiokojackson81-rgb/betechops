import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
(async () => {
  const rows = await prisma.marketplacePayoutWeek.findMany({
    where: { statementNumber: { in: ["PS251229KE12DBU","PS251229KE12DWN","PS251229KE12Y26","PS251229KE133G3","PS251229KE13ZAF","PS251229KE13LSZ","PS251229KE14JOD","PS251229KE13XZB"] } },
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
  console.log('total', rows.length);
  await prisma.$disconnect();
})();
