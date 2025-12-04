#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error('Usage: node scripts/export_commission_ledger.js <startDate YYYY-MM-DD> <endDate YYYY-MM-DD>');
    process.exit(2);
  }
  const [startStr, endStr] = args;
  const startDate = new Date(startStr + 'T00:00:00Z');
  const endDate = new Date(endStr + 'T23:59:59Z');

  const prisma = new PrismaClient();
  try {
    console.log('Querying commissionLedger for period', startStr, '→', endStr);
    const rows = await prisma.commissionLedger.findMany({
      where: {
        AND: [
          { periodStart: { gte: startDate } },
          { periodEnd: { lte: endDate } },
        ],
      },
      orderBy: [{ periodStart: 'asc' }],
    });

    const outDir = path.join(process.cwd(), 'report');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    const jsonPath = path.join(outDir, `commission_ledger_${startStr}_${endStr}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(rows, null, 2), 'utf8');
    console.log('Wrote', jsonPath);

    // Build CSV
    const csvPath = path.join(outDir, `commission_ledger_${startStr}_${endStr}.csv`);
    const header = ['id','userId','periodKey','periodStart','periodEnd','grossCommission','netCommission','penalties','detail'];
    const lines = [header.join(',')];
    for (const r of rows) {
      const detail = typeof r.detail === 'object' ? JSON.stringify(r.detail).replace(/"/g, '""') : String(r.detail || '');
      const values = [
        r.id,
        r.userId || '',
        r.periodKey || '',
        r.periodStart ? new Date(r.periodStart).toISOString() : '',
        r.periodEnd ? new Date(r.periodEnd).toISOString() : '',
        r.grossCommission ?? '',
        r.netCommission ?? '',
        r.penalties ?? '',
        `"${detail}"`,
      ];
      lines.push(values.join(','));
    }
    fs.writeFileSync(csvPath, lines.join('\n'), 'utf8');
    console.log('Wrote', csvPath);

    if (rows.length === 0) {
      console.log('No rows found for period', periodKey);
    } else {
      console.log('Found', rows.length, 'rows');
    }
  } catch (err) {
    console.error('Failed to export commission ledger:', err);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
