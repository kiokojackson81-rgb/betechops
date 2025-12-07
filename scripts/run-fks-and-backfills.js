// scripts/run-fks-and-backfills.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const constraints = [
  {
    name: 'CommissionRecord_orderId_fkey',
    sql: `ALTER TABLE "CommissionRecord" ADD CONSTRAINT "CommissionRecord_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;`
  },
  {
    name: 'CommissionRecord_attendantId_fkey',
    sql: `ALTER TABLE "CommissionRecord" ADD CONSTRAINT "CommissionRecord_attendantId_fkey" FOREIGN KEY ("attendantId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;`
  },
  {
    name: 'Receipt_orderId_fkey',
    sql: `ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;`
  },
  {
    name: 'Receipt_issuedById_fkey',
    sql: `ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;`
  },
  {
    name: 'ReceiptFile_receiptId_fkey',
    sql: `ALTER TABLE "ReceiptFile" ADD CONSTRAINT "ReceiptFile_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "Receipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;`
  },
  {
    name: 'LayawayPlan_orderId_fkey',
    sql: `ALTER TABLE "LayawayPlan" ADD CONSTRAINT "LayawayPlan_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;`
  },
  {
    name: 'LayawayPayment_planId_fkey',
    sql: `ALTER TABLE "LayawayPayment" ADD CONSTRAINT "LayawayPayment_planId_fkey" FOREIGN KEY ("planId") REFERENCES "LayawayPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;`
  },
  {
    name: 'Balance_userId_fkey',
    sql: `ALTER TABLE "Balance" ADD CONSTRAINT "Balance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;`
  }
];

async function existsConstraint(name) {
  const res = await prisma.$queryRawUnsafe(`SELECT 1 FROM pg_constraint WHERE conname = $1 LIMIT 1`, name);
  return Array.isArray(res) && res.length > 0;
}

async function applyConstraint(c) {
  try {
    const exists = await existsConstraint(c.name);
    if (exists) {
      console.log(`Constraint ${c.name} already exists, skipping`);
      return;
    }
    console.log(`Applying constraint ${c.name}...`);
    await prisma.$executeRawUnsafe(c.sql);
    console.log(`Applied ${c.name}`);
  } catch (e) {
    console.error(`Failed to apply ${c.name}:`, e.message || e);
    throw e;
  }
}

async function main() {
  console.log('Starting FK application');
  for (const c of constraints) {
    await applyConstraint(c);
  }
  console.log('FK application complete');
}

main()
  .catch(async (err) => {
    console.error('Error in run-fks-and-backfills:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
