#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

async function main() {
  const email = process.argv[2];
  const amountArg = process.argv[3];
  if (!email || !amountArg) {
    console.error('Usage: node update-commission-for-email.js <email> <amount>');
    process.exit(2);
  }
  const amount = Number(amountArg);
  if (Number.isNaN(amount)) {
    console.error('Invalid amount:', amountArg);
    process.exit(2);
  }

  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      console.error('User not found for email', email);
      process.exit(3);
    }

    const ledgers = await prisma.commissionLedger.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, take: 5 });
    if (!ledgers || ledgers.length === 0) {
      console.error('No CommissionLedger rows found for user', email, user.id);
      process.exit(4);
    }

    const target = ledgers[0];
    const backupDir = path.resolve(process.cwd(), 'logs');
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
    const backupPath = path.join(backupDir, `commission_ledger_backup_${user.id}_${target.id}.json`);
    fs.writeFileSync(backupPath, JSON.stringify({ before: target, timestamp: new Date().toISOString() }, null, 2));
    console.log('Backed up ledger to', backupPath);

    const updated = await prisma.commissionLedger.update({
      where: { id: target.id },
      data: {
        commissionTotal: amount,
        grossCommission: amount,
        netCommission: amount,
        commissionBreakdown: { correctedBy: 'ops', correctedAt: new Date().toISOString(), note: 'Manual correction per request' },
      },
    });

    const afterPath = path.join(backupDir, `commission_ledger_after_${user.id}_${target.id}.json`);
    fs.writeFileSync(afterPath, JSON.stringify({ after: updated, timestamp: new Date().toISOString() }, null, 2));
    console.log('Updated ledger row. Saved after snapshot to', afterPath);
    console.log('Result:', updated);
  } catch (err) {
    console.error('Error:', err && err.message ? err.message : err);
    process.exit(10);
  } finally {
    try { await prisma.$disconnect(); } catch (e) {}
  }
}

main();
