const { PrismaClient, Prisma } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const id = process.argv[2];
  if (!id) {
    console.error('Usage: node scripts/check-receipt-pos-filter.js <receiptId>');
    process.exit(2);
  }

  const start = new Date('2026-01-01T00:00:00Z');
  const end = new Date('2026-12-31T23:59:59Z');

  try {
    const matches = await prisma.receipt.findMany({
      where: {
        id: id,
        generatedAt: { gte: start, lte: end },
        OR: [
          { data: { path: ['podDelivery'], equals: Prisma.JsonNull } },
          { data: { path: ['podDelivery', 'status'], not: { equals: 'pending' } } },
        ],
      },
      select: { id: true, data: true, totals: true },
    });

    if (matches.length > 0) {
      console.log('Receipt matches POS filter (would be INCLUDED):', matches[0].id);
      console.log('Matched row data:', JSON.stringify(matches[0], null, 2));
    } else {
      console.log('Receipt does NOT match POS filter (would be EXCLUDED):', id);
    }
  } catch (err) {
    console.error('Query failed', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
