require('dotenv').config();
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function canonicalNairobiWeekStartUtc(dateUtc) {
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

function parseDateOnlyUtc(s) {
  if (!s) return null;
  const d = new Date(s + 'T00:00:00Z');
  if (isNaN(d.getTime())) return null;
  return d;
}

function deriveStatementStatus(statementNumber, paid) {
  const normalizedNumber = String(statementNumber ?? '').toUpperCase();
  if (normalizedNumber.endsWith('OPEN')) return { isPaid: false, label: 'OPEN' };
  if (normalizedNumber.endsWith('PAID')) return { isPaid: true, label: 'PAID' };
  if (normalizedNumber.endsWith('UNPAID')) return { isPaid: false, label: 'UNPAID' };
  if (paid !== undefined && paid !== null) return { isPaid: Boolean(paid), label: Boolean(paid) ? 'PAID' : 'UNPAID' };
  return { isPaid: false, label: 'UNPAID' };
}

function toNumericValue(value) {
  if (typeof value === 'number') return value;
  if (value && typeof value.toNumber === 'function') return value.toNumber();
  if (value && typeof value.toString === 'function') {
    const parsed = Number(value.toString());
    if (!Number.isNaN(parsed)) return parsed;
  }
  return 0;
}

function payoutFieldValue(row) {
  if (row.payoutAmount !== undefined && row.payoutAmount !== null) return toNumericValue(row.payoutAmount);
  if (row.grossSales !== undefined && row.grossSales !== null) return toNumericValue(row.grossSales);
  return 0;
}
function grossFieldValue(row) {
  if (row.grossSales !== undefined && row.grossSales !== null) return toNumericValue(row.grossSales);
  if (row.payoutAmount !== undefined && row.payoutAmount !== null) return toNumericValue(row.payoutAmount);
  return 0;
}
function normalizedStatementNumber(row) { return String(row.statementNumber ?? '').toUpperCase(); }
function hasStatementSuffix(row) { return /(OPEN|PAID|UNPAID)$/.test(normalizedStatementNumber(row)); }
function isPlaceholder(row) { try { return Boolean(row.rawPayload && row.rawPayload.placeholder === true); } catch { return false; } }
function isAuto(row) { return normalizedStatementNumber(row).startsWith('AUTO:'); }
function getUpdatedTimestamp(row) {
  const payloadUpdated = (row.rawPayload && (row.rawPayload.updatedAt || row.rawPayload.createdAt));
  if (payloadUpdated) {
    const d = new Date(payloadUpdated);
    if (!Number.isNaN(d.getTime())) return d.getTime();
  }
  return (row.updatedAt && new Date(row.updatedAt).getTime()) || (row.createdAt && new Date(row.createdAt).getTime()) || 0;
}

function chooseAuthoritativeCandidate(rows, canonicalWeekStart) {
  if (!rows || !rows.length) return null;
  const realRows = rows.filter(r => !isPlaceholder(r));
  const pool = realRows.length ? realRows : rows;
  let best = null;
  const canonicalStartMs = canonicalWeekStart.getTime();

  function rank(row) {
    const periodStart = parseDateOnlyUtc((row.rawPayload && row.rawPayload.period && row.rawPayload.period.startDate) || null);
    const periodMatch = periodStart && canonicalNairobiWeekStartUtc(periodStart).getTime() === canonicalStartMs ? 1 : 0;
    const statusLabel = deriveStatementStatus(row.statementNumber, row.isPaid).label;
    const STATUS_PRIORITY = { PAID: 3, OPEN: 2, UNPAID: 1 };
    const statusRank = STATUS_PRIORITY[statusLabel] || 0;
    const updatedScore = getUpdatedTimestamp(row);
    const payoutValue = payoutFieldValue(row);
    const rowStart = canonicalNairobiWeekStartUtc(new Date(row.weekStart || canonicalWeekStart));
    const diff = Math.abs(rowStart.getTime() - canonicalStartMs);
    return { periodMatch, statusRank, updatedScore, diff, payoutValue, suffixBonus: hasStatementSuffix(row) ? 1 : 0, autoPenalty: isAuto(row) ? 1 : 0 };
  }

  for (const row of pool) {
    if (!best) { best = row; continue; }
    const current = rank(row);
    const bestRank = rank(best);
    if (current.periodMatch !== bestRank.periodMatch) { if (current.periodMatch > bestRank.periodMatch) best = row; continue; }
    if (current.statusRank !== bestRank.statusRank) { if (current.statusRank > bestRank.statusRank) best = row; continue; }
    if (current.updatedScore !== bestRank.updatedScore) { if (current.updatedScore > bestRank.updatedScore) best = row; continue; }
    if (current.diff !== bestRank.diff) { if (current.diff < bestRank.diff) best = row; continue; }
    if (current.payoutValue !== bestRank.payoutValue) { if (current.payoutValue > bestRank.payoutValue) best = row; continue; }
    if (current.suffixBonus !== bestRank.suffixBonus) { if (current.suffixBonus > bestRank.suffixBonus) best = row; continue; }
    if (current.autoPenalty !== bestRank.autoPenalty) { if (current.autoPenalty < bestRank.autoPenalty) best = row; continue; }
  }

  if (!best) return null;
  const payoutSum = pool.reduce((sum, row) => sum + payoutFieldValue(row), 0);
  const grossSum = pool.reduce((sum, row) => sum + grossFieldValue(row), 0);
  return Object.assign({}, best, { payoutAmount: payoutSum, grossSales: grossSum, amount: payoutSum });
}

(async function main(){
  try {
    const startArg = process.argv[2];
    const endArg = process.argv[3];
    const start = startArg ? new Date(startArg) : new Date('1970-01-01');
    const end = endArg ? new Date(endArg) : new Date();
    const apply = String(process.env.APPLY || '').toLowerCase() === 'true';

    const rows = await prisma.marketplacePayoutWeek.findMany({ where: { AND: [{ weekStart: { lte: end } }, { weekEnd: { gte: start } }] }, orderBy: [{ accountId: 'asc' }, { weekStart: 'asc' }] });

    const groups = new Map();
    for (const r of rows) {
      const cstart = canonicalNairobiWeekStartUtc(new Date(r.weekStart)).toISOString();
      const key = `${r.accountId}::${cstart}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(r);
    }

    const report = [];
    for (const [key, items] of groups.entries()) {
      if (items.length <= 1) continue;
      const canonicalStart = new Date(key.split('::')[1]);
      const candidates = items.map(r => ({ id: r.id, statementNumber: r.statementNumber || null, amount: Number(r.payoutAmount || r.grossSales || 0), createdAt: r.createdAt ? new Date(r.createdAt) : new Date(0), rawPayload: r.rawPayload, isPaid: r.isPaid || false, weekStart: new Date(r.weekStart) }));
      const incoming = { id: null, statementNumber: null, amount: 0, createdAt: new Date(0), rawPayload: null, isPaid: false, weekStart: canonicalStart };
      candidates.push(incoming);
      const keeper = chooseAuthoritativeCandidate(candidates, canonicalStart);
      const keeperRow = (keeper && keeper.id) ? items.find(x=>x.id===keeper.id) : items[0];
      const otherIds = items.filter(x=>x.id !== keeperRow.id).map(x=>x.id);
      const removedStatements = items.filter(x=>otherIds.includes(x.id)).map(x=>x.statementNumber).filter(Boolean);
      report.push({ accountId: items[0].accountId, canonicalWeekStart: key.split('::')[1], keeperId: keeperRow.id, removedIds: otherIds, removedStatementNumbers: removedStatements });

      if (apply) {
        try {
          await prisma.marketplacePayoutWeek.update({ where: { id: keeperRow.id }, data: { grossSales: (keeper && keeper.amount) ? keeper.amount : Number(keeperRow.grossSales || 0), payoutAmount: (keeper && keeper.amount) ? keeper.amount : Number(keeperRow.payoutAmount || 0), statementNumber: (keeper && keeper.statementNumber) ? keeper.statementNumber : (keeperRow.statementNumber || null), rawPayload: (keeper && keeper.rawPayload) ? keeper.rawPayload : keeperRow.rawPayload, weekStart: new Date(key.split('::')[1]), weekEnd: new Date(new Date(key.split('::')[1]).getTime() + 7*24*3600*1000 -1) } });
        } catch (e) { console.warn('failed update keeper', e.message || e); }
        if (otherIds.length) {
          try { await prisma.marketplacePayoutWeek.deleteMany({ where: { id: { in: otherIds } } }); } catch(e) { console.warn('failed deleting others', e.message || e); }
        }
      }
    }

    fs.mkdirSync('.tmp', { recursive: true });
    fs.writeFileSync('.tmp/cleanup_marketplace_payoutweeks_report.json', JSON.stringify({ applied: apply, generatedAt: new Date().toISOString(), entries: report }, null, 2));
    console.log(`Wrote .tmp/cleanup_marketplace_payoutweeks_report.json — groups: ${report.length} (apply=${apply})`);
  } catch (e) {
    console.error('cleanup failed', e);
    process.exit(1);
  } finally {
    try { await prisma.$disconnect(); } catch (_) {}
  }
})();
