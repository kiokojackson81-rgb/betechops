#!/usr/bin/env node
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const apply = process.argv.includes('--apply');
  console.log('fix-pod-pending-status: starting', { apply });

  // Find receipts that have podDelivery.sentAt but missing podDelivery.status
  const selectSql = `
    SELECT id, data->'podDelivery' AS pod_delivery
    FROM "Receipt"
    WHERE (data->'podDelivery'->>'sentAt') IS NOT NULL
      AND (data->'podDelivery'->>'status') IS NULL
    LIMIT 1000;
  `;

  const rows = await prisma.$queryRawUnsafe(selectSql);
  console.log(`Found ${rows.length} candidate receipts (showing up to 1000)`);
  for (const r of rows) {
    console.log(r.id, JSON.stringify(r.pod_delivery).slice(0, 200));
  }

  if (!rows.length) {
    console.log('No receipts need updating.');
    return;
  }

  if (!apply) {
    console.log('\nDry-run complete. To apply changes run:');
    console.log('  node scripts/fix-pod-pending-status.js --apply');
    return;
  }

  const updateSql = `
    UPDATE "Receipt"
    SET data = jsonb_set(data, '{podDelivery,status}', '"pending"', true)
    WHERE (data->'podDelivery'->>'sentAt') IS NOT NULL
      AND (data->'podDelivery'->>'status') IS NULL;
  `;

  const result = await prisma.$executeRawUnsafe(updateSql);
  console.log('Update executed, rows affected:', result);
}

main()
  .catch((err) => {
    console.error('Error running script', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
