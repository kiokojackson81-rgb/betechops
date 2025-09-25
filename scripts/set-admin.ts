import { prisma } from "../src/lib/prisma";

async function main() {
  await prisma.user.upsert({
    where: { email: "kiokojackson81@gmail.com" },
    update: { role: "ADMIN" },
    create: { email: "kiokojackson81@gmail.com", role: "ADMIN", name: "Admin" },
  });
  console.log("Admin ensured.");
}

main().finally(() => process.exit(0));
