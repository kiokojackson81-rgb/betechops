const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async ()=>{
  try{
    // duplicate statement keys count
    const dupSql = `SELECT count(*) AS cnt FROM (SELECT ("rawPayload"->>'statementNumber') AS statementNumber, ("rawPayload"->>'shopSid') AS shopSid, "weekStart", count(*) FROM "MarketplacePayoutWeek" GROUP BY 1,2,3 HAVING count(*) > 1) s`;
    const dupRes = await prisma.$queryRawUnsafe(dupSql);
    console.log('Duplicate statement groups count:', dupRes[0].cnt);

    // cross-shop incidents
    const crossSql = `SELECT count(*) AS cnt FROM "MarketplacePayoutWeek" mpw WHERE ((mpw."rawPayload"->>'shopSid') IS NOT NULL) AND ((mpw."rawPayload"->>'shopSid') != (SELECT ma."jumiaShopSid" FROM "MarketplaceAccount" ma WHERE ma."id" = mpw."accountId" LIMIT 1))`;
    const crossRes = await prisma.$queryRawUnsafe(crossSql);
    console.log('CROSS_SHOP_CREDENTIAL incidents count:', crossRes[0].cnt);

    // list active Jumia shops
    const shops = await prisma.marketplaceAccount.findMany({ where: { platform: 'JUMIA', isActive: true }, select: { id: true, displayName: true, jumiaShopSid: true } });
    console.log('Active Jumia shops:', shops.length);
    shops.forEach(s=>console.log('-', s.displayName, s.jumiaShopSid, s.id));

    await prisma.$disconnect();
  }catch(e){ console.error('verify failed', e); await prisma.$disconnect(); process.exit(1); }
})();
