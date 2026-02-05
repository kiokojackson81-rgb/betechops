#!/usr/bin/env node
const { prisma } = require('../.worker-dist/src/lib/prisma');
async function main(){
  const id = process.argv[2];
  if(!id){ console.error('Usage: node scripts/update-marketplace-displayName-from-jumiaShop.js <jumiaShopId>'); process.exit(2); }
  try{
    const js = await prisma.jumiaShop.findUnique({ where: { id }, select: { id: true, name: true } });
    if(!js){ console.log('No JumiaShop', id); return; }
    const acct = await prisma.marketplaceAccount.findFirst({ where: { jumiaShopSid: id } });
    if(!acct){ console.log('No MarketplaceAccount with jumiaShopSid', id); return; }
    const updated = await prisma.marketplaceAccount.update({ where: { id: acct.id }, data: { displayName: js.name } });
    console.log('Updated marketplaceAccount', updated.id, 'displayName=', updated.displayName);
  }catch(e){ console.error('ERR', e.message||e); process.exit(1); } finally { await prisma.$disconnect(); }
}
main();
