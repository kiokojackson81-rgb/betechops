import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const q = process.argv[2] || 'jude';
  console.log('Searching for accounts/shops matching', q);
  const accounts = await prisma.marketplaceAccount.findMany({ where: { displayName: { contains: q, mode: 'insensitive' } } });
  console.log('MarketplaceAccounts:', accounts.length);
  for (const a of accounts) console.log({ id: a.id, displayName: a.displayName, jumiaShopSid: a.jumiaShopSid });
  const shops = await prisma.shop.findMany({ where: { name: { contains: q, mode: 'insensitive' } } });
  console.log('Shops:', shops.length);
  for (const s of shops) console.log({ id: s.id, name: s.name });
}

main().catch(e => { console.error(e); process.exit(1); });
