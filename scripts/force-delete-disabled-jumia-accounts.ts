import fs from "fs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(
    'CREATE TABLE IF NOT EXISTS "MarketplaceAccount_archive" (LIKE "MarketplaceAccount" INCLUDING ALL)'
  );

  const rows: { id: string; displayName: string; jumiaShopSid: string | null }[] =
    (await prisma.$queryRawUnsafe(
      `SELECT id, "displayName", "jumiaShopSid" FROM "MarketplaceAccount" WHERE platform = 'JUMIA' AND "isActive" = false ORDER BY "updatedAt" DESC`
    )) as any;

  const report: any[] = [];

  for (const r of rows) {
    try {
      await prisma.$executeRawUnsafe(`BEGIN`);
      // Archive account if not already archived
      await prisma.$executeRawUnsafe(
        `INSERT INTO "MarketplaceAccount_archive" SELECT * FROM "MarketplaceAccount" WHERE id='${r.id}' AND NOT EXISTS (SELECT 1 FROM "MarketplaceAccount_archive" WHERE id='${r.id}')`
      );

      // Collect order ids
      const ordersRes: any = await prisma.$queryRawUnsafe(
        `SELECT id FROM "MarketplaceOrder" WHERE "accountId" = '${r.id}'`
      );
      const orderIds: string[] = Array.isArray(ordersRes) ? ordersRes.map((o: any) => o.id) : [];

      // Delete profit events for those orders
      if (orderIds.length) {
        const ids = orderIds.map((id) => `'${id}'`).join(",");
        await prisma.$executeRawUnsafe(`DELETE FROM "ProfitEvent" WHERE "marketplaceOrderId" IN (${ids})`);
      }

      // Delete returns tied to account
      await prisma.$executeRawUnsafe(`DELETE FROM "MarketplaceReturn" WHERE "accountId" = '${r.id}'`);

      // Delete payout weeks
      await prisma.$executeRawUnsafe(`DELETE FROM "MarketplacePayoutWeek" WHERE "accountId" = '${r.id}'`);

      // Delete marketplace orders
      await prisma.$executeRawUnsafe(`DELETE FROM "MarketplaceOrder" WHERE "accountId" = '${r.id}'`);

      // Delete assignments
      await prisma.$executeRawUnsafe(`DELETE FROM "MarketplaceAccountAssignment" WHERE "accountId" = '${r.id}'`);

      // Delete api credentials scoped to this account
      await prisma.$executeRawUnsafe(`DELETE FROM "ApiCredential" WHERE scope = 'MARKETPLACE_ACCOUNT:${r.id}'`);

      // Finally delete the account itself
      await prisma.$executeRawUnsafe(`DELETE FROM "MarketplaceAccount" WHERE id='${r.id}'`);

      await prisma.$executeRawUnsafe(`COMMIT`);
      report.push({ id: r.id, displayName: r.displayName, jumiaShopSid: r.jumiaShopSid, deleted: true });
    } catch (err) {
      try {
        await prisma.$executeRawUnsafe(`ROLLBACK`);
      } catch (e) {}
      report.push({ id: r.id, displayName: r.displayName, jumiaShopSid: r.jumiaShopSid, deleted: false, error: String(err) });
    }
  }

  const out = { generatedAt: new Date().toISOString(), processed: rows.length, report };
  fs.writeFileSync('.tmp/force_deleted_disabled_jumia_accounts.json', JSON.stringify(out, null, 2));
  console.log('Done. Report written to .tmp/force_deleted_disabled_jumia_accounts.json');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Script failed', err);
    process.exit(1);
  });
