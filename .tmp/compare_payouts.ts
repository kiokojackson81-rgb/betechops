import { prisma } from "../src/lib/prisma";

function parseAmount(s?: string) {
  if (!s) return 0;
  return Number(s.replace(/,/g, ''));
}

async function main() {
  const list = [
    { label: '29 Dec 2025 - 04 Jan 2026', stmt: 'PS251229KE12Y26UNPAID', amount: '196,243.91', paidText: 'UNPAID' },
    { label: '22 Dec 2025 - 28 Dec 2025', stmt: 'PS251222KE12Y26PAID', amount: '269,096.33', paidText: 'PAID' },
    { label: '15 Dec 2025 - 21 Dec 2025', stmt: 'PS251215KE12Y26PAID', amount: '357,711.36', paidText: 'PAID' },
    { label: '08 Dec 2025 - 14 Dec 2025', stmt: 'PS251208KE12Y26PAID', amount: '315,223.99', paidText: 'PAID' },
    { label: '01 Dec 2025 - 07 Dec 2025', stmt: 'PS251201KE12Y26PAID', amount: '346,673.59', paidText: 'PAID' },
    { label: '24 Nov 2025 - 30 Nov 2025', stmt: 'PS251124KE12Y26PAID', amount: '416,348.45', paidText: 'PAID' },
    { label: '17 Nov 2025 - 23 Nov 2025', stmt: 'PS251117KE12Y26PAID', amount: '274,714.58', paidText: 'PAID' },
    { label: '10 Nov 2025 - 16 Nov 2025', stmt: 'PS251110KE12Y26PAID', amount: '370,690.45', paidText: 'PAID' },
    { label: '03 Nov 2025 - 09 Nov 2025', stmt: 'PS251103KE12Y26PAID', amount: '312,733.09', paidText: 'PAID' },
    { label: '27 Oct 2025 - 02 Nov 2025', stmt: 'PS251027KE12Y26PAID', amount: '300,163.00', paidText: 'PAID' },
    { label: '20 Oct 2025 - 26 Oct 2025', stmt: 'PS251020KE12Y26PAID', amount: '99,009.64', paidText: 'PAID' },
    { label: '13 Oct 2025 - 19 Oct 2025', stmt: 'PS251013KE12Y26PAID', amount: '204,007.48', paidText: 'PAID' },
    { label: '06 Oct 2025 - 12 Oct 2025', stmt: 'PS251006KE12Y26PAID', amount: '226,032.65', paidText: 'PAID' },
    { label: '29 Sep 2025 - 05 Oct 2025', stmt: 'PS250929KE12Y26PAID', amount: '280,381.01', paidText: 'PAID' },
    { label: '22 Sep 2025 - 28 Sep 2025', stmt: 'PS250922KE12Y26PAID', amount: '165,131.13', paidText: 'PAID' },
    { label: '15 Sep 2025 - 21 Sep 2025', stmt: 'PS250915KE12Y26PAID', amount: '136,020.08', paidText: 'PAID' },
    { label: '08 Sep 2025 - 14 Sep 2025', stmt: 'PS250908KE12Y26PAID', amount: '191,238.19', paidText: 'PAID' },
    { label: '01 Sep 2025 - 07 Sep 2025', stmt: 'PS250901KE12Y26PAID', amount: '592,450.89', paidText: 'PAID' },
    { label: '25 Aug 2025 - 31 Aug 2025', stmt: 'PS250825KE12Y26PAID', amount: '205,508.16', paidText: 'PAID' },
    { label: '18 Aug 2025 - 24 Aug 2025', stmt: 'PS250818KE12Y26PAID', amount: '231,669.50', paidText: 'PAID' }
  ];

  try {
    console.log('Comparing', list.length, 'statements against MarketplacePayoutWeek rows');
    for (const item of list) {
      const expectedAmt = parseAmount(item.amount);
      const expectedPaid = /PAID$/.test(item.stmt) || item.paidText === 'PAID';
      const base = item.stmt.replace(/(PAID|UNPAID)$/, '');
      const candidates = Array.from(new Set([item.stmt, base]));
      const rows = await prisma.marketplacePayoutWeek.findMany({ where: { statementNumber: { in: candidates } } });
      if (!rows || rows.length === 0) {
        console.log(`MISSING: ${item.label} ${item.stmt} -> no row found`);
        continue;
      }
      for (const r of rows) {
        const dbAmt = Number(r.payoutAmount);
        const dbPaid = Boolean(r.isPaid);
        const sameAmt = Math.abs(dbAmt - expectedAmt) < 0.01;
        console.log(`${item.label} ${item.stmt} -> DB: account=${r.accountId} weekStart=${r.weekStart.toISOString().split('T')[0]} weekEnd=${r.weekEnd.toISOString().split('T')[0]} payout=${dbAmt.toFixed(2)} isPaid=${dbPaid} ${sameAmt? 'AMOUNT_MATCH':'AMOUNT_MISMATCH'} (expected ${expectedAmt.toFixed(2)} ${expectedPaid? 'PAID':'UNPAID'})`);
      }
    }
  } catch (err) {
    console.error('Failed', err);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });
