#!/usr/bin/env node
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Usage: node scripts/fix-fridge-loan-period.js <adjustmentId> <periodKey>
async function main() {
  const id = process.argv[2];
  const periodKey = process.argv[3];
  if (!id || !periodKey) {
    console.error('Usage: node scripts/fix-fridge-loan-period.js <adjustmentId> <periodKey>');
    process.exit(2);
  }
  const adj = await prisma.attendantPayrollAdjustment.findUnique({ where: { id } });
  if (!adj) {
    console.error('Adjustment not found:', id);
    process.exit(2);
  }
  const updated = await prisma.attendantPayrollAdjustment.update({ where: { id }, data: { periodKey, periodLabel: periodKey } });
  console.log('updated adjustment', updated.id, 'periodKey=', updated.periodKey);
  process.exit(0);
}

main().catch((e)=>{ console.error(e); process.exit(1); });