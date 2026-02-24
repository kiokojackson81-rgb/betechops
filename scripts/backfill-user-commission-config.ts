import { prisma } from "@/lib/prisma";
import { deriveDefaultCommissionConfigFromUser } from "@/lib/userCommissionConfig";

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, attendantCategory: true },
  });

  let created = 0;
  let skipped = 0;

  for (const user of users) {
    const existing = await prisma.userCommissionConfig.findUnique({ where: { userId: user.id } });
    if (existing) {
      skipped += 1;
      continue;
    }
    const derived = deriveDefaultCommissionConfigFromUser(user);
    await prisma.userCommissionConfig.create({
      data: {
        userId: user.id,
        ...derived,
      },
    });
    created += 1;
  }

  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ ok: true, totalUsers: users.length, created, skipped }));
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

