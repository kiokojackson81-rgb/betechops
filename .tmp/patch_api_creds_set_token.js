#!/usr/bin/env node
const { prisma } = require('../.worker-dist/src/lib/prisma');
const NEW_REFRESH = '3USNy5f3rr89XWye1xc5ELHdvGMsylc2xofdC9Nh1uo';

async function main(){
  try{
    const rows = await prisma.apiCredential.findMany({ where: { clientId: { contains: 'f7df0953', mode: 'insensitive' } } });
    console.log('Patching', rows.length, 'rows');
    for(const r of rows){
      await prisma.apiCredential.update({ where: { id: r.id }, data: { refreshToken: NEW_REFRESH } });
      console.log('Patched', r.id);
    }
  }catch(e){ console.error('ERR', e); process.exit(1);} finally { await prisma.$disconnect(); }
}
main();
