async function main() {
  const { prisma } = await import('../src/lib/prisma.ts');
  const accountId = 'c6847a48-c9d8-45b9-b87b-2e22102ab4ab';
  const account = await prisma.marketplaceAccount.findUnique({ where: { id: accountId } });
  console.log('MarketplaceAccount:', { id: account?.id, displayName: account?.displayName, jumiaShopSid: account?.jumiaShopSid });
  if (account?.jumiaShopSid) {
    const shop = await prisma.shop.findFirst({ where: { jumiaShopSid: account.jumiaShopSid } });
    console.log('Mapped Shop:', shop ? { id: shop.id, name: shop.name, jumiaShopSid: shop.jumiaShopSid } : null);
  } else {
    console.log('No jumiaShopSid present for account.');
    const shopsByName = await prisma.shop.findMany({ where: { name: { contains: 'LabTech', mode: 'insensitive' } }, take: 20 });
    console.log('Candidate shops by name (LabTech):', shopsByName.map(s => ({ id: s.id, name: s.name, jumiaShopSid: s.jumiaShopSid })));
  }
  await prisma.$disconnect().catch(() => undefined);
}

main().catch(e => { console.error('failed:', e); process.exit(1); });
