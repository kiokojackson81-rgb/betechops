#!/usr/bin/env node
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Usage: node scripts/create-fridge-loan.js stephen@betech.co.ke 10000
async function main() {
  const email = process.argv[2] || 'stephen@betech.co.ke';
  const amount = Number(process.argv[3] || 10000);
  if (!email) throw new Error('email required');
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error('user not found for', email);
    process.exit(2);
  }
  const periodKey = (new Date()).toISOString().slice(0,10); // simple periodKey; adjust if needed
  const created = await prisma.attendantPayrollAdjustment.create({
    data: {
      attendantId: user.id,
      periodKey: periodKey,
      periodLabel: periodKey,
      adjustmentType: 'OTHER',
      adjustmentKind: 'DEDUCTION',
      label: 'Fridge Loan',
      amount: Math.trunc(Math.max(0, amount)),
      createdById: user.id,
    }
  });
  console.log('created adjustment', created.id, 'for', email);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });