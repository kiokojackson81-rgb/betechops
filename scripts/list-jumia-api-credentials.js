#!/usr/bin/env node
const { prisma } = require('../.worker-dist/src/lib/prisma');
(async ()=>{
  try{
    const rows = await prisma.apiCredential.findMany({ where: { apiBase: { contains: 'jumia' } }, select: { id: true, scope: true, clientId: true, refreshToken: true } });
    rows.forEach(r=> console.log(r.id, r.scope, r.clientId, r.refreshToken ? 'has-refresh' : 'no-refresh'));
  }catch(e){ console.error('ERR', e.message||e); process.exit(1);} finally{ await prisma.$disconnect(); }
})();
