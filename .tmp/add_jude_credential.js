const fetch = require('node-fetch');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const JUDE_ACCOUNT_ID = '3ad790b3-e827-49e2-b1a1-4fb978c9b577';
const JUDE_CLIENT_ID = '70a7341a-1927-45a5-aec8-d0c5a4ac7b45';
const API_BASE = 'https://vendor-api.jumia.com';

function mask(s){ if (!s) return null; return s.slice(0,6) + '***'; }

async function refreshToken(creds){
  const url = new URL('/token', creds.apiBase).toString();
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: creds.clientId, grant_type: 'refresh_token', refresh_token: creds.refreshToken }) });
  if (!res.ok) throw new Error('refresh_failed:' + res.status);
  const data = await res.json();
  return data.access_token;
}

async function fetchStatements(apiBase, authHeader){
  const url = new URL('/payout-statement', apiBase);
  url.searchParams.set('createdAfter', '2025-12-01');
  url.searchParams.set('currency', 'LOCAL');
  url.searchParams.set('size', '20');
  const res = await fetch(url.toString(), { headers: { Authorization: authHeader } });
  if (!res.ok) throw new Error('fetch_failed:' + res.status);
  const data = await res.json();
  return data.statements ?? [];
}

(async ()=>{
  try{
    const refreshTokenEnv = process.env.JUMIA_JUDE_REFRESH;
    if (!refreshTokenEnv){ console.error('Missing env var JUMIA_JUDE_REFRESH'); process.exit(1); }

    // ensure marketplace account exists
    let account = await prisma.marketplaceAccount.findUnique({ where: { id: JUDE_ACCOUNT_ID } });
    if (!account){
      // try find by name
      account = await prisma.marketplaceAccount.findFirst({ where: { displayName: { contains: 'Jude', mode: 'insensitive' }, platform: 'JUMIA' } });
    }
    if (!account){
      account = await prisma.marketplaceAccount.create({ data: { id: JUDE_ACCOUNT_ID, platform: 'JUMIA', displayName: 'JUDE COLLECTIONS', isActive: true, countryCode: 'KE' } });
      console.log('Created marketplaceAccount', account.id);
    } else {
      const updates = {};
      if (account.platform !== 'JUMIA') updates.platform = 'JUMIA';
      if (!/Jude/i.test(account.displayName || '')) updates.displayName = 'JUDE COLLECTIONS';
      if (!account.isActive) updates.isActive = true;
      if (Object.keys(updates).length) account = await prisma.marketplaceAccount.update({ where: { id: account.id }, data: updates });
      console.log('Using marketplaceAccount', account.id, account.displayName);
    }

    // create or update ApiCredential scoped to this account
    const scope = `MARKETPLACE_ACCOUNT:${account.id}`;
    let cred = await prisma.apiCredential.findFirst({ where: { scope }, orderBy: [{ updatedAt: 'desc' }] });
    if (cred){
      await prisma.apiCredential.update({ where: { id: cred.id }, data: { clientId: JUDE_CLIENT_ID, apiBase: API_BASE, issuer: 'Bearer', refreshToken: refreshTokenEnv } });
      console.log('Updated ApiCredential', cred.id, 'clientIdMasked', mask(JUDE_CLIENT_ID));
      cred = await prisma.apiCredential.findUnique({ where: { id: cred.id } });
    } else {
      cred = await prisma.apiCredential.create({ data: { scope, apiBase: API_BASE, clientId: JUDE_CLIENT_ID, apiSecret: null, issuer: 'Bearer', refreshToken: refreshTokenEnv } });
      console.log('Created ApiCredential', cred.id, 'clientIdMasked', mask(JUDE_CLIENT_ID));
    }

    // discover shopSid using statements
    let accessToken;
    try { accessToken = await refreshToken({ apiBase: API_BASE, clientId: JUDE_CLIENT_ID, refreshToken: refreshTokenEnv }); } catch(e){ console.error('Token refresh failed:', e.message); process.exit(1); }
    const authHeader = `Bearer ${accessToken}`;
    let statements = [];
    try { statements = await fetchStatements(API_BASE, authHeader); } catch(e){ console.error('Failed fetching statements:', e.message); }
    const shopSids = new Set();
    for (const st of statements) if (st.shopSid) shopSids.add(st.shopSid);
    const shopSidArr = Array.from(shopSids);
    if (shopSidArr.length === 0){ console.log('No shopSid discovered from statements (will leave marketplaceAccount.jumiaShopSid unchanged)'); }
    else if (shopSidArr.length === 1){
      const discovered = shopSidArr[0];
      if (!account.jumiaShopSid || account.jumiaShopSid !== discovered){
        await prisma.marketplaceAccount.update({ where: { id: account.id }, data: { jumiaShopSid: discovered } });
        console.log('Updated marketplaceAccount jumiaShopSid to', discovered);
      } else {
        console.log('marketplaceAccount already has jumiaShopSid', discovered);
      }
    } else {
      console.log('Multiple shopSids discovered for this credential:', shopSidArr.join(','));
      // don't auto-assign; log for manual review
    }

    // final summary
    const finalAccount = await prisma.marketplaceAccount.findUnique({ where: { id: account.id } });
    const finalCred = await prisma.apiCredential.findFirst({ where: { scope }, orderBy: [{ updatedAt: 'desc' }] });
    console.log('Final: accountId', finalAccount.id, 'displayName', finalAccount.displayName, 'jumiaShopSid', finalAccount.jumiaShopSid || '<none>');
    console.log('Final: credential id', finalCred.id, 'clientIdMasked', mask(finalCred.clientId));

    await prisma.$disconnect();
  }catch(e){ console.error('Error', e); await prisma.$disconnect(); process.exit(1); }
})();
