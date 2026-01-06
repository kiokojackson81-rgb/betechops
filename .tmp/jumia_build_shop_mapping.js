const fetch = require('node-fetch');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function parseDateOnly(s){ if (!s) return null; const datePart = String(s).slice(0,10); const parts = datePart.split('-').map(v=>Number(v)); if (parts.length!==3 || parts.some(n=>Number.isNaN(n))) return null; const [y,m,d]=parts; return new Date(y,m-1,d); }
function toIso(d){ return d.toISOString().slice(0,10); }

async function refreshToken(creds, apiBase){
  const res = await fetch(new URL('/token', apiBase).toString(), { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: creds.clientId, grant_type: 'refresh_token', refresh_token: creds.refreshToken, ...(creds.clientSecret ? { client_secret: creds.clientSecret } : {}) }) });
  if (!res.ok) throw new Error('Failed refresh token ' + res.status);
  const data = await res.json();
  if (data.refresh_token && data.refresh_token !== creds.refreshToken) {
    if (creds.source === 'db' && creds.credentialId) {
      try { await prisma.apiCredential.update({ where: { id: creds.credentialId }, data: { refreshToken: data.refresh_token } }); } catch(e){}
    }
  }
  return data.access_token;
}

async function fetchStatements(apiBase, authHeader, createdAfter){
  const url = new URL('/payout-statement', apiBase);
  url.searchParams.set('createdAfter', createdAfter.toISOString().split('T')[0]);
  url.searchParams.set('currency', 'LOCAL');
  url.searchParams.set('size', '50');
  const res = await fetch(url.toString(), { headers: { Authorization: authHeader } });
  if (!res.ok) {
    // try with /statements as fallback
    try {
      const res2 = await fetch(new URL('/statements', apiBase).toString(), { headers: { Authorization: authHeader } });
      if (!res2.ok) throw new Error('failed both endpoints');
      const data2 = await res2.json(); return data2.statements ?? [];
    } catch(e){ throw new Error('Failed to fetch payout statements ' + res.status); }
  }
  const data = await res.json();
  return data.statements ?? [];
}

(async ()=>{
  try{
    const credsRows = await prisma.apiCredential.findMany({ where: { OR: [ { scope: { startsWith: 'MARKETPLACE_ACCOUNT:' } }, { scope: 'JUMIA_VENDOR' }, { scope: 'GLOBAL' } ] }, orderBy: [{ updatedAt: 'desc' }], take: 200 });
    console.log('Credentials to test:', credsRows.length);
    const out = [];
    const since = new Date('2025-12-01T00:00:00');
    for (const c of credsRows){
      const apiBase = (c.apiBase && c.apiBase.trim()) || 'https://vendor-api.jumia.com';
      const creds = { source: 'db', credentialId: c.id, clientId: c.clientId, clientSecret: c.apiSecret, refreshToken: c.refreshToken, baseUrl: c.apiBase, authScheme: c.issuer };
      let token;
      try { token = await refreshToken(creds, apiBase); } catch(e){ console.warn('refresh failed for', c.id, e.message); out.push({ credentialId: c.id, scope: c.scope, clientId: c.clientId ? (c.clientId.slice(0,6)+'***') : null, apiBase: apiBase, ok:false, error: 'refresh_failed' }); continue; }
      const authHeader = `${(creds.authScheme && creds.authScheme.trim()) || 'Bearer'} ${token}`;
      let notes = [];
      let statements = [];
      try { statements = await fetchStatements(apiBase, authHeader, since); } catch(e){ console.warn('fetch failed for', c.id, e.message); out.push({ credentialId: c.id, scope: c.scope, clientId: c.clientId ? (c.clientId.slice(0,6)+'***') : null, apiBase: apiBase, ok:false, error: 'fetch_failed' }); continue; }
      const shopSids = new Set();
      for (const st of statements){ if (st.shopSid) shopSids.add(st.shopSid); }
      const shopSidsArr = Array.from(shopSids);
      out.push({ credentialId: c.id, scope: c.scope, clientId: c.clientId ? c.clientId : null, clientIdMasked: c.clientId ? (c.clientId.slice(0,6)+'***') : null, apiBase: apiBase, ok:true, shopSids: shopSidsArr, statementCount: statements.length, updatedAt: c.updatedAt });
      console.log('Cred', c.id, 'scope', c.scope, 'statements', statements.length, 'shopSids', shopSidsArr.length ? shopSidsArr.join(',') : '<none>');
    }

    const fs = require('fs');
    const outPath = '.tmp/jumia_clientid_shopmapping.json';
    fs.writeFileSync(outPath, JSON.stringify({ generatedAt: new Date().toISOString(), rows: out }, null, 2));
    console.log('Wrote', outPath);
    await prisma.$disconnect();
  }catch(e){ console.error('failed', e); await prisma.$disconnect(); process.exit(1); }
})();
