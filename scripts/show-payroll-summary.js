const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

async function main() {
  const email = process.env.USER_EMAIL || process.argv[2] || 'stephen@betech.co.ke';
  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) { console.error('User not found for email', email); process.exit(2); }

    const latestLedger = await prisma.commissionLedger.findFirst({ where: { userId: user.id }, orderBy: { periodStart: 'desc' } });
    if (!latestLedger) { console.error('No commission ledger found for user to infer period'); process.exit(3); }

    const periodStart = latestLedger.periodStart;
    const periodEnd = latestLedger.periodEnd;
    // build a periodKey similar to routes that use string periodKey like '2025-11-25_2025-12-24'
    const periodKey = `${periodStart.toISOString().split('T')[0]}_${periodEnd.toISOString().split('T')[0]}`;

    const plan = await prisma.attendantCompPlan.findUnique({ where: { attendantId: user.id } });
    const ledger = latestLedger;
    const adjustments = await prisma.attendantPayrollAdjustment.findMany({ where: { attendantId: user.id, periodKey } });

    const baseSummary = () => ({ totalBonus: 0, totalDeduction: 0, breakdown: { chama: 0, lateness: 0, discipline: 0, other: 0, bonus: 0, commissionTopUp: 0, penalties: 0 } });
    const summaryObj = baseSummary();
    for (const a of adjustments) {
      const amount = a.amount ?? 0;
      const bonusType = a.adjustmentType === 'BONUS';
      const topUpType = a.adjustmentType === 'COMMISSION_TOPUP';
      if (bonusType) {
        summaryObj.totalBonus += amount;
        summaryObj.breakdown.bonus += amount;
      } else if (topUpType) {
        summaryObj.totalBonus += amount;
        summaryObj.breakdown.commissionTopUp += amount;
      } else {
        summaryObj.totalDeduction += amount;
        if (a.adjustmentType === 'CHAMA') summaryObj.breakdown.chama += amount;
        if (a.adjustmentType === 'LATENESS') summaryObj.breakdown.lateness += amount;
        if (a.adjustmentType === 'DISCIPLINE') summaryObj.breakdown.discipline += amount;
        if (a.adjustmentType === 'OTHER') summaryObj.breakdown.other += amount;
      }
    }

    const penalties = Number(ledger?.penalties ?? 0);
    summaryObj.breakdown.penalties = penalties;

    const commissions = Number(ledger?.netCommission ?? ledger?.grossCommission ?? 0);
    const baseSalary = plan?.baseSalary ?? 0;
    const transportAllowance = plan?.defaultTransportAllowance ?? 0;
    const totalEarnings = baseSalary + transportAllowance + commissions + summaryObj.totalBonus;
    const totalDeductions = summaryObj.totalDeduction + penalties;
    const netPay = totalEarnings - totalDeductions;

    const out = {
      attendantId: user.id,
      name: user.name,
      email: user.email,
      periodLabel: `${periodStart.toISOString().split('T')[0]} - ${periodEnd.toISOString().split('T')[0]}`,
      baseSalary,
      transportAllowance,
      commission: commissions,
      commissionGross: Number(ledger?.grossCommission ?? 0),
      bonusTotal: summaryObj.totalBonus,
      deductionTotal: totalDeductions,
      totalEarnings,
      totalDeductions,
      netPay,
      totalSales: ledger?.detail?.totals?.totalSales ?? ledger?.detail?.totalSales ?? 0,
      totalProfit: ledger?.detail?.totals?.totalProfit ?? ledger?.detail?.totalProfit ?? 0,
      adjustmentBreakdown: summaryObj.breakdown,
      ledger: ledger ? { grossCommission: Number(ledger.grossCommission), netCommission: Number(ledger.netCommission), penalties: Number(ledger.penalties), detail: ledger.detail } : null,
      adjustmentsFound: adjustments.length,
      adjustments: adjustments,
    };

    const outPath = path.resolve(process.cwd(), 'logs', `payroll_summary_${user.id}_${new Date().toISOString().replace(/[:.]/g,'-')}.json`);
    try { fs.mkdirSync(path.dirname(outPath), { recursive: true }); fs.writeFileSync(outPath, JSON.stringify(out, null, 2)); } catch (e) {}
    console.log(JSON.stringify(out, null, 2));
  } catch (err) {
    console.error('Error:', err && err.message ? err.message : err);
    process.exit(10);
  } finally {
    try { await prisma.$disconnect(); } catch (e) {}
  }
}

main();
