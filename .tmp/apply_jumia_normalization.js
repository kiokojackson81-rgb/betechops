const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

(async ()=>{
  try{
    const report = JSON.parse(fs.readFileSync('.tmp/jumia_normalization_dryrun_report.json','utf8'));
    console.log('Applying normalization for', report.items.length, 'canonical entries');

    // Ensure archive tables exist
    await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "MarketplaceAccount_archive" AS TABLE "MarketplaceAccount" WITH NO DATA`);
    await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "MarketplacePayoutWeek_archive" AS TABLE "MarketplacePayoutWeek" WITH NO DATA`);

    const processed = new Set();
    for (const item of report.items){
      const canonicalId = item.canonicalId;
      for (const dup of item.duplicates){
        if (processed.has(dup.id)) continue;
        // archive account
        console.log('Archiving account', dup.id);
        await prisma.$executeRawUnsafe(`INSERT INTO "MarketplaceAccount_archive" SELECT * FROM "MarketplaceAccount" WHERE "id"=$1 AND NOT EXISTS (SELECT 1 FROM "MarketplaceAccount_archive" a WHERE a."id" = "MarketplaceAccount"."id")`, dup.id);
        // archive payouts
        console.log('Archiving payouts for account', dup.id);
        await prisma.$executeRawUnsafe(`INSERT INTO "MarketplacePayoutWeek_archive" SELECT * FROM "MarketplacePayoutWeek" WHERE "accountId"=$1 AND NOT EXISTS (SELECT 1 FROM "MarketplacePayoutWeek_archive" a WHERE a."id" = "MarketplacePayoutWeek"."id")`, dup.id);
        // move credential if present
        if (dup.credential && dup.credential.id){
          console.log('Reassigning credential', dup.credential.id, 'to', canonicalId);
          await prisma.$executeRawUnsafe(`UPDATE "ApiCredential" SET scope=$1 WHERE "id"=$2`, `MARKETPLACE_ACCOUNT:${canonicalId}`, dup.credential.id);
        }
        // deactivate account
        console.log('Deactivating account', dup.id);
        await prisma.$executeRawUnsafe(`UPDATE "MarketplaceAccount" SET "isActive"=false WHERE "id"=$1`, dup.id);
        processed.add(dup.id);
      }
    }

    console.log('Normalization apply complete');
    await prisma.$disconnect();
  }catch(e){ console.error('Apply failed', e); await prisma.$disconnect(); process.exit(1); }
})();
