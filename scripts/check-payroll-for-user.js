const { PrismaClient } = require('@prisma/client');

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
  return { start, end, label: `${start.toLocaleDateString('en-GB')} - ${end.toLocaleDateString('en-GB')}`, key: `${start.toISOString()}_${end.toISOString()}` };
}

(async () => {
  const prisma = new PrismaClient();
  try {
    const emails = process.argv.slice(2);
    if (emails.length === 0) {
      console.error('Usage: node scripts/check-payroll-for-user.js <email1> [email2] [date]');
      process.exit(2);
    }
    const dateArg = emails.length > 1 && emails[emails.length-1].match(/^\d{4}-\d{2}-\d{2}$/) ? emails.pop() : (process.env.CHECK_DATE || new Date().toISOString().slice(0,10));
    const period = getTradingPeriodFor(new Date(dateArg));
    console.log('Using trading period:', period.label, 'key=', period.key);

    for (const email of emails) {
      const user = await prisma.user.findUnique({ where: { email }, select: { id: true, name: true, email: true, role: true } });
      if (!user) {
        console.log('\nUser not found:', email);
        continue;
      }
      console.log('\n--- Payroll summary for', user.email, '(', user.name || '', ') ---');
      // admin-style single attendant row
      const [planArr, ledgerArr, adjustments] = await Promise.all([
        prisma.attendantCompPlan.findMany({ where: { attendantId: user.id } }),
        prisma.commissionLedger.findMany({ where: { periodStart: period.start, periodEnd: period.end, userId: user.id } }),
        prisma.attendantPayrollAdjustment.findMany({ where: { periodKey: period.key, attendantId: user.id }, orderBy: { createdAt: 'desc' } }),
      ]);
      const plan = planArr[0] || null;
      const ledger = ledgerArr[0] || null;

      const adjustmentsSummary = { totalBonus: 0, totalDeduction: 0, breakdown: { chama: 0, lateness: 0, discipline: 0, other: 0, bonus: 0, commissionTopUp: 0, penalties: 0 } };
      for (const adj of adjustments) {
        const amount = adj.amount || 0;
        if (adj.adjustmentType === 'BONUS') {
          adjustmentsSummary.totalBonus += amount;
          adjustmentsSummary.breakdown.bonus += amount;
        } else if (adj.adjustmentType === 'COMMISSION_TOPUP') {
          adjustmentsSummary.totalBonus += amount;
          adjustmentsSummary.breakdown.commissionTopUp += amount;
        } else {
          adjustmentsSummary.totalDeduction += amount;
          if (adj.adjustmentType === 'CHAMA') adjustmentsSummary.breakdown.chama += amount;
          if (adj.adjustmentType === 'LATENESS') adjustmentsSummary.breakdown.lateness += amount;
          if (adj.adjustmentType === 'DISCIPLINE') adjustmentsSummary.breakdown.discipline += amount;
          if (adj.adjustmentType === 'OTHER') adjustmentsSummary.breakdown.other += amount;
        }
      }

      const commissions = Number(ledger?.commissionTotal ?? ledger?.netCommission ?? ledger?.grossCommission ?? 0);
      const grossCommission = Number(ledger?.grossCommission ?? 0);
      const penalties = Number(ledger?.penalties ?? 0);

      const baseSalary = plan?.baseSalary ?? 0;
      const transportAllowance = plan?.defaultTransportAllowance ?? 0;

      const totalEarnings = baseSalary + transportAllowance + commissions + adjustmentsSummary.totalBonus;
      const totalDeductions = adjustmentsSummary.totalDeduction + penalties;
      const netPay = totalEarnings - totalDeductions;

      console.log('Base salary:', baseSalary);
      console.log('Transport allowance:', transportAllowance);
      console.log('Commission (ledger):', commissions, 'grossCommission:', grossCommission, 'penalties:', penalties);
      console.log('Adjustments total bonus:', adjustmentsSummary.totalBonus, 'deductions:', adjustmentsSummary.totalDeduction);
      console.log('Total earnings:', totalEarnings, 'Total deductions:', totalDeductions, 'Net pay:', netPay);
      console.log('Ledger detail (partial):', ledger ? { id: ledger.id, grossCommission: ledger.grossCommission, netCommission: ledger.netCommission, commissionTotal: ledger.commissionTotal, detail: ledger.detail ? ('marketing' in ledger.detail ? { marketing: ledger.detail.marketing.commission } : ledger.detail) : ledger.detail } : null);
    }
  } catch (e) {
    console.error('Error:', e);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
})();
