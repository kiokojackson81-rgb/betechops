#!/usr/bin/env node
const fetch = require('node-fetch');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const TOKEN_URL = 'https://vendor-api.jumia.com/token';

function mask(s){ if (!s) return '<none>'; return s.slice(0,6)+'***'; }

async function tryRefresh(clientId, refreshToken){
  const body = new URLSearchParams({ client_id: clientId, grant_type: 'refresh_token', refresh_token: refreshToken });
  try{
    const res = await fetch(TOKEN_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
    const text = await res.text();
    let parsed;
    try{ parsed = JSON.parse(text); } catch(e){ parsed = text; }
    return { ok: res.ok, status: res.status, body: parsed };
  }catch(e){ return { ok:false, error: String(e) }; }
}

(async ()=>{
  try{
    const rows = await prisma.jumiaAccount.findMany({ select: { id:true, clientId:true, refreshToken:true, label:true } });
    if (!rows.length) { console.log('No jumiaAccount rows'); await prisma.$disconnect(); return; }
    for (const r of rows){
      console.log('---');
      console.log('id:', r.id);
      console.log('label:', r.label);
      console.log('clientId:', r.clientId);
      console.log('refreshTokenMasked:', mask(r.refreshToken));
      if (!r.clientId || !r.refreshToken){ console.log('missing creds, skipping'); continue; }
      const res = await tryRefresh(r.clientId, r.refreshToken);
      console.log('result:', res.ok, res.status || '', typeof res.body === 'object' ? JSON.stringify(res.body) : String(res.body));
    }
    await prisma.$disconnect();
  }catch(e){ console.error('ERR', e); await prisma.$disconnect(); process.exit(1); }
})();
