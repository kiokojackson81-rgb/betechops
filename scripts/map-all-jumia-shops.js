try { require('dotenv').config(); } catch {}
const prisma = require('../.worker-dist/src/lib/prisma').prisma;

async function main(){
  console.log('Fetching MarketplaceAccount rows with jumiaShopSid...');
  const accounts = await prisma.marketplaceAccount.findMany({ where: { jumiaShopSid: { not: null } }, select: { id: true, displayName: true, jumiaShopSid: true } });

  console.log(`Found ${accounts.length} MarketplaceAccount(s) with jumiaShopSid`);

  const shops = await prisma.shop.findMany({ select: { id: true, name: true, jumiaShopSid: true } });
  const shopsByJumia = new Map(shops.filter(s => s.jumiaShopSid).map(s => [s.jumiaShopSid, s]));
  const shopsById = new Map(shops.map(s => [s.id, s]));

  const unmatched = [];

  for (const acc of accounts){
    const sid = acc.jumiaShopSid;
    const bySid = shopsByJumia.get(sid);
    const byId = shopsById.get(sid);
    if (bySid){
      console.log(`${acc.id} (${acc.displayName}) -> Shop.id=${bySid.id} (matched by jumiaShopSid=${sid})`);
    } else if (byId){
      console.log(`${acc.id} (${acc.displayName}) -> Shop.id=${byId.id} (matched by Shop.id === jumiaShopSid)`);
    } else {
      console.log(`${acc.id} (${acc.displayName}) -> UNMATCHED (jumiaShopSid=${sid})`);
      unmatched.push(acc);
    }
  }

  if (unmatched.length){
    console.log('\nSuggested actions to map unmatched accounts:');
    console.log('- If a Shop exists but missing jumiaShopSid, run the SQL below to set it (replace <SHOP_ID>):');
    console.log("  UPDATE \"Shop\" SET \"jumiaShopSid\" = '<JUMIA_SID>' WHERE id = '<SHOP_ID>';\n");

    console.log('- Or, create a Shop entry that links to the MarketplaceAccount:');
    console.log('  INSERT INTO "Shop" (id, name, "jumiaShopSid", "marketplaceAccountId") VALUES (\'<NEW_SHOP_ID>\', \'New Shop\', \'<JUMIA_SID>\', \'<MARKETPLACE_ACCOUNT_ID>\');\n');

    console.log('Prisma snippet (run in a safe script) to set jumiaShopSid for a Shop:');
    console.log("await prisma.shop.update({ where: { id: '<SHOP_ID>' }, data: { jumiaShopSid: '<JUMIA_SID>' } });");

    console.log('\nUnmatched Accounts:');
    unmatched.forEach(a => console.log(`- ${a.id} ${a.displayName} -> ${a.jumiaShopSid}`));
  } else {
    console.log('\nAll MarketplaceAccount jumiaShopSid values are mapped to Shop rows.');
  }
}

main().catch(e=>{ console.error(e); process.exit(1); }).finally(()=>process.exit(0));
