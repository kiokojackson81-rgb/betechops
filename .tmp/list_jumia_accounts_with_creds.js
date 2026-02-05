const { PrismaClient } = require('@prisma/client');
(async () => {
  const prisma = new PrismaClient();
  try {
    const accounts = await prisma.marketplaceAccount.findMany({ where: { platform: 'JUMIA' }, orderBy: [{ displayName: 'asc' }], select: { id: true, displayName: true, jumiaShopSid: true, isActive: true } });
    const rows = [];
    for (const a of accounts) {
      const scopeKey = `MARKETPLACE_ACCOUNT:${a.id}`;
      const cred = await prisma.apiCredential.findFirst({ where: { scope: scopeKey }, orderBy: [{ updatedAt: 'desc' }] });
      // also check for a global JUMIA_VENDOR credential
      const vendorCred = await prisma.apiCredential.findFirst({ where: { scope: 'JUMIA_VENDOR' }, orderBy: [{ updatedAt: 'desc' }] });
      const mask = (s) => s ? (s.slice(0,4) + '***') : null;
      rows.push({
        accountId: a.id,
        accountName: a.displayName,
        jumiaShopSid: a.jumiaShopSid,
        isActive: a.isActive,
        credential: cred ? { id: cred.id, scope: cred.scope, apiBase: cred.apiBase, clientId: mask(cred.clientId), issuer: cred.issuer, updatedAt: cred.updatedAt } : null,
        vendorCredential: vendorCred ? { id: vendorCred.id, scope: vendorCred.scope, apiBase: vendorCred.apiBase, clientId: mask(vendorCred.clientId), issuer: vendorCred.issuer, updatedAt: vendorCred.updatedAt } : null,
      });
    }
    const fs = require('fs');
    const outPath = '.tmp/jumia_accounts_with_creds.json';
    fs.writeFileSync(outPath, JSON.stringify({ generatedAt: new Date().toISOString(), count: rows.length, rows }, null, 2));
    console.log('Wrote', outPath);
    for (const r of rows) {
      console.log('-', r.accountName || r.accountId, '| shopSid:', r.jumiaShopSid, '| active:', r.isActive, '| cred:', r.credential ? r.credential.clientId + '@' + (r.credential.apiBase||'') : 'NONE');
    }
  } catch (e) { console.error('err', e); process.exit(1); } finally { await prisma.$disconnect(); }
})();
