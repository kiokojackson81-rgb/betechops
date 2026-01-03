#!/usr/bin/env node
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Checking for Postgres enum type ProfitEventType...');
  const exists = await prisma.$queryRawUnsafe("SELECT 1 FROM pg_type WHERE typname = 'profiteventtype'");
  if (exists && exists.length) {
    console.log('ProfitEventType already exists.');
    return;
  }

  console.log('Creating enum type ProfitEventType...');
  const sql = `DO $$\nBEGIN\n  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'profiteventtype') THEN\n    CREATE TYPE \"ProfitEventType\" AS ENUM ('RECOGNISE','REVERSE');\n  END IF;\nEND$$;`;
  try {
    await prisma.$executeRawUnsafe(sql);
    console.log('Created ProfitEventType.');
  } catch (err) {
    console.error('Failed to create enum ProfitEventType:', err);
    process.exit(1);
  }
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
