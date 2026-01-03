#!/usr/bin/env node
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function getTradingPeriodFor(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const year = d.getFullYear();
  const month = d.getMonth();
  const day = d.getDate();

  let startYear, startMonth, endYear, endMonth;
  if (day >= 25) {
    startYear = year;
    startMonth = month;
    const next = new Date(year, month + 1, 1);
    endYear = next.getFullYear();
    endMonth = next.getMonth();
  } else {
    const prev = new Date(year, month - 1, 1);
    startYear = prev.getFullYear();
    startMonth = prev.getMonth();
    endYear = year;
    endMonth = month;
  }
  const start = new Date(startYear, startMonth, 25, 0, 0, 0, 0);
  const end = new Date(endYear, endMonth, 24, 23, 59, 59, 999);
  return { start, end };
}

async function auditForUser(targetUserId) {
  console.log('\n--- Audit for', targetUserId, '---');
  const user = await prisma.user.findUnique({ where: { id: targetUserId }, select: { email: true, name: true } });
  const userEmail = user?.email ?? null;
  const userName = user?.name ?? null;

  const now = new Date();
  const period = getTradingPeriodFor(now);
  console.log('Period:', period.start.toISOString(), '->', period.end.toISOString());

  // marketing receipts where dailyEntry submittedBy matches id/email/name OR dailyEntry date in period and receipts in that period
  const marketing = await prisma.marketingReceipt.findMany({
    where: {
      createdAt: { gte: period.start, lte: period.end },
      OR: [
        { dailyEntry: { submittedById: targetUserId } },
        ...(userEmail ? [{ dailyEntry: { submittedByEmail: userEmail } }] : []),
        ...(userName ? [{ dailyEntry: { submittedByName: userName } }] : []),
      ],
    },
    select: {
      id: true,
      receiptNumber: true,
      receiptKey: true,
      createdAt: true,
      sellingTotal: true,
      buyingTotal: true,
      paymentMethod: true,
      dailyEntry: { select: { submittedById: true, submittedByEmail: true, submittedByName: true } },
    },
  });

  // Support entries only have submittedById on the daily entry
  const support = await prisma.supportReceipt.findMany({
    where: {
      createdAt: { gte: period.start, lte: period.end },
      dailyEntry: { submittedById: targetUserId },
    },
    select: {
      id: true,
      receiptNumber: true,
      receiptKey: true,
      createdAt: true,
      sellingTotal: true,
      buyingTotal: true,
      paymentMethod: true,
      dailyEntry: { select: { submittedById: true } },
    },
  });

  console.log('Marketing receipts found:', marketing.length);
  console.log('Support receipts found:', support.length);

  // Also check MarketingSale rows (these contribute to marketing totals)
  const marketingSales = await prisma.marketingSale.findMany({
    where: {
      createdAt: { gte: period.start, lte: period.end },
      entry: {
        submittedById: targetUserId,
        OR: [
          ...(userEmail ? [{ submittedByEmail: userEmail }] : []),
          ...(userName ? [{ submittedByName: userName }] : []),
        ],
      },
    },
    select: { id: true, product: true, sellingPrice: true, paymentMethod: true, receiptNumber: true, createdAt: true, entry: { select: { submittedById: true, submittedByEmail: true, submittedByName: true } } },
  });

  const supportSales = await prisma.supportSale.findMany({
    where: {
      createdAt: { gte: period.start, lte: period.end },
      entry: { submittedById: targetUserId },
    },
    select: { id: true, product: true, sellingPrice: true, paymentMethod: true, receiptNumber: true, createdAt: true, entry: { select: { submittedById: true } } },
  });

  console.log('Marketing sales rows found:', marketingSales.length);
  console.log('Support sales rows found:', supportSales.length);

  const mapOwners = (rows) => {
    const owners = new Set();
    const ownerEmails = new Set();
    const recs = rows.map(r => {
      const ownerId = r.dailyEntry?.submittedById ?? null;
      const ownerEmail = r.dailyEntry?.submittedByEmail ?? null;
      if (ownerId) owners.add(ownerId);
      if (ownerEmail) ownerEmails.add(String(ownerEmail).toLowerCase());
      return {
        id: r.id,
        receiptNumber: r.receiptNumber,
        receiptKey: r.receiptKey,
        createdAt: r.createdAt,
        sellingTotal: r.sellingTotal,
        buyingTotal: r.buyingTotal,
        paymentMethod: r.paymentMethod,
        ownerId,
        ownerEmail
      };
    });
    const foreign = recs.filter(r => {
      if (r.ownerId) return r.ownerId !== targetUserId;
      if (r.ownerEmail && userEmail) return String(r.ownerEmail).toLowerCase() !== String(userEmail).toLowerCase();
      return false;
    });
    return { recs, owners: Array.from(owners), ownerEmails: Array.from(ownerEmails), foreign };
  };

  const m = mapOwners(marketing);
  const s = mapOwners(support);

  console.log('\nMarketing owners:', m.owners);
  console.log('Marketing owner emails:', m.ownerEmails);
  console.log('Marketing foreign count:', m.foreign.length);
  console.log('Marketing foreign examples:', m.foreign.slice(0,5));

  console.log('\nSupport owners:', s.owners);
  console.log('Support owner emails:', s.ownerEmails);
  console.log('Support foreign count:', s.foreign.length);
  console.log('Support foreign examples:', s.foreign.slice(0,5));

}

async function main() {
  try {
    const ids = process.argv.slice(2);
    if (ids.length === 0) {
      console.error('Usage: node scripts/marketing-report-debug.js <USER_ID> [USER_ID2 ...]');
      process.exit(2);
    }
    for (const id of ids) {
      await auditForUser(id);
    }
  } catch (e) {
    console.error('Error:', e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
