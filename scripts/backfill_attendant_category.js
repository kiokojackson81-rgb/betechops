#!/usr/bin/env node
/*
 Backfill a single user's attendantCategory.

 Usage:
   $env:DATABASE_URL = "postgresql://...";
   node scripts/backfill_attendant_category.js --email user@example.com --category JUMIA_KILIMALL_OPS

 Or by id:
   node scripts/backfill_attendant_category.js --id <user-uuid> --category GENERAL

 This script is intentionally simple and performs a single update.
 Review and test before running in production.
*/
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--email') out.email = args[++i];
    else if (a === '--id') out.id = args[++i];
    else if (a === '--category') out.category = args[++i];
    else if (a === '--dry-run') out.dryRun = true;
  }
  return out;
}

async function main() {
  const { email, id, category, dryRun } = parseArgs();
  if (!category) {
    console.error('Missing --category argument');
    process.exit(2);
  }
  if (!email && !id) {
    console.error('Provide --email or --id to identify the user');
    process.exit(2);
  }

  const where = email ? { email } : { id };
  const existing = await prisma.user.findUnique({ where, select: { id: true, email: true, attendantCategory: true } });
  if (!existing) {
    console.error('User not found for', where);
    process.exit(3);
  }

  console.log('User before update:', existing);
  if (dryRun) {
    console.log('Dry-run mode; no update performed.');
    return;
  }

  const updated = await prisma.user.update({ where, data: { attendantCategory: category } });
  console.log('User updated:', { id: updated.id, email: updated.email, attendantCategory: updated.attendantCategory });
}

main()
  .catch((err) => {
    console.error('Error during backfill:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
