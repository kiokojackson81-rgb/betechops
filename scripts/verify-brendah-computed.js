const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function clamp01(v) { return Math.max(0, Math.min(1, v)); }
const STEP_POINTS = [2000000,3000000,4000000,5000000,6000000,7000000,8000000,9000000,10000000];
const STEP_REWARDS = [15000,20000,20000,20000,20000,20000,20000,20000,20000];

function computeBrendahDirectCommission(totalSales, totalProfit){
  if (!totalSales || totalSales <= 0) return { amount: 0 };
  if (totalSales < 500000){
    const profit = Math.max(totalProfit||0,0);
    const amount = Math.round(profit * 0.05);
    return { amount };
  }

  let commission = 0;
  if (totalSales <= 1000000){
    const progress = (totalSales - 500000) / 500000;
    commission = Math.round(clamp01(progress) * 10000);
  } else {
    commission = 10000;
    if (totalSales < 2000000){
      const frac = (totalSales - 1000000) / 1000000;
      const prorated = Math.round(clamp01(frac) * STEP_REWARDS[0]);
      commission += prorated;
    } else {
      commission += STEP_REWARDS[0];
      for (let i=1;i<STEP_POINTS.length;i++){
        const point = STEP_POINTS[i]; const reward = STEP_REWARDS[i];
        if (totalSales >= point) commission += reward; else break;
      }
    }
  }

  const profitWithinFirstBand = totalSales > 0 ? (Math.min(totalSales, 500000) / totalSales) * Math.max(totalProfit||0, 0) : 0;
  const profitPart = Math.round(profitWithinFirstBand * 0.05);
  const amount = commission + profitPart;
  return { amount, commission, profitPart };
}

(async ()=>{
  try {
    const email = process.argv[2] || 'brendah@betech.co.ke';
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (!user) throw new Error('user not found');

    const periodStart = new Date('2026-01-25T00:00:00.000Z');
    const periodEnd = new Date('2026-02-24T23:59:59.999Z');

    const ledger = await prisma.commissionLedger.findUnique({ where: { userId_periodStart_periodEnd: { userId: user.id, periodStart, periodEnd } } });
    if (!ledger) throw new Error('ledger not found');

    const detail = ledger.detail || {};
    const supportTotals = (detail.support && detail.support.totals) || {};
    const totalSales = Number(supportTotals.totalSales || 0);
    const totalProfit = Number(supportTotals.totalProfit || 0);

    const product = detail.products || { newProductCommission: 0, copiedCommission: 0, editedCommission: 0 };
    const productTotal = Number(product.total || 0);

    const direct = computeBrendahDirectCommission(totalSales, totalProfit);
    const computedGross = Math.round(direct.amount + productTotal);

    console.log(JSON.stringify({ ledgerId: ledger.id, totalSales, totalProfit, direct, productTotal, computedGross, ledgerCommissionTotal: ledger.commissionTotal }, null, 2));
  } catch (e) {
    console.error('Error:', e && e.message ? e.message : e);
  } finally { try{ await prisma.$disconnect(); } catch(_){} }
})();
