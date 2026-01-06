import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const accounts = await prisma.marketplaceAccount.findMany({ orderBy: { displayName: 'asc' } });
  console.log('Total accounts:', accounts.length);
  for (const a of accounts) {
    console.log('---');
    console.log('id:', a.id);
    console.log('displayName:', a.displayName);
    console.log('platform:', a.platform);
    console.log('jumiaShopSid:', a.jumiaShopSid);
  }
}

main().catch(e=>{ console.error(e); process.exit(1); });
