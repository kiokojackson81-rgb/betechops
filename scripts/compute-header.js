const { PrismaClient } = require('@prisma/client');
(async () => {
  const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
  try {
    const b = await prisma.branding.findUnique({ where: { name: 'default' } });
    console.log('branding:', b);
    const isHttp = (v) => typeof v === 'string' && /^https?:\/\//.test(v);
    const envLetter = process.env.NEXT_PUBLIC_RECEIPT_LETTERHEAD_URL || '';
    const envLogo = process.env.NEXT_PUBLIC_RECEIPT_LOGO_URL || '';
    const letterheadUrl = isHttp(b?.letterheadUrl) ? b.letterheadUrl : isHttp(envLetter) ? envLetter : '';
    const logoUrl = isHttp(b?.logoUrl) ? b.logoUrl : isHttp(envLogo) ? envLogo : '/logo.png';
    const headerImg = letterheadUrl || logoUrl;
    console.log('letterheadUrl:', letterheadUrl);
    console.log('logoUrl:', logoUrl);
    console.log('headerImg:', headerImg);
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
})();
