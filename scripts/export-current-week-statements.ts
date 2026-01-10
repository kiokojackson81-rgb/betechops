import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { prisma } from '../src/lib/prisma.ts';
import { mondayToSundayNairobiWindow, normalizeWeekStartFromParam } from '../src/lib/weekwindow.ts';

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

async function main() {
  const rawArg = process.argv[2];
  let weekStart: Date;
  if (rawArg) {
    const parsed = normalizeWeekStartFromParam(rawArg);
    if (!parsed) {
      console.error('Could not parse weekStart argument:', rawArg);
      process.exit(2);
    }
    weekStart = parsed;
  } else {
    const now = new Date();
    weekStart = mondayToSundayNairobiWindow(now).weekStart;
  }
  const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 3600 * 1000);

  // Match weekStart within a tolerance window to accommodate canonical UTC offsets
  const tolMs = 36 * 3600 * 1000; // 36 hours
  const windowStart = new Date(weekStart.getTime() - tolMs);
  const windowEnd = new Date(weekStart.getTime() + tolMs);

  const rows = await prisma.marketplacePayoutWeek.findMany({
    where: {
      AND: [
        { weekStart: { gte: windowStart } },
        { weekStart: { lt: windowEnd } },
        { account: { platform: 'JUMIA' } },
      ],
    },
    include: { account: true },
    orderBy: { accountId: 'asc' },
  });

  if (!rows.length) {
    console.log('No payout week rows found for', weekStart.toISOString(), '->', weekEnd.toISOString());
    await prisma.$disconnect();
    return;
  }

  const fileName = `statements-${weekStart.toISOString().slice(0,10)}.csv`;
  const outPath = path.resolve(process.cwd(), fileName);
  const headers = [
    'accountId',
    'accountDisplayName',
    'statementNumber',
    'weekStart',
    'weekEnd',
    'grossSales',
    'payoutAmount',
    'currency',
    'isPaid',
    'createdAt',
  ];

  const lines = [headers.join(',')];
  for (const r of rows) {
    lines.push([
      csvEscape(r.accountId),
      csvEscape(r.account?.displayName ?? ''),
      csvEscape(r.statementNumber),
      csvEscape(r.weekStart?.toISOString() ?? ''),
      csvEscape(r.weekEnd?.toISOString() ?? ''),
      csvEscape(r.grossSales?.toString() ?? ''),
      csvEscape(r.payoutAmount?.toString() ?? ''),
      csvEscape(r.currency),
      csvEscape(r.isPaid),
      csvEscape(r.createdAt?.toISOString() ?? ''),
    ].join(','));
  }

  fs.writeFileSync(outPath, lines.join('\n'));
  console.log('Wrote', rows.length, 'rows to', outPath);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect().catch(() => {});
  process.exit(1);
});
