const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  const id = process.argv[2];
  if (!id) {
    console.error('Usage: node remove-support-from-ledger.js <ledgerId>');
    process.exit(2);
  }

  try {
    const ledger = await prisma.commissionLedger.findUnique({ where: { id } });
    if (!ledger) {
      console.error('Ledger not found', id);
      process.exit(1);
    }

    const detail = ledger.detail || {};
    const marketing = detail.marketing ?? null;
    const marketingCommission = marketing && typeof marketing.commission === 'number' ? marketing.commission : (marketing && Number(marketing.commission)) || 0;

    if (!marketing) {
      console.log('No marketing detail found; nothing to do');
      return;
    }

    const nextDetail = { ...detail };
    delete nextDetail.support;
    delete nextDetail.supportCommission;

    const newGross = Number(marketingCommission || 0);

    const updated = await prisma.commissionLedger.update({
      where: { id },
      data: {
        grossCommission: newGross.toFixed(2),
        netCommission: newGross.toFixed(2),
        commissionTotal: newGross.toFixed(2),
        detail: nextDetail,
      },
    });

    console.log('Updated ledger', id, 'set commission to', newGross, 'removed support detail');
  } catch (err) {
    console.error('Failed:', err);
    process.exitCode = 2;
  } finally {
    await prisma.$disconnect();
  }
})();
