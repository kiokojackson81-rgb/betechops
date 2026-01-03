// scripts/issueronly-brendah.js
// Usage: DATABASE_URL="..." node scripts/issueronly-brendah.js --from=2025-11-25 --to=2025-12-24 --user=brendah@betech.co.ke
const { PrismaClient } = require('@prisma/client');
const argv = require('minimist')(process.argv.slice(2));
const prisma = new PrismaClient();
const userArg = argv.user || argv._[0] || 'brendah@betech.co.ke';
const fromArg = argv.from || '2025-11-25';
const toArg = argv.to || '2025-12-24';
(async () => {
  try {
    // resolve user
    let user = null;
    if (/^[0-9a-fA-F-]{10,}$/.test(userArg)) {
      user = await prisma.user.findUnique({ where: { id: userArg }, select: { id: true, email: true, name: true } });
    }
    if (!user) user = await prisma.user.findUnique({ where: { email: String(userArg).toLowerCase() }, select: { id: true, email: true, name: true } });
    if (!user) return console.error('User not found for', userArg);
    const userId = user.id;
    const from = new Date(fromArg + 'T00:00:00Z');
    const to = new Date(toArg + 'T23:59:59.999Z');
    console.log('User:', userId, user.email, user.name || '');
    console.log('Range:', from.toISOString(), '->', to.toISOString());

    const receipts = await prisma.receipt.findMany({
      where: { issuedById: userId, generatedAt: { gte: from, lte: to } },
      select: { id: true, generatedAt: true, totals: true, data: true },
      orderBy: { generatedAt: 'desc' },
    });

    const count = receipts.length;
    const sum = receipts.reduce((s, r) => s + (Number(r.totals?.total) || 0), 0);
    console.log('\nISSUER-ONLY (issuedById)');
    console.log('Count:', count);
    console.log('Sum (KES):', sum.toFixed(2));

    if (count) {
      console.log('\nSample receipts:');
      receipts.slice(0,50).forEach(r => console.log(r.id, r.receiptNumber || '', r.generatedAt && r.generatedAt.toISOString(), 'total=', (r.totals?.total || 0)));
    }
  } catch (e) {
    console.error('Error:', e && e.message ? e.message : e);
    process.exitCode = 1;
  } finally {
    try { await prisma.$disconnect(); } catch {};
  }
})();
