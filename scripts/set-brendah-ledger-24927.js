const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    const ledgerId = process.argv[2] || 'cmkuy12i9000nk00481iakchf';
    const ledger = await prisma.commissionLedger.findUnique({ where: { id: ledgerId } });
    if (!ledger) throw new Error('ledger not found: ' + ledgerId);

    const detail = ledger.detail || {};
    // Update support/product numbers to match recomputed authoritative values
    detail.support = detail.support || {};
    detail.support.totals = detail.support.totals || {};
    detail.support.commission = 24923;
    detail.supportCommission = 24923;
    detail.products = detail.products || {};
    detail.products.total = 4;
    detail.products.copiedCommission = 4;
    detail.products.newProductCommission = detail.products.newProductCommission || 0;
    detail.products.editedCommission = detail.products.editedCommission || 0;

    const res = await prisma.commissionLedger.update({
      where: { id: ledgerId },
      data: {
        commissionTotal: '24927',
        grossCommission: '24927',
        netCommission: '24927',
        commissionDirect: '24923',
        commissionBreakdown: { support: 24923, products: 4, marketing: 0 },
        detail,
      },
    });

    console.log('Updated ledger:', res.id);
    console.log(JSON.stringify({ id: res.id, commissionTotal: res.commissionTotal, grossCommission: res.grossCommission, detail: res.detail }, null, 2));
  } catch (e) {
    console.error('Error:', e && e.message ? e.message : e);
    process.exitCode = 2;
  } finally {
    try{ await prisma.$disconnect(); } catch(_){}
  }
})();
