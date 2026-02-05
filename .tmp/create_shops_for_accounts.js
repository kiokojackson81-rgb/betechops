const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    // Find marketplace accounts that have no Shop with id == account.id
    const accounts = await prisma.marketplaceAccount.findMany({ where: { platform: 'JUMIA', isActive: true } });
    let created = 0;
    for (const a of accounts) {
      const shop = await prisma.shop.findUnique({ where: { id: a.id } });
      if (shop) continue;
      const name = a.displayName ?? `Shop ${a.id.slice(0,8)}`;
      try {
        await prisma.shop.create({ data: { id: a.id, name, platform: 'JUMIA', isActive: true } });
        console.log('Created Shop:', a.id, name);
        created++;
      } catch (err) {
        console.warn('Failed creating shop for account', a.id, String(err));
      }
    }
    console.log('Created shops:', created);
    await prisma.$disconnect();
  } catch (err) {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  }
})();
