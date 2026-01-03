const { PrismaClient } = require('@prisma/client');

async function main() {
  const email = process.argv[2] || 'brendah@betech.co.ke';
  const prisma = new PrismaClient();
  try {
    const u = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (!u) {
      console.error('NOT_FOUND');
      process.exitCode = 2;
      return;
    }
    console.log(u.id);
  } catch (e) {
    console.error('ERROR', e);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
