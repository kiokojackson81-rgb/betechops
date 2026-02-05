import fs from "fs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // ensure archive table exists
  await prisma.$executeRawUnsafe(
    'CREATE TABLE IF NOT EXISTS "MarketplaceAccount_archive" (LIKE "MarketplaceAccount" INCLUDING ALL)'
  );

  const rows: { id: string; displayName: string; jumiaShopSid: string | null }[] =
    (await prisma.$queryRawUnsafe(
      `SELECT id, "displayName", "jumiaShopSid" FROM "MarketplaceAccount" WHERE platform = 'JUMIA' AND "isActive" = false ORDER BY "updatedAt" DESC`
    )) as any;

  const report: any[] = [];

  for (const r of rows) {
    const q1 = (await prisma.$queryRawUnsafe(
      `SELECT count(*) AS cnt FROM "MarketplaceAccountAssignment" WHERE "accountId" = '${r.id}'`
    )) as any;
    const q2 = (await prisma.$queryRawUnsafe(`SELECT count(*) AS cnt FROM "MarketplaceOrder" WHERE "accountId" = '${r.id}'`)) as any;
    const q3 = (await prisma.$queryRawUnsafe(`SELECT count(*) AS cnt FROM "MarketplacePayoutWeek" WHERE "accountId" = '${r.id}'`)) as any;
    const q4 = (await prisma.$queryRawUnsafe(`SELECT count(*) AS cnt FROM "MarketplaceReturn" WHERE "accountId" = '${r.id}'`)) as any;
    const q5 = (await prisma.$queryRawUnsafe(`SELECT count(*) AS cnt FROM "ApiCredential" WHERE scope = 'MARKETPLACE_ACCOUNT:${r.id}'`)) as any;

    const deps = {
      assignments: Number(q1?.[0]?.cnt ?? 0),
      orders: Number(q2?.[0]?.cnt ?? 0),
      payoutWeeks: Number(q3?.[0]?.cnt ?? 0),
      returns: Number(q4?.[0]?.cnt ?? 0),
      apiCredentials: Number(q5?.[0]?.cnt ?? 0),
    };

    const safeToDelete = Object.values(deps).every((c) => Number(c) === 0);

    if (!safeToDelete) {
      report.push({ id: r.id, displayName: r.displayName, jumiaShopSid: r.jumiaShopSid, deps, deleted: false, reason: "has_dependent_rows" });
      continue;
    }

    // archive then delete inside a transaction
    try {
      await prisma.$executeRawUnsafe(`BEGIN`);
      await prisma.$executeRawUnsafe(
        `INSERT INTO "MarketplaceAccount_archive" SELECT * FROM "MarketplaceAccount" WHERE id='${r.id}' AND NOT EXISTS (SELECT 1 FROM "MarketplaceAccount_archive" WHERE id='${r.id}')`
      );
      await prisma.$executeRawUnsafe(`DELETE FROM "MarketplaceAccount" WHERE id='${r.id}'`);
      await prisma.$executeRawUnsafe(`COMMIT`);
      report.push({ id: r.id, displayName: r.displayName, jumiaShopSid: r.jumiaShopSid, deps, deleted: true });
    } catch (err) {
      try {
        await prisma.$executeRawUnsafe(`ROLLBACK`);
      } catch (e) {}
      report.push({ id: r.id, displayName: r.displayName, jumiaShopSid: r.jumiaShopSid, deps, deleted: false, reason: String(err) });
    }
  }

  const out = { generatedAt: new Date().toISOString(), processed: rows.length, report };
  fs.writeFileSync('.tmp/deleted_disabled_jumia_accounts.json', JSON.stringify(out, null, 2));
  console.log('Done. Report written to .tmp/deleted_disabled_jumia_accounts.json');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Script failed', err);
    process.exit(1);
  });
