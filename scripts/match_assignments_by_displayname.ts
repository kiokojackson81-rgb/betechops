#!/usr/bin/env ts-node
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  console.log('match_assignments_by_displayname: starting');
  const now = new Date();

  const disabledAccounts: Array<any> = await prisma.$queryRawUnsafe(
    `SELECT id, "displayName", "jumiaShopSid" FROM "MarketplaceAccount" WHERE platform = 'JUMIA' AND "isActive" = false;`
  );

  for (const da of disabledAccounts) {
    const nameKey = (da.displayName ?? '').trim().toLowerCase();
    if (!nameKey) continue;
    const canon: Array<any> = await prisma.$queryRawUnsafe(
      `SELECT id FROM "MarketplaceAccount" WHERE platform = 'JUMIA' AND LOWER(TRIM("displayName")) = $1 AND "isActive" = true LIMIT 1;`,
      nameKey,
    );
    if (canon.length === 0) continue;
    const canonicalId = canon[0].id;

    const activeAssigns: Array<any> = await prisma.$queryRawUnsafe(
      `SELECT id, "attendantId", role, "startsAt" FROM "MarketplaceAccountAssignment" WHERE "accountId" = $1 AND ("endsAt" IS NULL OR "endsAt" > now());`,
      da.id,
    );
    for (const a of activeAssigns) {
      const exists: Array<any> = await prisma.$queryRawUnsafe(
        `SELECT 1 FROM "MarketplaceAccountAssignment" WHERE "accountId" = $1 AND "attendantId" = $2 AND role::text = $3 AND ("endsAt" IS NULL OR "endsAt" > now()) LIMIT 1;`,
        canonicalId,
        a.attendantId,
        String(a.role),
      );
      if (exists.length === 0) {
        await prisma.$executeRawUnsafe(
          `INSERT INTO "MarketplaceAccountAssignment" ("accountId","attendantId",role,"startsAt","endsAt","createdAt","updatedAt") VALUES ($1,$2,$3::"MarketplaceAssignmentRole",$4,$5,now(),now());`,
          canonicalId,
          a.attendantId,
          String(a.role),
          a.startsAt ?? now,
          null,
        );
        console.log(`assigned attendant ${a.attendantId} role ${a.role} -> canonical ${canonicalId} (by name match)`);
      }
      await prisma.$executeRawUnsafe(`UPDATE "MarketplaceAccountAssignment" SET "endsAt" = $1, "updatedAt" = now() WHERE id = $2;`, now, a.id);
      console.log(`closed old assignment ${a.id} on disabled account ${da.id}`);
    }
  }

  console.log('match_assignments_by_displayname: done');
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });
