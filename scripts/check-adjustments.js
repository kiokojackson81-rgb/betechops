const { PrismaClient } = require('@prisma/client');

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error('Usage: node check-adjustments.js <email>');
    process.exit(2);
  }
  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return console.log('User not found', email);
    const adjustments = await prisma.attendantPayrollAdjustment.findMany({ where: { attendantId: user.id }, orderBy: { createdAt: 'desc' } });
    console.log('Found', adjustments.length, 'adjustments for', email);
    for (const a of adjustments) console.log(a);
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
