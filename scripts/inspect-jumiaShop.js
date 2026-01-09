#!/usr/bin/env node
const { prisma } = require('../.worker-dist/src/lib/prisma');

async function main(){
  const id = process.argv[2];
  if(!id){ console.error('Usage: node scripts/inspect-jumiaShop.js <id>'); process.exit(2); }
  try{
    const js = await prisma.jumiaShop.findUnique({ where: { id }, select: { id: true, name: true, accountId: true } });
    console.log('JumiaShop:', js);
    const ja = js ? await prisma.jumiaAccount.findUnique({ where: { id: js.accountId }, select: { id: true, label: true, clientId: true } }) : null;
    console.log('JumiaAccount:', ja);
    const shop = await prisma.shop.findFirst({ where: { jumiaShopSid: id }, select: { id: true, name: true } });
    console.log('Shop with jumiaShopSid:', shop);
  }catch(e){ console.error('ERR', e.message||e); process.exit(1); } finally { await prisma.$disconnect(); }
}

main();
