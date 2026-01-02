const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const emails = [
    'seed.attendant@local',
    'seed.attendant2@local',
    'seed.attendant3@local',
  ];

  console.log('Will attempt to remove seed attendants and related seed data for:', emails.join(', '));

  for (const email of emails) {
    // Use raw SQL lookup to avoid Prisma model/database schema mismatches
    let res;
    try {
      res = await prisma.$queryRaw`SELECT id FROM "User" WHERE email = ${email} LIMIT 1`;
    } catch (e) {
      console.warn('Raw lookup failed for email', email, e.message || e);
      res = [];
    }
    if (!Array.isArray(res) || res.length === 0) {
      console.log('User not found, skipping:', email);
      continue;
    }
    const id = res[0].id;
    console.log('Removing data for user:', email, id);

    // Delete commission ledgers and payroll adjustments
    await prisma.commissionLedger.deleteMany({ where: { userId: id } }).catch(() => {});
    await prisma.attendantPayrollAdjustment.deleteMany({ where: { attendantId: id } }).catch(() => {});
    await prisma.attendantCompPlan.deleteMany({ where: { attendantId: id } }).catch(() => {});

    // Delete marketing entries + receipts submitted by this user
    const marketingEntries = await prisma.marketingDailyEntry.findMany({ where: { submittedById: id }, select: { id: true } });
    const marketingEntryIds = marketingEntries.map((e) => e.id);
    if (marketingEntryIds.length) {
      await prisma.marketingReceipt.deleteMany({ where: { dailyEntryId: { in: marketingEntryIds } } }).catch(() => {});
      await prisma.marketingDailyEntry.deleteMany({ where: { id: { in: marketingEntryIds } } }).catch(() => {});
    }

    // Delete support entries + receipts submitted by this user
    const supportEntries = await prisma.supportDailyEntry.findMany({ where: { submittedById: id }, select: { id: true } });
    const supportEntryIds = supportEntries.map((e) => e.id);
    if (supportEntryIds.length) {
      await prisma.supportReceipt.deleteMany({ where: { dailyEntryId: { in: supportEntryIds } } }).catch(() => {});
      await prisma.supportDailyEntry.deleteMany({ where: { id: { in: supportEntryIds } } }).catch(() => {});
    }

    // Delete orders and receipts where this user is the attendant or issuer
    const orders = await prisma.order.findMany({ where: { attendantId: id }, select: { id: true } });
    const orderIds = orders.map((o) => o.id);
    if (orderIds.length) {
      await prisma.receipt.deleteMany({ where: { orderId: { in: orderIds } } }).catch(() => {});
      await prisma.order.deleteMany({ where: { id: { in: orderIds } } }).catch(() => {});
    }

    // Also delete receipts issuedBy this user (if any)
    await prisma.receipt.deleteMany({ where: { issuedById: id } }).catch(() => {});

    // Clean up any marketplace/week/payouts linked to this attendant
    await prisma.marketplacePayoutWeek.deleteMany({ where: { accountId: { in: [] } } }).catch(() => {});

    // Finally delete the user
    await prisma.user.delete({ where: { id } }).catch((e) => {
      console.error('Failed to delete user', email, e.message || e);
    });

    console.log('Deleted seed user and related data for:', email);
  }

  console.log('Done.');
}

main()
  .catch((e) => {
    console.error('Script failed:', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
