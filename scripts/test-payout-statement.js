#!/usr/bin/env node
const fetch = require('node-fetch');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function mask(s){ if(!s) return s; return s.slice(0,6)+'***'; }

async function main(){
  try{
    const cred = await prisma.apiCredential.findFirst({ where: { apiBase: { contains: 'jumia' }, refreshToken: { not: null } }, orderBy: [{ updatedAt: 'desc' }] });
    if (!cred) { console.error('No Jumia ApiCredential found'); return; }
    console.log('Using ApiCredential', cred.id, 'scope', cred.scope, 'clientId', mask(cred.clientId));
    const tokenUrl = (cred.apiBase || process.env.JUMIA_VENDOR_API_BASE || 'https://vendor-api.jumia.com') + '/token';
    const params = new URLSearchParams({ client_id: cred.clientId, grant_type: 'refresh_token', refresh_token: cred.refreshToken });
    const tokenRes = await fetch(tokenUrl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: params });
    const tokenText = await tokenRes.text();
    let tokenJson;
    try{ tokenJson = JSON.parse(tokenText); }catch(e){ tokenJson = { raw: tokenText }; }
    console.log('tokenRes', tokenRes.status, tokenJson);
    if (!tokenRes.ok) return;
    const access = tokenJson.access_token;
    const apiBase = cred.apiBase || process.env.JUMIA_VENDOR_API_BASE || 'https://vendor-api.jumia.com';
    const url = new URL('/payout-statement', apiBase);
    url.searchParams.set('createdAfter','2026-01-05');
    url.searchParams.set('currency','LOCAL');
    url.searchParams.set('size','1000');
    const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${access}` } });
    const text = await res.text();
    console.log('payout-statement', res.status, text.slice(0,2000));
  }catch(e){ console.error('ERR', e); process.exitCode=1 } finally { await prisma.$disconnect(); }
}

main();
