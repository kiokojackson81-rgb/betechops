#!/usr/bin/env node
/**
 * Ensure prisma.shop contains the real Jumia shops and deactivate legacy placeholders.
 */
const { PrismaClient, Platform } = require("@prisma/client");

const TARGET_SHOPS = [
  { id: "c897dcd1-5a4d-4d68-80ff-e8fda74f79e4", name: "Betech Store" },
  { id: "1951e826-57f2-4d6a-99ad-67b5139d8aca", name: "Hitech Power" },
  { id: "5497640c-3f51-4777-82fa-fc1c92dc588b", name: "JUDE COLLECTIONS" },
  { id: "29e1f2ad-b898-4d11-b3df-ab3dda5755fc", name: "Betech Solar Solution" },
  { id: "a4f06613-3271-4846-8b25-43b2bc093a80", name: "Sky Store Ke" },
  { id: "07ee95b2-acb7-4436-b98f-d8ce30d0c518", name: "Maxton Enterprise" },
  { id: "45fd7334-a7db-4f49-ba60-347096fd818e", name: "LabTech Kenya" },
];

async function main() {
  const prisma = new PrismaClient();
  try {
    const wantedIds = TARGET_SHOPS.map((s) => s.id);
    const wantedSet = new Set(wantedIds);

    for (const shop of TARGET_SHOPS) {
      await prisma.shop.upsert({
        where: { id: shop.id },
        update: {
          name: shop.name,
          platform: Platform.JUMIA,
          isActive: true,
        },
        create: {
          id: shop.id,
          name: shop.name,
          platform: Platform.JUMIA,
          isActive: true,
        },
      });
    }

    const extras = await prisma.shop.findMany({
      where: {
        platform: Platform.JUMIA,
        NOT: { id: { in: wantedIds } },
      },
      select: { id: true, name: true, isActive: true },
    });

    let deactivated = 0;
    for (const extra of extras) {
      if (extra.isActive) {
        await prisma.shop.update({
          where: { id: extra.id },
          data: { isActive: false },
        });
        deactivated += 1;
      }
    }

    console.log(
      JSON.stringify(
        {
          synced: TARGET_SHOPS.length,
          deactivated,
          leftoverInactive: extras.length - deactivated,
        },
        null,
        2,
      ),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("Error fixing Jumia shops:", err);
  process.exit(1);
});
