#!/usr/bin/env node
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function usage() {
  console.log('Usage: node scripts/backfill-pod-receipt.js --receipt <RECEIPT_NUMBER_OR_ID> [--db <DATABASE_URL>] [--apply]');
  process.exit(1);
}

const argv = require('minimist')(process.argv.slice(2));
const needle = argv.receipt || argv.r;
const dbUrl = argv.db || process.env.DATABASE_URL;
const apply = Boolean(argv.apply || argv.a);

if (!needle) usage();
if (!dbUrl) {
  console.error('Missing DATABASE_URL. Provide via --db or set DATABASE_URL env var.');
  process.exit(2);
}

process.env.DATABASE_URL = dbUrl;

async function run() {
  await prisma.$connect();
  // Try find by id exact first, then by receiptNumber contains (case-insensitive)
  let receipt = await prisma.receipt.findUnique({ where: { id: needle } }).catch(() => null);
  if (!receipt) {
    receipt = await prisma.receipt.findFirst({ where: { receiptNumber: { contains: needle, mode: 'insensitive' } } });
  }

  if (!receipt) {
    console.error('Receipt not found for', needle);
    await prisma.$disconnect();
    process.exit(3);
  }

  console.log('Found receipt:', receipt.id, receipt.receiptNumber ?? '(no number)');
  const baseData = typeof receipt.data === 'object' && receipt.data ? { ...(receipt.data) } : {};
  const existingPod = baseData.podDelivery ?? null;
  console.log('Existing podDelivery:', JSON.stringify(existingPod, null, 2));

  const patch = {
    status: existingPod?.status ?? 'pending',
    sentAt: existingPod?.sentAt ?? new Date().toISOString(),
    sentBy: existingPod?.sentBy ?? 'backfill-script',
    note: existingPod?.note ?? 'backfilled: mark creation-time podDelivery as pending to exclude from totals',
    contactId: existingPod?.contactId ?? null,
  };

  const nextData = { ...baseData, podDelivery: { ...(existingPod || {}), ...patch } };

  console.log('\nProposed podDelivery to write (dry-run):');
  console.log(JSON.stringify(nextData.podDelivery, null, 2));

  if (!apply) {
    console.log('\nDry-run only. To apply this change run with --apply');
    await prisma.$disconnect();
    process.exit(0);
  }

  // Apply update
  const updated = await prisma.receipt.update({ where: { id: receipt.id }, data: { data: nextData } });
  console.log('Applied update. New podDelivery:', JSON.stringify((updated.data || {}).podDelivery ?? null, null, 2));
  await prisma.$disconnect();
}

run().catch((err) => {
  console.error('Unexpected error', err);
  prisma.$disconnect().catch(() => {});
  process.exit(10);
});
