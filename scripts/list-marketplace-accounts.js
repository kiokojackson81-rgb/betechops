#!/usr/bin/env node
const { prisma } = require('../.worker-dist/src/lib/prisma');
(async ()=>{
  try{
    const rows = await prisma.marketplaceAccount.findMany({ where: { platform: 'JUMIA' }, select: { id: true, displayName: true, jumiaShopSid: true } });
    rows.forEach(r=> console.log(r.id, r.displayName, r.jumiaShopSid));
  }catch(e){ console.error('ERR', e.message||e); process.exit(1);} finally{ await prisma.$disconnect(); }
})();
