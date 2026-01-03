#!/usr/bin/env node
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const accountId = 'seed-test-account';

  // find a suitable attendant (ADMIN preferred)
  const user =
    (await prisma.user.findFirst({ where: { role: 'ADMIN' } })) ||
    (await prisma.user.findFirst({ where: { role: 'SUPERVISOR' } })) ||
    (await prisma.user.findFirst({}));

  if (!user) {
    console.error('No users found in DB to assign to.');
    process.exit(1);
  }

  const assignment = await prisma.marketplaceAccountAssignment.upsert({
    where: { id: `assign-${accountId}-${user.id}` },
    update: {},
    create: {
      id: `assign-${accountId}-${user.id}`,
      accountId,
      attendantId: user.id,
      role: 'JUMIA_KILIMALL_OPS',
    },
  });

  console.log('Assigned account', accountId, 'to user', user.email || user.id);
  console.log('Assignment id:', assignment.id);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
