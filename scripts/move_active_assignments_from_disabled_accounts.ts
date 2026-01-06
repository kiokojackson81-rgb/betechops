#!/usr/bin/env ts-node
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  console.log('move_active_assignments_from_disabled_accounts: starting');
  const now = new Date();

  // Find disabled JUMIA accounts that have active (endsAt IS NULL) assignments
  const rows: Array<any> = await prisma.$queryRawUnsafe(
    `SELECT a.id as accountId, a."jumiaShopSid", a."displayName", maa.id as assignId, maa."attendantId", maa.role FROM "MarketplaceAccount" a JOIN "MarketplaceAccountAssignment" maa ON maa."accountId" = a.id WHERE a.platform = 'JUMIA' AND a."isActive" = false AND maa."endsAt" IS NULL;`
  );

  for (const r of rows) {
    const sid = r.jumiaShopSid;
    if (!sid) continue;
    // find canonical active account for this sid
    const canonical: Array<any> = await prisma.$queryRawUnsafe(
      `SELECT id FROM "MarketplaceAccount" WHERE platform = 'JUMIA' AND "jumiaShopSid" = $1 AND "isActive" = true LIMIT 1;`,
      sid,
    );
    if (canonical.length === 0) {
      console.warn(`no canonical active account for sid=${sid}; skipping assignment ${r.assignId}`);
      continue;
    }
    const canonicalId = canonical[0].id;

    // check if canonical has same attendant+role active
    const exists: Array<any> = await prisma.$queryRawUnsafe(
      `SELECT 1 FROM "MarketplaceAccountAssignment" WHERE "accountId" = $1 AND "attendantId" = $2 AND role = $3 AND ("endsAt" IS NULL OR "endsAt" > now()) LIMIT 1;`,
      canonicalId,
      r.attendantId,
      r.role,
    );
    if (exists.length === 0) {
      // create assignment on canonical with startsAt = original startsAt (best-effort copy)
      const orig: Array<any> = await prisma.$queryRawUnsafe(
        `SELECT "startsAt", "endsAt" FROM "MarketplaceAccountAssignment" WHERE id = $1 LIMIT 1;`,
        r.assignId,
      );
      const startsAt = orig[0]?.startsAt ?? now;
      await prisma.$executeRawUnsafe(
        `INSERT INTO "MarketplaceAccountAssignment" ("accountId","attendantId",role,"startsAt","endsAt","createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,now(),now());`,
        canonicalId,
        r.attendantId,
        r.role,
        startsAt,
        null,
      );
      console.log(`moved attendant ${r.attendantId} role ${r.role} to canonical account ${canonicalId} for sid ${sid}`);
    }

    // close the old assignment (set endsAt = now)
    await prisma.$executeRawUnsafe(`UPDATE "MarketplaceAccountAssignment" SET "endsAt" = $1, "updatedAt" = now() WHERE id = $2;`, now, r.assignId);
    console.log(`closed old assignment ${r.assignId} on account ${r.accountId}`);
  }

  console.log('move_active_assignments_from_disabled_accounts: done');
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });
