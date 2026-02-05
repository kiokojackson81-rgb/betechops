#!/usr/bin/env node
const { prisma } = require('../.worker-dist/src/lib/prisma');

async function main(){
  try{
    const rows = await prisma.apiCredential.findMany({ where: { clientId: { contains: 'f7df0953', mode: 'insensitive' } } });
    console.log('Found', rows.length, 'ApiCredential rows:');
    for(const r of rows){ console.log(JSON.stringify(r)); }
  }catch(e){ console.error('ERR', e); process.exit(1);} finally { await prisma.$disconnect(); }
}
main();
