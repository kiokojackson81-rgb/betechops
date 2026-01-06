#!/usr/bin/env ts-node
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  console.log("ensure_shop_jumiaShopSid_sql: ensuring column and index exist");
  // Add column if missing
  await prisma.$executeRawUnsafe(`ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "jumiaShopSid" text;`);
  // Add unique index on (platform, jumiaShopSid) — Postgres allows multiple NULLs
  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "shop_platform_jumiaShopSid_unique" ON "Shop" ("platform", "jumiaShopSid");`,
  );
  console.log("ensure_shop_jumiaShopSid_sql: done");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
