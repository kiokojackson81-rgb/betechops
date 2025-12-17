#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

async function main() {
  const email = 'stephen@betech.co.ke';
  const desiredCommission = 10000;
  const desiredChama = 7000;
  const prisma = new PrismaClient();
  const auditDir = path.resolve(process.cwd(), 'db-actions');
  if (!fs.existsSync(auditDir)) fs.mkdirSync(auditDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const auditPath = path.join(auditDir, `latebreeze_stephen_apply_${ts}.json`);

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new Error('User not found: ' + email);

    // Find latest ledger for user
    const ledger = await prisma.commissionLedger.findFirst({ where: { userId: user.id }, orderBy: { createdAt: 'desc' } });
    const before = { ledger: ledger || null };
    const result = { before, actions: [] };

    if (!ledger) {
      result.actions.push({ type: 'error', message: 'No ledger row found; aborting' });
      fs.writeFileSync(auditPath, JSON.stringify(result, null, 2));
      console.log('No ledger row found; audit written to', auditPath);
      process.exit(4);
    }

    // Update ledger if necessary
    if (Number(ledger.commissionTotal ?? 0) !== desiredCommission) {
      const updated = await prisma.commissionLedger.update({ where: { id: ledger.id }, data: {
        commissionTotal: desiredCommission,
        grossCommission: desiredCommission,
        netCommission: desiredCommission,
        commissionBreakdown: Object.assign({}, ledger.commissionBreakdown || {}, { correctedBy: 'ops-script', correctedAt: new Date().toISOString() })
      } });
      result.actions.push({ type: 'ledger_updated', id: updated.id, after: updated });
    } else {
      result.actions.push({ type: 'ledger_ok', id: ledger.id });
    }

    // Ensure CHAMA adjustment exists for this periodKey
    const periodKey = `${ledger.periodStart.toISOString()}_${ledger.periodEnd.toISOString()}`;
    const existingChama = await prisma.attendantPayrollAdjustment.findFirst({ where: { attendantId: user.id, periodKey, adjustmentType: 'CHAMA', amount: desiredChama } });
    if (!existingChama) {
      const created = await prisma.attendantPayrollAdjustment.create({ data: {
        attendantId: user.id,
        periodKey,
        periodLabel: `${ledger.periodStart.toISOString()}_${ledger.periodEnd.toISOString()}`,
        adjustmentType: 'CHAMA',
        label: 'CHAMA',
        amount: desiredChama,
        createdById: 'ops-script'
      } });
      result.actions.push({ type: 'chama_created', id: created.id, after: created });
    } else {
      result.actions.push({ type: 'chama_exists', id: existingChama.id });
    }

    result.after = { ledger: await prisma.commissionLedger.findUnique({ where: { id: ledger.id } }) };
    fs.writeFileSync(auditPath, JSON.stringify(result, null, 2));
    console.log('Audit written to', auditPath);
  } catch (err) {
    console.error('Error:', err && err.message ? err.message : err);
  } finally {
    try { await prisma.$disconnect(); } catch (e) {}
  }
}

main();
