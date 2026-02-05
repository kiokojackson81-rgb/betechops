#!/usr/bin/env node
const { prisma } = require('../.worker-dist/src/lib/prisma');

async function main(){
  try{
    const creds = await prisma.apiCredential.findMany({ where: { apiBase: { contains: 'jumia' }, scope: { contains: 'MARKETPLACE_ACCOUNT:' } }, select: { id: true, scope: true, clientId: true, refreshToken: true } });
    for (const c of creds){
      const mId = (c.scope || '').split(':')[1];
      if (!mId) continue;
      const ma = await prisma.marketplaceAccount.findUnique({ where: { id: mId }, select: { id: true, displayName: true } });
      if (!ma) continue;
      const labelFragment = ma.displayName;
      const ja = await prisma.jumiaAccount.findFirst({ where: { label: { contains: labelFragment, mode: 'insensitive' } } });
      if (!ja) {
        console.log('No jumiaAccount found for marketplaceAccount', ma.id, ma.displayName);
        continue;
      }
      console.log('Mapping ApiCredential', c.id, 'to jumiaAccount', ja.id, '(', ja.label, ')');
      await prisma.jumiaAccount.update({ where: { id: ja.id }, data: { clientId: c.clientId, refreshToken: c.refreshToken } });
      console.log('Updated jumiaAccount', ja.id);
    }
  }catch(e){ console.error('ERR', e.message||e); process.exit(1); } finally { await prisma.$disconnect(); }
}

main();
