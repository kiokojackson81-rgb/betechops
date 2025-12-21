(async () => {
  try {
    const email = process.env.USER_EMAIL || process.argv[2] || 'brendah@betech.co.ke';
    const periodStartStr = process.env.PERIOD_START || process.argv[3] || '2025-11-25';
    const periodEndStr = process.env.PERIOD_END || process.argv[4] || '2025-12-24';

    console.log(`Zeroing commission for ${email} period ${periodStartStr} -> ${periodEndStr}`);

    const { prisma } = require('../src/lib/prisma');

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      console.error('User not found for email', email);
      process.exitCode = 2;
      return;
    }

    const start = new Date(periodStartStr);
    const end = new Date(periodEndStr);

    // Try update with possible table name variants (camelCase or snake_case)
    const tableCandidates = [
      '"CommissionLedger"',
      '"commissionLedger"',
      'commission_ledger',
    ];
    let result = 0;
    for (const tbl of tableCandidates) {
      try {
        const sql = `UPDATE ${tbl} SET ${tbl.includes('commission_ledger') ? 'gross_commission' : '"grossCommission"'} = '0.00', ` +
          `${tbl.includes('commission_ledger') ? 'net_commission' : '"netCommission"'} = '0.00', ` +
          `${tbl.includes('commission_ledger') ? 'detail' : '"detail"'} = jsonb_set(COALESCE(${tbl.includes('commission_ledger') ? 'detail' : '"detail"'}::jsonb, '{}'::jsonb), '{marketing,commission}', '0'::jsonb, true) ` +
          `WHERE ${tbl.includes('commission_ledger') ? 'user_id' : '"userId"'} = $1 AND ${tbl.includes('commission_ledger') ? 'period_start' : '"periodStart"'} = $2 AND ${tbl.includes('commission_ledger') ? 'period_end' : '"periodEnd"'} = $3`;
        // Use $executeRawUnsafe with parameters replaced to avoid template tag complexity
        result = await prisma.$executeRawUnsafe(sql, user.id, start, end);
        console.log(`Tried table ${tbl}, rows affected:`, result);
        if (result > 0) break;
      } catch (err) {
        // continue to next candidate
        console.log(`Table ${tbl} attempt failed:`, err && err.message ? err.message : err);
      }
    }

    console.log('Final rows affected:', result);
      // If no rows were updated, create a zeroed ledger row so the UI shows commission=0
      if (result === 0) {
        console.log('No existing ledger row found — creating zeroed ledger.');
        const detail = {
          marketing: {
            periodKey: `${periodStartStr.replace(/-/g, '_')}_${periodEndStr.replace(/-/g, '_')}`,
            totals: {},
            commission: 0,
            computedAt: new Date().toISOString(),
          },
        };
        const created = await prisma.commissionLedger.create({
          data: {
            userId: user.id,
            periodStart: start,
            periodEnd: end,
            grossCommission: 0,
            netCommission: 0,
            detail,
          },
        });
        console.log('Created ledger:', created.id);
      }

    await prisma.$disconnect();
  } catch (e) {
    console.error('Error zeroing commission:', e);
    try { const { prisma } = require('../src/lib/prisma'); if (prisma) await prisma.$disconnect(); } catch (_) {}
    process.exit(1);
  }
})();
