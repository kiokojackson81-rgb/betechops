#!/usr/bin/env node
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function canonical(s) {
  if (!s) return '';
  return String(s).trim();
}

async function findReceipt(serial) {
  const s = canonical(serial);
  if (!s) {
    console.error('Provide a receipt serial as argument');
    process.exit(2);
  }

  // flexible queries
  const support = await prisma.supportReceipt.findMany({
    where: {
      OR: [
        { receiptNumber: s },
        { receiptNumber: { contains: s } },
        { receiptKey: s },
        { receiptKey: { contains: s } },
      ],
    },
    include: { items: true, dailyEntry: true },
  });

  const marketing = await prisma.marketingReceipt.findMany({
    where: {
      OR: [
        { receiptNumber: s },
        { receiptNumber: { contains: s } },
        { receiptKey: s },
        { receiptKey: { contains: s } },
      ],
    },
    include: { items: true, dailyEntry: true },
  });

  return { support, marketing };
}

async function main() {
  const serial = process.argv[2];
  if (!serial) {
    console.error('Usage: node find-receipt.js <receiptSerial>');
    process.exit(2);
  }

  try {
    const res = await findReceipt(serial);
    const out = [];
    for (const r of res.support) {
      const items = (r.items || []).map(it => ({ id: it.id, productName: it.productName, sellingPrice: Number(it.sellingPrice || 0), buyingPrice: Number(it.buyingPrice || 0) }));
      const selling = Number(r.sellingTotal || 0);
      const buying = Number(r.buyingTotal || 0);
      out.push({ source: 'supportReceipt', id: r.id, receiptNumber: r.receiptNumber, receiptKey: r.receiptKey, date: r.createdAt || r.updatedAt || null, sellingTotal: selling, buyingTotal: buying, profit: selling - buying, items });
    }
    for (const r of res.marketing) {
      const items = (r.items || []).map(it => ({ id: it.id, productName: it.productName, sellingPrice: Number(it.sellingPrice || it.unitPrice || 0), buyingPrice: Number(it.buyingPrice || 0) }));
      const selling = Number(r.sellingTotal || 0);
      const buying = Number(r.buyingTotal || 0);
      out.push({ source: 'marketingReceipt', id: r.id, receiptNumber: r.receiptNumber, receiptKey: r.receiptKey, date: r.createdAt || r.updatedAt || null, sellingTotal: selling, buyingTotal: buying, profit: selling - buying, items });
    }

    if (out.length === 0) {
      console.log('No matching receipts found for', serial);
    } else {
      console.log(JSON.stringify(out, null, 2));
    }
  } catch (err) {
    console.error('Error querying receipts', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
