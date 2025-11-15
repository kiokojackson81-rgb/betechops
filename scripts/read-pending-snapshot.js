const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const key = 'jumia:pending-live';
  const cfg = await prisma.config.findUnique({ where: { key } });
  if (!cfg) {
    console.log(`No Config row found for key=${key}`);
    return;
  }
  // In the Prisma schema the Config model stores JSON in the `json` column.
  const parsed = cfg.json;
  if (!parsed) {
    console.log(`Config row for key=${key} has empty json field.`);
    console.log('Raw config:', cfg);
    return;
  }
  console.log('Pending snapshot key:', key);
  console.log('Snapshot meta: windowDays=', parsed.windowDays, 'fetchedAt=', parsed.fetchedAt);
  console.log('totalOrders:', parsed.totalOrders);
  console.log('\nFull snapshot object:');
  console.log(JSON.stringify(parsed, null, 2));
  if (parsed.perShop && Array.isArray(parsed.perShop)) {
    console.log('\nPer-shop counts:');
    const shopIds = parsed.perShop.map(s => s.shopId).filter(Boolean);
    const shops = await prisma.jumiaShop.findMany({ where: { id: { in: shopIds } } });
    const shopMap = new Map(shops.map(sh => [sh.id, sh.name]));
    parsed.perShop.forEach(s => {
      const shopName = shopMap.get(s.shopId) || '(unknown)';
      // snapshot uses `orders` as the count per shop
      const count = typeof s.orders === 'number' ? s.orders : s.count;
      console.log(`- shopId=${s.shopId} shopName=${shopName} orders=${count} pages=${s.pages} error=${s.error}`);
    });
  } else {
    console.log('No perShop data found in snapshot.');
  }
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
