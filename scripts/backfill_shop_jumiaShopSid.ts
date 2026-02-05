#!/usr/bin/env ts-node
import { Platform } from "@prisma/client";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  console.log("backfill_shop_jumiaShopSid: starting");

  const accounts: Array<any> = await prisma.$queryRawUnsafe(
    `SELECT id, "displayName", "isActive", "jumiaShopSid" FROM "MarketplaceAccount" WHERE platform = 'JUMIA' AND "jumiaShopSid" IS NOT NULL ORDER BY "updatedAt" DESC;`,
  );

  let created = 0;
  let linked = 0;
  let skipped = 0;
  const problems: string[] = [];

  for (const acct of accounts) {
    const sid = acct.jumiaShopSid as string;
    if (!sid) continue;

    // 1) Prefer an existing Shop that already has this jumiaShopSid
    const existingBySid: any[] = await prisma.$queryRawUnsafe(
      `SELECT id FROM "Shop" WHERE platform = 'JUMIA' AND "jumiaShopSid" = $1 LIMIT 1;`,
      sid,
    );
    if (existingBySid) {
      // already present; nothing to do
      linked++;
      continue;
    }

    // 2) Try a one-time name-based match when the Shop has no jumiaShopSid
    if (acct.displayName) {
      const nameKey = acct.displayName.trim().toLowerCase();
      const nameMatches: Array<any> = await prisma.$queryRawUnsafe(
        `SELECT id, name FROM "Shop" WHERE platform = 'JUMIA' AND name IS NOT NULL AND "jumiaShopSid" IS NULL;`,
      );
      const exactMatches = nameMatches.filter((s) => (s.name ?? "").trim().toLowerCase() === nameKey);
      if (exactMatches.length === 1) {
        const shop = exactMatches[0];
        try {
          await prisma.$executeRawUnsafe(`UPDATE "Shop" SET "jumiaShopSid" = $1 WHERE id = $2;`, sid, shop.id);
          linked++;
          continue;
        } catch (err) {
          problems.push(`failed to link account ${acct.id} -> shop ${shop.id}: ${String(err)}`);
          skipped++;
          continue;
        }
      } else if (exactMatches.length > 1) {
        problems.push(`ambiguous name matches for account ${acct.id} name='${acct.displayName}' -> ${exactMatches.map((s) => s.id).join(",")}`);
        skipped++;
        continue;
      }
    }

    // 3) No existing shop found — create a new Shop record with jumiaShopSid set
    try {
      const name = acct.displayName ?? `JUMIA-${sid}`;
      await prisma.$executeRawUnsafe(
        `INSERT INTO "Shop" (name, platform, "jumiaShopSid", "isActive", "createdAt", "updatedAt") VALUES ($1, 'JUMIA', $2, $3, now(), now());`,
        name,
        sid,
        acct.isActive ?? true,
      );
      created++;
    } catch (err) {
      problems.push(`failed to create shop for account ${acct.id} sid=${sid}: ${String(err)}`);
      skipped++;
    }
  }

  console.log(`backfill_shop_jumiaShopSid: done — processed=${accounts.length} created=${created} linked=${linked} skipped=${skipped}`);
  if (problems.length) {
    console.warn("Problems:", problems.slice(0, 50));
  }
}

main()
  .catch((err) => {
    console.error("backfill_shop_jumiaShopSid: fatal", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
