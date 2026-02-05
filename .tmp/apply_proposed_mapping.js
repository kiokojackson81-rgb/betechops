const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

(async ()=>{
  try{
    const mapping = JSON.parse(fs.readFileSync('.tmp/jumia_proposed_mapping.json','utf8'));

    // ensure archive tables exist
    await prisma.$executeRawUnsafe('CREATE TABLE IF NOT EXISTS "MarketplaceAccount_archive" (LIKE "MarketplaceAccount" INCLUDING ALL)');
    await prisma.$executeRawUnsafe('CREATE TABLE IF NOT EXISTS "MarketplacePayoutWeek_archive" (LIKE "MarketplacePayoutWeek" INCLUDING ALL)');

    const summary = { archivedAccounts:0, archivedPayouts:0, reassignedCredentials:0, movedPayouts:0, deletedPayouts:0, deactivatedAccounts:0 };

    for(const entry of mapping.canonical || []){
      const canonicalId = entry.suggestedCanonicalAccountId;
      if(!canonicalId) continue;

      const dupCandidates = new Set([...(entry.currentAccountRowsWithClientIdCredential||[]), ...(entry.currentAccountsWithThatShopSid||[])]);
      dupCandidates.delete(canonicalId);

      for(const dupId of dupCandidates){
        // archive account row (idempotent)
        await prisma.$executeRaw`INSERT INTO "MarketplaceAccount_archive" SELECT * FROM "MarketplaceAccount" WHERE "id" = ${dupId} AND NOT EXISTS (SELECT 1 FROM "MarketplaceAccount_archive" WHERE "id" = ${dupId})`;
        summary.archivedAccounts += 1;

        // archive any payout rows for dup account (idempotent)
        const archRes = await prisma.$executeRaw`INSERT INTO "MarketplacePayoutWeek_archive" SELECT * FROM "MarketplacePayoutWeek" WHERE "accountId" = ${dupId} AND NOT EXISTS (SELECT 1 FROM "MarketplacePayoutWeek_archive" WHERE "id" = "MarketplacePayoutWeek"."id")`;
        // We can't easily get affected rowcount from $executeRaw here portably; we'll count later.

        // Reassign ApiCredential scopes from dup -> canonical
        const credUpdate = await prisma.apiCredential.updateMany({ where: { scope: `MARKETPLACE_ACCOUNT:${dupId}` }, data: { scope: `MARKETPLACE_ACCOUNT:${canonicalId}` } });
        summary.reassignedCredentials += credUpdate.count || 0;

        // Move or archive payout rows individually to avoid unique constraint conflicts
        const payouts = await prisma.marketplacePayoutWeek.findMany({ where: { accountId: dupId } });
        for(const p of payouts){
          // if any payout exists with same statementNumber and weekStart, archive this duplicate row
          const exists = await prisma.marketplacePayoutWeek.findFirst({ where: { statementNumber: p.statementNumber, weekStart: p.weekStart } });
          if(exists){
            // archive this duplicate row (idempotent)
            await prisma.$executeRaw`INSERT INTO "MarketplacePayoutWeek_archive" SELECT * FROM "MarketplacePayoutWeek" WHERE "id" = ${p.id} AND NOT EXISTS (SELECT 1 FROM "MarketplacePayoutWeek_archive" WHERE "id" = ${p.id})`;
            await prisma.marketplacePayoutWeek.delete({ where: { id: p.id } });
            summary.deletedPayouts += 1;
          }else{
            // safe to move to canonical account
            await prisma.marketplacePayoutWeek.update({ where: { id: p.id }, data: { accountId: canonicalId } });
            summary.movedPayouts += 1;
          }
        }

        // deactivate duplicate account
        await prisma.marketplaceAccount.update({ where: { id: dupId }, data: { isActive: false } });
        summary.deactivatedAccounts += 1;
      }
    }

    // Count archived payout rows
    const archivedPayoutsCount = await prisma.$queryRawUnsafe('SELECT count(*)::int AS cnt FROM "MarketplacePayoutWeek_archive"');
    summary.archivedPayouts = archivedPayoutsCount[0]?.cnt || 0;

    console.log('Apply proposed mapping summary:', summary);
    await prisma.$disconnect();
  }catch(e){
    console.error('apply failed', e);
    await prisma.$disconnect();
    process.exit(1);
  }
})();
