import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

function parseCsvArg(flag: string) {
  const raw = process.argv.find((value) => value.startsWith(`${flag}=`));
  if (!raw) return [];
  return raw
    .slice(flag.length + 1)
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

async function main() {
  const ids = parseCsvArg("--ids");
  const emails = parseCsvArg("--emails").map((value) => value.toLowerCase());
  const apply = process.argv.includes("--apply");

  if (!ids.length && !emails.length) {
    throw new Error("Pass --ids=id1,id2 or --emails=user@example.com");
  }

  const orFilters: Prisma.UserWhereInput[] = [];
  if (ids.length) orFilters.push({ id: { in: ids } });
  if (emails.length) orFilters.push({ email: { in: emails } });

  const users = await prisma.user.findMany({
    where: { OR: orFilters },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      attendantCategory: true,
      agentProfile: { select: { id: true } },
      categoryAssignments: { select: { category: true } },
    },
  });

  if (!users.length) {
    console.log("No matching users found.");
    return;
  }

  console.table(
    users.map((user) => ({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      attendantCategory: user.attendantCategory,
      categoryAssignments: user.categoryAssignments.map((item) => item.category).join(", "),
      agentProfile: Boolean(user.agentProfile),
    })),
  );

  if (!apply) {
    console.log("Dry run only. Re-run with --apply to remove attendant markers.");
    return;
  }

  await prisma.$transaction(async (tx) => {
    for (const user of users) {
      await tx.attendantCategoryAssignment.deleteMany({ where: { userId: user.id } });
      await tx.user.update({
        where: { id: user.id },
        data: {
          attendantCategory: null,
        },
      });
    }
  });

  console.log(`Removed attendant markers from ${users.length} user(s).`);
}

main()
  .catch((error) => {
    console.error("[reclassify-nonstaff-attendants] failed", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => undefined);
  });
