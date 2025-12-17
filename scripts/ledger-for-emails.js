const { PrismaClient } = require('@prisma/client');
const emails = process.argv.slice(2);

(async () => {
  const prisma = new PrismaClient();
  try {
    for (const email of emails) {
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        console.log(`User not found: ${email}`);
        continue;
      }
      console.log(`User ${email} id=${user.id}`);
      const rows = await prisma.commissionLedger.findMany({ where: { userId: user.id }, orderBy: [{ periodStart: 'desc' }], take: 5 });
      if (!rows || rows.length === 0) {
        console.log(`No CommissionLedger rows for ${email}`);
      } else {
        console.log(`CommissionLedger rows for ${email}:`);
        rows.forEach((r) => console.log({ id: r.id, periodStart: r.periodStart, periodEnd: r.periodEnd, commissionTotal: r.commissionTotal, grossCommission: r.grossCommission, netCommission: r.netCommission }));
      }
    }
  } catch (e) {
    console.error('error', e);
    process.exitCode = 2;
  } finally {
    await prisma.$disconnect();
  }
})();
