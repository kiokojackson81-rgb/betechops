const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function getTradingPeriodFor(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const year = d.getFullYear();
  const month = d.getMonth();
  const day = d.getDate();

  let startYear, startMonth, endYear, endMonth;
  if (day >= 25) {
    startYear = year;
    startMonth = month;
    const next = new Date(year, month + 1, 1);
    endYear = next.getFullYear();
    endMonth = next.getMonth();
  } else {
    const prev = new Date(year, month - 1, 1);
    startYear = prev.getFullYear();
    startMonth = prev.getMonth();
    endYear = year;
    endMonth = month;
  }
  const start = new Date(startYear, startMonth, 25, 0, 0, 0, 0);
  const end = new Date(endYear, endMonth, 24, 23, 59, 59, 999);
  const key = `${start.toISOString().split('T')[0]}_${end.toISOString().split('T')[0]}`;
  return { start, end, key };
}

(async ()=>{
  try {
    const email = process.argv[2] || 'brendah@betech.co.ke';
    const asOf = process.argv[3] ? new Date(process.argv[3]) : new Date('2026-01-10T00:00:00.000Z');
    console.log('Cleaning stale ledgers for', email, 'period date=', asOf.toISOString());
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (!user) throw new Error('user not found');
    const period = getTradingPeriodFor(asOf);
    const periodKeyDateOnly = `${period.start.toISOString().split('T')[0]}_${period.end.toISOString().split('T')[0]}`;
    const windowMs = 24 * 60 * 60 * 1000;

    const candidates = await prisma.$queryRaw`
      SELECT id, "commissionTotal", "createdAt", detail
      FROM "CommissionLedger"
      WHERE "userId" = ${user.id}
        AND (
          (detail->'marketing'->>'periodKey') = ${period.key}
          OR (detail->'marketing'->>'periodKey') = ${periodKeyDateOnly}
          OR ("periodStart" >= ${new Date(period.start.getTime() - windowMs)} AND "periodStart" <= ${new Date(period.start.getTime() + windowMs)})
        )
      ORDER BY "createdAt" DESC
    `;

    if (!Array.isArray(candidates) || candidates.length === 0) {
      console.log('No candidate ledgers found for period', period.key);
      return;
    }

    // pick most-recent with commissionTotal>0, else most-recent
    const positive = candidates.find(c => Number(c.commissionTotal ?? 0) > 0);
    const keep = positive || candidates[0];
    console.log('Keeping ledger', keep.id, 'commissionTotal=', keep.commissionTotal);

    const toDelete = candidates.filter(c => c.id !== keep.id).map(c => c.id);
    if (toDelete.length === 0) {
      console.log('No stale ledgers to remove.');
      return;
    }

    console.log('Deleting stale ledgers:', toDelete);
    const del = await prisma.commissionLedger.deleteMany({ where: { id: { in: toDelete } } });
    console.log('Deleted count:', del.count);
  } catch (e) {
    console.error('Error:', e && e.message ? e.message : e);
    process.exitCode = 2;
  } finally { try{ await prisma.$disconnect(); } catch(_){} }
})();
