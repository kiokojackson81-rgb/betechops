#!/usr/bin/env node
const { PrismaClient, Platform } = require('@prisma/client');
const prisma = new PrismaClient();

async function main(){
  try{
    const accounts = await prisma.marketplaceAccount.findMany({ where: { platform: Platform.JUMIA, isActive: true }, select: { id: true, displayName: true, jumiaShopSid: true } });
    console.log('Found', accounts.length, 'Jumia marketplace accounts');
    for (const a of accounts) {
      const hasSid = !!a.jumiaShopSid;
      const shop = a.jumiaShopSid ? await prisma.shop.findFirst({ where: { platform: Platform.JUMIA, jumiaShopSid: a.jumiaShopSid }, select: { id: true, name: true } }) : null;
      console.log(JSON.stringify({ accountId: a.id, displayName: a.displayName, jumiaShopSid: a.jumiaShopSid, hasShopRecord: !!shop, shopId: shop?.id, shopName: shop?.name }));
    }
  }catch(e){ console.error('ERR', e); process.exitCode = 1; } finally { await prisma.$disconnect(); }
}

main();
