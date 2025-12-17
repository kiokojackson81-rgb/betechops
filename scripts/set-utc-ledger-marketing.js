const { PrismaClient } = require('@prisma/client');

function getTradingPeriodForUTC(date) {
  const d = new Date(date);
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth();
  const day = d.getUTCDate();
  let startYear, startMonth, endYear, endMonth;
  if (day >= 25) {
    startYear = year; startMonth = month;
    const next = new Date(Date.UTC(year, month + 1, 1));
    endYear = next.getUTCFullYear(); endMonth = next.getUTCMonth();
  } else {
    const prev = new Date(Date.UTC(year, month - 1, 1));
    startYear = prev.getUTCFullYear(); startMonth = prev.getUTCMonth();
    endYear = year; endMonth = month;
  }
  const start = new Date(Date.UTC(startYear, startMonth, 25, 0, 0, 0, 0));
  const end = new Date(Date.UTC(endYear, endMonth, 24, 23, 59, 59, 999));
  const key = `${start.toISOString().split('T')[0]}_${end.toISOString().split('T')[0]}`;
  return { start, end, key };
}

async function main() {
  const email = process.env.USER_EMAIL || process.argv[2] || 'stephen@betech.co.ke';
  const correction = Number(process.env.MARKETING_CORRECTION || process.argv[3] || 10000);
  console.log(`Applying marketing correction ${correction} for ${email} (UTC period)`);
  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) { console.error('User not found:', email); process.exitCode = 2; return; }
    const period = getTradingPeriodForUTC(new Date());
    const ledger = await prisma.commissionLedger.findUnique({ where: { userId_periodStart_periodEnd: { userId: user.id, periodStart: period.start, periodEnd: period.end } } });
    const now = new Date().toISOString();
    const nextDetail = (ledger && typeof ledger.detail === 'object') ? { ...ledger.detail } : {};
    nextDetail.marketing = { ...(nextDetail.marketing || {}), periodKey: period.key, commission: correction, correctedAt: now, correctedBy: 'ops' };
    const grossBefore = Number(ledger?.grossCommission ?? 0);
    const previousMarketing = Number(ledger?.detail?.marketing?.commission ?? 0);
    const grossNew = Math.max(0, grossBefore - previousMarketing + correction);
    const penalties = Number(ledger?.penalties ?? 0);
    const netNew = Math.max(0, grossNew - penalties);
    const commissionTotalNew = Math.max(0, Number(ledger?.commissionTotal ?? 0) - previousMarketing + correction);

    const upsert = await prisma.commissionLedger.upsert({
      where: { userId_periodStart_periodEnd: { userId: user.id, periodStart: period.start, periodEnd: period.end } },
      update: { grossCommission: grossNew, netCommission: netNew, commissionTotal: commissionTotalNew, detail: nextDetail, commissionBreakdown: { note: 'Manual correction merged into UTC ledger', correctedAt: now, correctedBy: 'ops' } },
      create: { userId: user.id, periodStart: period.start, periodEnd: period.end, grossCommission: grossNew, netCommission: netNew, commissionTotal: commissionTotalNew, detail: nextDetail, commissionBreakdown: { note: 'Manual correction created UTC ledger', correctedAt: now, correctedBy: 'ops' } }
    });
    console.log('Upsert complete:', upsert.id, 'commissionTotal:', upsert.commissionTotal);
  } catch (e) {
    console.error('Failed:', e);
    process.exitCode = 1;
  } finally {
    try { await prisma.$disconnect(); } catch (_) {}
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
