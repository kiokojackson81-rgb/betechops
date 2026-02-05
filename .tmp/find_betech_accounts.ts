import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const candidates = await prisma.shop.findMany({ where: { name: { contains: 'betech', mode: 'insensitive' } } });
  console.log('Shops matching "betech":', candidates.length);
  for (const s of candidates) console.log({ id: s.id, name: s.name });

  const accounts = await prisma.marketplaceAccount.findMany({ where: { displayName: { contains: 'betech', mode: 'insensitive' } } });
  console.log('MarketplaceAccounts matching "betech":', accounts.length);
  for (const a of accounts) console.log({ id: a.id, displayName: a.displayName, jumiaShopSid: a.jumiaShopSid });
}

main().catch(e => { console.error(e); process.exit(1); });
