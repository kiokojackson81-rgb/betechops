#!/usr/bin/env node
const { prisma } = require('../.worker-dist/src/lib/prisma');

async function main(){
  try{
    const rows = await prisma.jumiaAccount.findMany({ where: { OR: [{ label: { contains: 'JM', mode: 'insensitive' } }, { label: { contains: 'Latest', mode: 'insensitive' } }, { label: { contains: 'Collection', mode: 'insensitive' } }] }, select: { id: true, label: true, clientId: true, refreshToken: true } });
    console.log('Found', rows.length, 'JumiaAccount rows:');
    for(const r of rows){
      console.log(JSON.stringify(r));
    }
  }catch(e){ console.error('ERR', e); process.exit(1);} finally { await prisma.$disconnect(); }
}

main();
