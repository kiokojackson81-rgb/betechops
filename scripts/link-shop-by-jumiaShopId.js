#!/usr/bin/env node
const { prisma } = require('../.worker-dist/src/lib/prisma');

async function main(){
  const jumiaShopId = process.argv[2];
  if(!jumiaShopId){ console.error('Usage: node scripts/link-shop-by-jumiaShopId.js <jumiaShopId>'); process.exit(2); }
  try{
    const js = await prisma.jumiaShop.findUnique({ where: { id: jumiaShopId }, select: { id: true, name: true } });
    if(!js){ console.log('No JumiaShop with id', jumiaShopId); return; }
    console.log('Found JumiaShop', js.id, js.name);
    const shop = await prisma.shop.findFirst({ where: { name: { contains: js.name, mode: 'insensitive' } }, select: { id: true, name: true, jumiaShopSid: true } });
    if(!shop){ console.log('No Shop found matching name', js.name); return; }
    console.log('Found Shop', shop.id, shop.name, 'current jumiaShopSid=', shop.jumiaShopSid);
    const updated = await prisma.shop.update({ where: { id: shop.id }, data: { jumiaShopSid: jumiaShopId } });
    console.log('Updated Shop', updated.id, 'jumiaShopSid=', updated.jumiaShopSid);
  }catch(e){ console.error('ERR', e.message||e); process.exit(1); } finally { await prisma.$disconnect(); }
}

main();
