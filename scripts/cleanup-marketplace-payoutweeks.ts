import fs from 'fs';
import { PrismaClient } from '@prisma/client';
import { chooseAuthoritativeCandidate } from '../src/lib/payoutDeduper.ts';

function canonicalNairobiWeekStartUtc(dateUtc: Date): Date {
  const NAIR0BI_OFFSET_HOURS = 3;
  const nairobiMs = dateUtc.getTime() + NAIR0BI_OFFSET_HOURS * 3600 * 1000;
  const nairobi = new Date(nairobiMs);
  const y = nairobi.getUTCFullYear();
  const m = nairobi.getUTCMonth();
  const d = nairobi.getUTCDate();
  const nairobiMidnightUtcMs = Date.UTC(y, m, d, 0, 0, 0) - NAIR0BI_OFFSET_HOURS * 3600 * 1000;
  const nairobiLocalMidnight = new Date(nairobiMidnightUtcMs + NAIR0BI_OFFSET_HOURS * 3600 * 1000);
  const day = nairobiLocalMidnight.getUTCDay();
  const deltaToMonday = (day + 6) % 7;
  const mondayUtcMs = nairobiMidnightUtcMs - deltaToMonday * 24 * 3600 * 1000;
  return new Date(mondayUtcMs);
}

async function main() {
  const startArg = process.argv[2];
  const endArg = process.argv[3];
  const start = startArg ? new Date(startArg) : new Date('1970-01-01');
  const end = endArg ? new Date(endArg) : new Date();
  const apply = String(process.env.APPLY ?? '').toLowerCase() === 'true';

  const prisma = new PrismaClient();
  const rows = await prisma.marketplacePayoutWeek.findMany({ where: { AND: [{ weekStart: { lte: end } }, { weekEnd: { gte: start } }] }, orderBy: [{ accountId: 'asc' }, { weekStart: 'asc' }] });

  // group by accountId + canonical weekStart
  const groups = new Map<string, any[]>();
  for (const r of rows) {
    const cstart = canonicalNairobiWeekStartUtc(new Date(r.weekStart)).toISOString();
    const key = `${r.accountId}::${cstart}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }

  const report: any[] = [];
  for (const [key, items] of groups.entries()) {
    if (items.length <= 1) continue;
    // build candidates for chooser
    const candidates = items.map((r) => ({ id: r.id, statementNumber: r.statementNumber ?? null, amount: Number(r.payoutAmount ?? r.grossSales ?? 0), createdAt: r.createdAt ? new Date(r.createdAt) : new Date(0), rawPayload: r.rawPayload, isPaid: r.isPaid ?? false }));
    const incoming = { id: null, statementNumber: null, amount: 0, createdAt: new Date(0), rawPayload: null, isPaid: false };
    candidates.push(incoming);
    const keeper = chooseAuthoritativeCandidate(candidates as any);

    // If keeper is the synthetic incoming (id===null) choose earliest DB row as keeperRow
    const keeperRow = keeper.id ? items.find((x) => x.id === keeper.id)! : items[0];
    const otherIds = items.filter((x) => x.id !== keeperRow.id).map((x) => x.id);
    const removedStatements = items.filter((x) => otherIds.includes(x.id)).map((x) => x.statementNumber).filter(Boolean);

    report.push({ accountId: items[0].accountId, canonicalWeekStart: key.split('::')[1], keeperId: keeperRow.id, removedIds: otherIds, removedStatementNumbers: removedStatements });

    if (apply) {
      try {
        await prisma.marketplacePayoutWeek.update({ where: { id: keeperRow.id }, data: { grossSales: keeper.amount ?? Number(keeperRow.grossSales ?? 0), payoutAmount: keeper.amount ?? Number(keeperRow.payoutAmount ?? 0), statementNumber: keeper.statementNumber ?? keeperRow.statementNumber ?? null, rawPayload: keeper.rawPayload ?? keeperRow.rawPayload, weekStart: new Date(key.split('::')[1]), weekEnd: new Date(new Date(key.split('::')[1]).getTime() + 7 * 24 * 3600 * 1000 - 1) } });
      } catch (e) {
        console.warn('failed update keeper', e);
      }
      if (otherIds.length) {
        try {
          await prisma.marketplacePayoutWeek.deleteMany({ where: { id: { in: otherIds } } });
        } catch (e) {
          console.warn('failed deleting others', e);
        }
      }
    }
  }

  fs.mkdirSync('.tmp', { recursive: true });
  fs.writeFileSync('.tmp/cleanup_marketplace_payoutweeks_report.json', JSON.stringify({ applied: apply, generatedAt: new Date().toISOString(), entries: report }, null, 2));
  console.log(`Wrote .tmp/cleanup_marketplace_payoutweeks_report.json — groups: ${report.length} (apply=${apply})`);

  await prisma.$disconnect().catch(() => undefined);
}

main().catch((e) => {
  console.error('cleanup failed', e);
  process.exit(1);
});
