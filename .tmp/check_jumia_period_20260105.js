const fetch = require('node-fetch');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function parseDateOnly(s){
  if (!s) return null;
  const datePart = String(s).slice(0,10);
  const parts = datePart.split('-').map(v=>Number(v));
  if (parts.length!==3 || parts.some(n=>Number.isNaN(n))) return null;
  const [y,m,d]=parts; return new Date(y,m-1,d);
}
function toMonday(d){
  const dt = new Date(d); dt.setHours(0,0,0,0); const day = dt.getDay(); const diff = day===0 ? -6 : 1-day; dt.setDate(dt.getDate()+diff); return dt;
}
function toIso(d){ return d.toISOString().slice(0,10); }

async function refreshToken(creds, apiBase){
  const res = await fetch(new URL('/token', apiBase).toString(), { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: creds.clientId, grant_type: 'refresh_token', refresh_token: creds.refreshToken, ...(creds.clientSecret ? { client_secret: creds.clientSecret } : {}) }) });
  if (!res.ok) throw new Error('Failed refresh token ' + res.status);
  const data = await res.json();
  if (data.refresh_token && data.refresh_token !== creds.refreshToken) {
    if (creds.source === 'db' && creds.credentialId) {
      await prisma.apiCredential.update({ where: { id: creds.credentialId }, data: { refreshToken: data.refresh_token } });
    }
  }
  return data.access_token;
}

async function fetchStatements(apiBase, authHeader, createdAfter){
  const url = new URL('/payout-statement', apiBase);
  url.searchParams.set('createdAfter', createdAfter.toISOString().split('T')[0]);
  url.searchParams.set('currency', 'LOCAL');
  url.searchParams.set('size', '1000');
  const res = await fetch(url.toString(), { headers: { Authorization: authHeader } });
  if (!res.ok) throw new Error('Failed to fetch payout statements ' + res.status);
  const data = await res.json();
  return data.statements ?? [];
}

async function main(){
  const start = new Date('2026-01-05T00:00:00');
  const end = new Date('2026-01-11T23:59:59.999');
  console.log('Checking period', toIso(start), '->', toIso(end));

  const accounts = await prisma.marketplaceAccount.findMany({ where: { platform: 'JUMIA', isActive: true }, select: { id: true, jumiaShopSid: true, displayName: true } });
  console.log('Jumia accounts to check:', accounts.length);

  const allRecs = [];
  for (const acct of accounts){
    const scopeKey = `MARKETPLACE_ACCOUNT:${acct.id}`;
    const cred = await prisma.apiCredential.findFirst({ where: { scope: scopeKey }, orderBy: [{ updatedAt: 'desc' }] });
    if (!cred){ console.warn('No credential for account', acct.id, acct.displayName); continue; }
    const creds = { source: 'db', credentialId: cred.id, clientId: cred.clientId, clientSecret: cred.apiSecret, refreshToken: cred.refreshToken, baseUrl: cred.apiBase, authScheme: cred.issuer };
    const apiBase = (creds.baseUrl && creds.baseUrl.trim()) || 'https://vendor-api.jumia.com';
    let token;
    try { token = await refreshToken(creds, apiBase); } catch (e){ console.warn('Failed refresh for', acct.id, e.message); continue; }
    const authHeader = `${(creds.authScheme && creds.authScheme.trim()) || 'Bearer'} ${token}`;
    let statements;
    try { statements = await fetchStatements(apiBase, authHeader, start); } catch (e){ console.warn('Fetch failed for', acct.id, e.message); continue; }
    console.log('Account', acct.displayName ?? acct.id, 'fetched statements', statements.length);
    for (const st of statements){
      const sd = parseDateOnly(st.period?.startDate) ?? (st.createdAt ? new Date(st.createdAt) : null);
      if (sd && (sd < start || sd > end)) continue;
      const stmtShopSid = st.shopSid ?? null;
      const weekStart = sd ? toMonday(sd) : toMonday(new Date(st.createdAt ?? Date.now()));
      const key = `${st.statementNumber}::${toIso(weekStart)}`;
      const amount = Number(st.payout?.amount ?? 0);
      const rec = { accountId: acct.id, accountName: acct.displayName, statementNumber: st.statementNumber, shopSid: stmtShopSid, amount, periodStart: st.period?.startDate ?? null, weekStart: toIso(weekStart), key, raw: st };
      allRecs.push(rec);
    }
  }

  const grouped = new Map();
  for (const r of allRecs){ if (!grouped.has(r.key)) grouped.set(r.key, []); grouped.get(r.key).push(r); }
  const duplicates = [];
  for (const [k, arr] of grouped.entries()) if (arr.length > 1) duplicates.push({ key: k, items: arr });

  const out = { period: { start: toIso(start), end: toIso(end) }, fetched: allRecs.length, statements: allRecs, duplicates };
  const fs = require('fs');
  const outPath = '.tmp/jumia_statements_2026-01-05_2026-01-11.json';
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');
  console.log('Wrote', outPath);
  console.log('Total statements found:', allRecs.length, 'duplicate keys:', duplicates.length);
  for (const d of duplicates){ console.log('Duplicate key', d.key, 'count', d.items.length); d.items.forEach(i=>console.log('-', i.statementNumber, i.shopSid, i.amount, 'acct', i.accountName || i.accountId)); }
  await prisma.$disconnect();
}

main().catch(async (e)=>{ console.error('Failed', e); await prisma.$disconnect(); process.exit(1); });
