const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

const shops = [
  { name: 'Betech Solar Solution', clientId: 'b2a290cc-74fd-4b9e-a598-ef42fc57f918' },
  { name: 'Hitech Power', clientId: '8c0e5ed0-8eb7-49c6-982c-1acdfef94d37' },
  { name: 'Jude Collection', clientId: '70a7341a-1927-45a5-aec8-d0c5a4ac7b45' },
  { name: 'LabTech Kenya', clientId: '3579f345-a3ac-4e9d-b355-1990f0ad8a54' },
  { name: 'Maxton Enterprise', clientId: '61e52422-f98e-49da-87e2-f9c832bf1a04' },
  { name: 'Sky Store Ke', clientId: 'cd95a840-f194-4f49-88fd-848f2c59456f' },
  { name: 'JM Latest Collections', clientId: 'f7df0953-7c18-4191-b304-614f9f0987a4' },
  { name: 'Betech Store', clientId: 'e20e8623-e422-4566-a08a-37751f4bc759' },
];

(async ()=>{
  try{
    const report = { created: [], updated: [], reactivated: [], deactivated: [], credentialsCreated: [], credentialsUpdated: [] };

    // Ensure each shop has one active MarketplaceAccount with correct name
    for(const s of shops){
      // try find by jumiaShopSid (if already set) or by displayName case-insensitive
      let acct = await prisma.marketplaceAccount.findFirst({ where: { OR: [ { jumiaShopSid: s.clientId }, { displayName: { equals: s.name, mode: 'insensitive' } } ], platform: 'JUMIA' } });
      if(!acct){
        acct = await prisma.marketplaceAccount.create({ data: { displayName: s.name, platform: 'JUMIA', isActive: true, countryCode: 'KE' } });
        report.created.push({ name: s.name, accountId: acct.id });
      }else{
        // ensure active and name canonical
        if(!acct.isActive){ await prisma.marketplaceAccount.update({ where: { id: acct.id }, data: { isActive: true } }); report.reactivated.push(acct.id); }
        if(acct.displayName !== s.name){ await prisma.marketplaceAccount.update({ where: { id: acct.id }, data: { displayName: s.name } }); report.updated.push({ id: acct.id, displayName: s.name }); }
      }

      // Ensure ApiCredential exists for this account (no refreshToken written)
      const scopeKey = `MARKETPLACE_ACCOUNT:${acct.id}`;
      const existingCred = await prisma.apiCredential.findFirst({ where: { OR: [ { scope: scopeKey }, { clientId: s.clientId } ] } });
      if(!existingCred){
        const c = await prisma.apiCredential.create({ data: { scope: scopeKey, apiBase: 'https://vendor-api.jumia.com', clientId: s.clientId } });
        report.credentialsCreated.push({ accountId: acct.id, credentialId: c.id });
      }else{
        // update scope to point to this account and ensure clientId set
        const upd = await prisma.apiCredential.update({ where: { id: existingCred.id }, data: { scope: scopeKey, clientId: s.clientId, apiBase: existingCred.apiBase || 'https://vendor-api.jumia.com' } });
        report.credentialsUpdated.push({ accountId: acct.id, credentialId: upd.id });
      }
    }

    // Deactivate any other active JUMIA MarketplaceAccount rows not in the 8-list
    const activeJumia = await prisma.marketplaceAccount.findMany({ where: { platform: 'JUMIA', isActive: true } });
    const wantedNames = new Set(shops.map(s=>s.name.toLowerCase()));
    for(const a of activeJumia){
      if(!wantedNames.has(a.displayName.toLowerCase())){
        await prisma.marketplaceAccount.update({ where: { id: a.id }, data: { isActive: false } });
        report.deactivated.push({ id: a.id, displayName: a.displayName });
      }
    }

    fs.writeFileSync('.tmp/jumia_identity_setup_report.json', JSON.stringify(report, null, 2));
    console.log('Report written to .tmp/jumia_identity_setup_report.json');
    await prisma.$disconnect();
  }catch(e){ console.error('ensure failed', e); await prisma.$disconnect(); process.exit(1); }
})();
