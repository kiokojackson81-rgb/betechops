const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

async function main(){
  const mapping = JSON.parse(fs.readFileSync('.tmp/jumia_proposed_mapping.json','utf8'));
  const canonical = mapping.canonical || [];
  const report = { generatedAt: new Date().toISOString(), items: [] };
  const sqlParts = [];
  sqlParts.push('-- DRY-RUN normalization SQL for JUMIA accounts (do NOT run without review)');
  sqlParts.push('-- This script archives affected rows and reassigns credentials to canonical accounts, then deactivates duplicates');

  for (const entry of canonical){
    const shopSid = entry.suggestedCanonicalShopSid;
    const canonicalId = entry.suggestedCanonicalAccountId;
    const name = entry.name;
    const item = { name, clientId: entry.clientId, shopSid, canonicalId, duplicates: [] };

    // find accounts by shopSid OR by similar displayName
    let accounts = [];
    if (shopSid){
      accounts = await prisma.marketplaceAccount.findMany({ where: { OR: [ { jumiaShopSid: shopSid }, { displayName: { contains: name.split(' ')[0], mode: 'insensitive' } } ] }, select: { id: true, displayName: true, jumiaShopSid: true, isActive: true } });
    } else {
      accounts = await prisma.marketplaceAccount.findMany({ where: { displayName: { contains: name.split(' ')[0], mode: 'insensitive' }, platform: 'JUMIA' }, select: { id: true, displayName: true, jumiaShopSid: true, isActive: true } });
    }

    // unique account ids
    const accountIds = accounts.map(a=>a.id);

    // find ApiCredentials for these accounts
    const creds = await prisma.apiCredential.findMany({ where: { OR: accountIds.map(id=>({ scope: `MARKETPLACE_ACCOUNT:${id}` })) }, select: { id: true, scope: true, clientId: true, apiBase: true, updatedAt: true } });
    const credsByScope = {};
    creds.forEach(c=>{ credsByScope[c.scope]=c; });

    for (const a of accounts){
      if (a.id === canonicalId) continue;
      const dup = { id: a.id, displayName: a.displayName, jumiaShopSid: a.jumiaShopSid, isActive: a.isActive, credential: credsByScope[`MARKETPLACE_ACCOUNT:${a.id}`] || null };
      // count payout rows
      const payoutCount = await prisma.marketplacePayoutWeek.count({ where: { accountId: a.id } });
      dup.payoutCount = payoutCount;
      item.duplicates.push(dup);

      // propose SQL
      const archiveAccountSql = `-- Archive account ${a.id}\nINSERT INTO "MarketplaceAccount_archive" SELECT * FROM "MarketplaceAccount" WHERE id='${a.id}';`;
      const archivePayoutSql = `-- Archive payouts for account ${a.id}\nINSERT INTO "MarketplacePayoutWeek_archive" SELECT * FROM "MarketplacePayoutWeek" WHERE accountId='${a.id}';`;
      const reassignCredSql = dup.credential ? `-- Reassign credential ${dup.credential.id} to canonical account ${canonicalId}\nUPDATE "ApiCredential" SET scope='MARKETPLACE_ACCOUNT:${canonicalId}' WHERE id='${dup.credential.id}';` : `-- No credential on ${a.id}`;
      const deactivateSql = `-- Deactivate duplicate account ${a.id}\nUPDATE "MarketplaceAccount" SET isActive=false WHERE id='${a.id}';`;
      sqlParts.push(`-- ==== Proposed changes for duplicate account ${a.id} (${a.displayName})`);
      sqlParts.push(archiveAccountSql);
      sqlParts.push(archivePayoutSql);
      sqlParts.push(reassignCredSql);
      sqlParts.push(deactivateSql);
    }

    // ensure canonical account has credential; if not, propose moving one from duplicates
    const canonicalCred = await prisma.apiCredential.findFirst({ where: { scope: `MARKETPLACE_ACCOUNT:${canonicalId}` } });
    if (!canonicalCred){
      // find any credential among duplicates to move
      const candidate = item.duplicates.find(d=>d.credential);
      if (candidate && candidate.credential){
        const moveSql = `-- Move credential ${candidate.credential.id} from ${candidate.id} to canonical ${canonicalId}\nUPDATE "ApiCredential" SET scope='MARKETPLACE_ACCOUNT:${canonicalId}' WHERE id='${candidate.credential.id}';`;
        sqlParts.push(moveSql);
        item.proposedCredentialMove = { fromAccountId: candidate.id, credentialId: candidate.credential.id }; 
      } else {
        item.proposedCredentialMove = null;
        sqlParts.push(`-- NOTE: No credential found for canonical account ${canonicalId}; consider creating or attaching one.`);
      }
    } else {
      sqlParts.push(`-- Canonical account ${canonicalId} already has credential ${canonicalCred.id}`);
      item.canonicalCredential = { id: canonicalCred.id, clientIdMasked: canonicalCred.clientId ? (canonicalCred.clientId.slice(0,6)+'***') : null };
    }

    report.items.push(item);
  }

  const sqlOut = sqlParts.join('\n\n');
  fs.writeFileSync('.tmp/jumia_normalization_dryrun.sql', sqlOut, 'utf8');
  fs.writeFileSync('.tmp/jumia_normalization_dryrun_report.json', JSON.stringify(report, null, 2), 'utf8');
  console.log('Wrote .tmp/jumia_normalization_dryrun.sql and .tmp/jumia_normalization_dryrun_report.json');
  await prisma.$disconnect();
}

main().catch(async (e)=>{ console.error('Failed', e); await prisma.$disconnect(); process.exit(1); });
