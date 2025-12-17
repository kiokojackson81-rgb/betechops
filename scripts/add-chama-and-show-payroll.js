#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

async function main() {
  const email = process.argv[2];
  const amountArg = process.argv[3];
  if (!email || !amountArg) {
    console.error('Usage: node add-chama-and-show-payroll.js <email> <amount>');
    process.exit(2);
  }
  const amount = Number(amountArg);
  if (Number.isNaN(amount)) {
    console.error('Invalid amount:', amountArg);
    process.exit(2);
  }

  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      console.error('User not found for email', email);
      process.exit(3);
    }

    // pick latest ledger to infer period
    const latestLedger = await prisma.commissionLedger.findFirst({ where: { userId: user.id }, orderBy: { createdAt: 'desc' } });
    if (!latestLedger) {
      console.error('No commission ledger found for user to infer period');
      process.exit(4);
    }

    const periodStart = latestLedger.periodStart;
    const periodEnd = latestLedger.periodEnd;
    const periodKey = `${periodStart.toISOString()}_${periodEnd.toISOString()}`;

    // backup existing adjustments for this period
    const existingAdjustments = await prisma.attendantPayrollAdjustment.findMany({ where: { attendantId: user.id, periodKey } });
    const backupDir = path.resolve(process.cwd(), 'logs');
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
    const backupPath = path.join(backupDir, `adjustments_backup_${user.id}_${periodKey.replace(/[:.]/g,'-')}.json`);
    fs.writeFileSync(backupPath, JSON.stringify({ before: existingAdjustments, timestamp: new Date().toISOString() }, null, 2));
    console.log('Backed up existing adjustments to', backupPath);

    // create CHAMA adjustment
    const adj = await prisma.attendantPayrollAdjustment.create({
      data: {
        attendantId: user.id,
        periodKey,
        periodLabel: `${periodStart.toISOString()}_${periodEnd.toISOString()}`,
        adjustmentType: 'CHAMA',
        label: 'CHAMA',
        amount: amount,
        createdById: 'ops-script',
      },
    });
    console.log('Created adjustment:', adj.id);

    // build payroll summary similar to API route
    const plan = await prisma.attendantCompPlan.findUnique({ where: { attendantId: user.id } });
    const ledger = await prisma.commissionLedger.findUnique({ where: { userId_periodStart_periodEnd: { userId: user.id, periodStart, periodEnd } } });
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
      totalSales: ledger?.detail?.totalSales ?? 0,
      totalProfit: ledger?.detail?.totalProfit ?? 0,
      adjustmentBreakdown: summaryObj.breakdown,
      ledger: ledger
        ? { grossCommission: Number(ledger.grossCommission), netCommission: Number(ledger.netCommission), penalties: Number(ledger.penalties), detail: ledger.detail }
        : null,
    };

    const outPath = path.join(backupDir, `payroll_summary_${user.id}_${new Date().toISOString().replace(/[:.]/g,'-')}.json`);
    fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
    console.log('Saved payroll summary to', outPath);
    console.log(JSON.stringify(out, null, 2));
  } catch (err) {
    console.error('Error:', err && err.message ? err.message : err);
    process.exit(10);
  } finally {
    try { await prisma.$disconnect(); } catch (e) {}
  }
}

main();
