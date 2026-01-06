#!/usr/bin/env ts-node
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  console.log("normalize_jumia_accounts_and_assignments: starting");
  const now = new Date();

  // Find all jumia shopSids that have more than one MarketplaceAccount row
  const groups: Array<{ jumiaShopSid: string; count: number }> = await prisma.$queryRawUnsafe(
    `SELECT "jumiaShopSid", COUNT(*) FROM "MarketplaceAccount" WHERE platform = 'JUMIA' AND "jumiaShopSid" IS NOT NULL GROUP BY "jumiaShopSid" HAVING COUNT(*) >= 1;`,
  );

  for (const g of groups) {
    const sid = g.jumiaShopSid;
    if (!sid) continue;

    // Load accounts for this sid, prefer active ones and newest updated
    const accounts: Array<any> = await prisma.$queryRawUnsafe(
      `SELECT id, "isActive", "displayName", "updatedAt" FROM "MarketplaceAccount" WHERE platform = 'JUMIA' AND "jumiaShopSid" = $1 ORDER BY "isActive" DESC, "updatedAt" DESC;`,
      sid,
    );
    if (accounts.length === 0) continue;

    const canonical = accounts[0];
    const duplicates = accounts.slice(1);

    for (const dup of duplicates) {
      // Move active assignments from duplicate to canonical
      const assignments: Array<any> = await prisma.$queryRawUnsafe(
        `SELECT id, "attendantId", role, "startsAt", "endsAt" FROM "MarketplaceAccountAssignment" WHERE "accountId" = $1;`,
        dup.id,
      );

      for (const a of assignments) {
        // Check if canonical already has same attendant+role active
        const exists: Array<any> = await prisma.$queryRawUnsafe(
          `SELECT 1 FROM "MarketplaceAccountAssignment" WHERE "accountId" = $1 AND "attendantId" = $2 AND role = $3 LIMIT 1;`,
          canonical.id,
          a.attendantId,
          a.role,
        );
        if (exists.length === 0) {
          // Insert assignment for canonical with same dates
          await prisma.$executeRawUnsafe(
            `INSERT INTO "MarketplaceAccountAssignment" ("accountId","attendantId",role,"startsAt","endsAt","createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,now(),now());`,
            canonical.id,
            a.attendantId,
            a.role,
            a.startsAt,
            a.endsAt,
          );
        }
        // Close assignment on duplicate (set endsAt to now) if still active
        if (!a.endsAt || new Date(a.endsAt) > now) {
          await prisma.$executeRawUnsafe(`UPDATE "MarketplaceAccountAssignment" SET "endsAt" = $1, "updatedAt" = now() WHERE id = $2;`, now, a.id);
        }
      }

      // Deactivate duplicate account
      await prisma.$executeRawUnsafe(`UPDATE "MarketplaceAccount" SET "isActive" = false, "updatedAt" = now() WHERE id = $1;`, dup.id);
      console.log(`disabled duplicate account ${dup.id} (sid=${sid})`);
    }
  }

  console.log("normalize_jumia_accounts_and_assignments: done");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
