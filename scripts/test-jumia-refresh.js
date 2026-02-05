#!/usr/bin/env node
const fetch = require('node-fetch');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function tryRefresh(cred) {
  const apiBase = (cred.apiBase || 'https://vendor-api.jumia.com').replace(/\/+$/, '');
  const tokenUrl = new URL('/token', apiBase).toString();
  const body = new URLSearchParams({ client_id: cred.clientId, grant_type: 'refresh_token', refresh_token: cred.refreshToken });
  try {
    const res = await fetch(tokenUrl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
    const txt = await res.text();
    let parsed;
    try { parsed = JSON.parse(txt); } catch(e) { parsed = txt; }
    return { ok: res.ok, status: res.status, body: parsed, tokenUrl };
  } catch (e) {
    return { ok: false, error: String(e), tokenUrl };
  }
}

(async ()=>{
  try {
    const creds = await prisma.apiCredential.findMany({ where: { apiBase: { contains: 'jumia' } }, orderBy: { updatedAt: 'desc' } });
    if (!creds.length) {
      console.log('No Jumia ApiCredential rows found');
      return process.exit(0);
    }
    for (const c of creds) {
      console.log('---');
      console.log('id:', c.id);
      console.log('scope:', c.scope);
      console.log('clientId:', c.clientId);
      console.log('apiBase:', c.apiBase);
      const r = await tryRefresh(c);
      console.log('refresh result:', r.ok, r.status);
      console.log(JSON.stringify(r.body, null, 2));
    }
    await prisma.$disconnect();
  } catch (e) {
    console.error('ERR', e);
    await prisma.$disconnect();
    process.exit(1);
  }
})();
