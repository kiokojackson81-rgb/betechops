try { require('dotenv').config(); } catch {}
const prisma = require('../.worker-dist/src/lib/prisma').prisma;

async function main(){
  const accounts = await prisma.marketplaceAccount.findMany({ where: { jumiaShopSid: { not: null } }, select: { id: true, displayName: true, jumiaShopSid: true } });
  const shops = await prisma.shop.findMany({ select: { id: true, name: true, jumiaShopSid: true } });
  const shopsByJumia = new Map(shops.filter(s => s.jumiaShopSid).map(s => [s.jumiaShopSid, s]));

  const toCreate = accounts.filter(a => !shopsByJumia.has(a.jumiaShopSid));

  if (!toCreate.length) {
    console.log('No unmatched MarketplaceAccount jumiaShopSid values - nothing to do.');
    process.exit(0);
  }

  console.log(`Will create ${toCreate.length} Shop(s) for unmatched MarketplaceAccount jumiaShopSid values.`);
  console.log('\nDry-run output (Prisma calls and SQL). To actually apply run:');
  console.log('  APPLY=1 node scripts/create-shops-for-unmatched.js');
  console.log('\n---\n');

  for (const acc of toCreate){
    const shopName = acc.displayName || ('Jumia ' + acc.jumiaShopSid.slice(0,8));
    console.log(`// MarketplaceAccount: ${acc.id} (${acc.displayName})`);
    console.log(`// jumiaShopSid: ${acc.jumiaShopSid}`);
    console.log('Prisma:');
    console.log(`await prisma.shop.create({ data: { name: ${JSON.stringify(shopName)}, jumiaShopSid: ${JSON.stringify(acc.jumiaShopSid)}, platform: 'JUMIA' } });`);
    console.log('SQL:');
    console.log(`INSERT INTO "Shop" (id, name, "jumiaShopSid", platform, "createdAt", "updatedAt") VALUES (gen_random_uuid()::text, ${JSON.stringify(shopName)}, ${JSON.stringify(acc.jumiaShopSid)}, 'JUMIA', now(), now());`);
    console.log('\n');
  }

  if (process.env.APPLY === '1' || process.env.APPLY === 'true'){
    console.log('APPLY set — creating Shop rows...');
    for (const acc of toCreate){
      const shopName = acc.displayName || ('Jumia ' + acc.jumiaShopSid.slice(0,8));
      try {
        const created = await prisma.shop.create({ data: { name: shopName, jumiaShopSid: acc.jumiaShopSid, platform: 'JUMIA' } });
        console.log(`Created Shop.id=${created.id} for account ${acc.id}`);
      } catch (err){
        console.error('Failed to create Shop for', acc.id, err.message);
      }
    }
  }

  await prisma.$disconnect();
}

main().catch(e=>{ console.error(e); process.exit(1); }).finally(()=>process.exit(0));
