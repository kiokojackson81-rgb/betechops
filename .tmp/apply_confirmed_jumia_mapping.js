const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const mapping = [
  { name: 'Betech Solar Solution', clientId: 'b2a290cc-74fd-4b9e-a598-ef42fc57f918', shopSid: '29e1f2ad-b898-4d11-b3df-ab3dda5755fc' },
  { name: 'Hitech Power', clientId: '8c0e5ed0-8eb7-49c6-982c-1acdfef94d37', shopSid: '1951e826-57f2-4d6a-99ad-67b5139d8aca' },
  { name: 'Jude Collection', clientId: '70a7341a-1927-45a5-aec8-d0c5a4ac7b45', shopSid: '5497640c-3f51-4777-82fa-fc1c92dc588b' },
  { name: 'LabTech Kenya', clientId: '3579f345-a3ac-4e9d-b355-1990f0ad8a54', shopSid: '45fd7334-a7db-4f49-ba60-347096fd818e' },
  { name: 'Maxton Enterprise', clientId: '61e52422-f98e-49da-87e2-f9c832bf1a04', shopSid: '07ee95b2-acb7-4436-b98f-d8ce30d0c518' },
  { name: 'Sky Store Ke', clientId: 'cd95a840-f194-4f49-88fd-848f2c59456f', shopSid: 'a4f06613-3271-4846-8b25-43b2bc093a80' },
  { name: 'JM Latest Collections', clientId: 'f7df0953-7c18-4191-b304-614f9f0987a4', shopSid: 'db15d4e6-19a0-4cc1-b8c9-0619c5388643' },
  { name: 'Betech Store', clientId: 'e20e8623-e422-4566-a08a-37751f4bc759', shopSid: 'c897dcd1-5a4d-4d68-80ff-e8fda74f79e4' },
];

async function archiveAccount(id){
  try{
    await prisma.$executeRawUnsafe(`INSERT INTO "MarketplaceAccount_archive" SELECT * FROM "MarketplaceAccount" WHERE id='${id}'`);
  }catch(e){ /* ignore if archive table missing or already archived */ }
}

async function ensureAccountFor(mappingRow){
  const { name, shopSid } = mappingRow;
  let accounts = await prisma.marketplaceAccount.findMany({ where: { jumiaShopSid: shopSid } });
  if(accounts.length === 0){
    // try find by displayName
    accounts = await prisma.marketplaceAccount.findMany({ where: { displayName: { contains: name.split(' ')[0], mode: 'insensitive' }, platform: 'JUMIA' } });
  }

  let canonical;
  // If we found accounts but none are unassigned (jumiaShopSid null) and none match our target shopSid,
  // create a new MarketplaceAccount to avoid reusing an existing account for a different shopSid.
  const hasMatchingSid = accounts.some(a => a.jumiaShopSid === shopSid);
  const hasUnassigned = accounts.some(a => !a.jumiaShopSid);
  if(accounts.length === 0 || (!hasMatchingSid && !hasUnassigned)){
    canonical = await prisma.marketplaceAccount.create({ data: { displayName: name, platform: 'JUMIA', isActive: true, countryCode: 'KE', jumiaShopSid: shopSid } });
    console.log('Created account', canonical.id, name);
  }else{
    // pick canonical: prefer exact name match or active
    canonical = accounts.find(a => a.displayName.toLowerCase().includes(name.toLowerCase())) || accounts.find(a => a.isActive) || accounts[0];
    const updates = {};
    if(!canonical.jumiaShopSid) updates.jumiaShopSid = shopSid;
    if(canonical.displayName !== name) updates.displayName = name;
    if(!canonical.isActive) updates.isActive = true;
    if(Object.keys(updates).length) canonical = await prisma.marketplaceAccount.update({ where: { id: canonical.id }, data: updates });
    console.log('Using existing account', canonical.id, name);
  }

  // Deactivate any other MarketplaceAccount rows that reference this shopSid but are not the canonical one
  const others = await prisma.marketplaceAccount.findMany({ where: { jumiaShopSid: shopSid, id: { not: canonical.id } } });
  for(const o of others){
    await archiveAccount(o.id);
    await prisma.marketplaceAccount.update({ where: { id: o.id }, data: { isActive: false } });
    console.log('Deactivated duplicate account', o.id, o.displayName);
  }

  // Also deactivate placeholder displayNames like 'Jumia Shop <sid>' for this sid
  const placeholders = await prisma.marketplaceAccount.findMany({ where: { displayName: { contains: 'Jumia Shop', mode: 'insensitive' }, jumiaShopSid: shopSid } });
  for(const p of placeholders){
    if(p.id === canonical.id) continue;
    await archiveAccount(p.id);
    await prisma.marketplaceAccount.update({ where: { id: p.id }, data: { isActive: false } });
    console.log('Deactivated placeholder', p.id, p.displayName);
  }

  return canonical;
}

async function attachCredential(mappingRow, account){
  const { clientId } = mappingRow;
  const scope = `MARKETPLACE_ACCOUNT:${account.id}`;
  const apiBase = 'https://vendor-api.jumia.com';

  const creds = await prisma.apiCredential.findMany({ where: { clientId } });
  if(creds.length === 0){
    const created = await prisma.apiCredential.create({ data: { scope, apiBase, clientId } });
    console.log('Created ApiCredential', created.id, 'for account', account.id);
  }else{
    // keep first as canonical for this clientId
    const canonicalCred = creds[0];
    if(canonicalCred.scope !== scope || canonicalCred.apiBase !== apiBase){
      await prisma.apiCredential.update({ where: { id: canonicalCred.id }, data: { scope, apiBase, clientId } });
      console.log('Updated ApiCredential', canonicalCred.id, 'scope ->', scope);
    }
    // For additional creds with same clientId, clear clientId to avoid cross-shop usage
    for(let i=1;i<creds.length;i++){
      const c = creds[i];
      if(c.id === canonicalCred.id) continue;
      await prisma.apiCredential.update({ where: { id: c.id }, data: { clientId: null } });
      console.log('Cleared clientId on extra ApiCredential', c.id);
    }
  }
}

async function finalChecks(shopSids){
  // Ensure exactly one active account per shopSid
  for(const sid of shopSids){
    const rows = await prisma.marketplaceAccount.findMany({ where: { jumiaShopSid: sid } });
    const active = rows.filter(r=>r.isActive);
    if(active.length === 0){
      console.warn('No active account for shopSid', sid);
    }else if(active.length > 1){
      console.warn('Multiple active accounts for shopSid', sid, active.map(a=>a.id));
    }
  }
}

(async ()=>{
  try{
    const shopSids = mapping.map(m=>m.shopSid);
    const canonicalMap = {};
    for(const m of mapping){
      const acct = await ensureAccountFor(m);
      canonicalMap[m.shopSid] = acct.id;
      await attachCredential(m, acct);
    }

    await finalChecks(shopSids);
    console.log('Mapping applied for', mapping.length, 'shops.');
  }catch(e){
    console.error('ERROR', e);
    process.exitCode = 2;
  }finally{
    await prisma.$disconnect();
  }
})();
