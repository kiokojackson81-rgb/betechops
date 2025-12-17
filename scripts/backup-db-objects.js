#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

async function main() {
  const outDir = path.resolve(process.cwd(), 'db-backups');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const outPath = path.join(outDir, `backup_objects_${ts}.json`);

  const prisma = new PrismaClient();
  try {
    console.log('Connecting via Prisma...');
    // Fetch key tables
    const [commissionLedger, adjustments, weeklySales, users] = await Promise.all([
      prisma.commissionLedger.findMany({}),
      prisma.attendantPayrollAdjustment.findMany({}),
      prisma.weeklySale.findMany({ orderBy: { createdAt: 'desc' }, take: 1000 }),
      prisma.user.findMany({ select: { id: true, email: true, name: true } }),
    ]);

    const payload = { meta: { generatedAt: new Date().toISOString() }, commissionLedger, adjustments, weeklySales, users };
    fs.writeFileSync(outPath, JSON.stringify(payload, null, 2));
    console.log('Wrote JSON backup to', outPath);
  } catch (err) {
    console.error('Backup failed:', err && err.message ? err.message : err);
    process.exitCode = 2;
  } finally {
    try { await prisma.$disconnect(); } catch (e) {}
  }
}

main();
