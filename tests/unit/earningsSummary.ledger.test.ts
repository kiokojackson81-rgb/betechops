jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn().mockResolvedValue({ email: 'test@example.com' }) },
    userCommissionConfig: {
      findUnique: jest.fn().mockResolvedValue({ userId: 'u', posTotalsMode: 'NONE', salesCommissionMode: 'DEFAULT_TIERS' }),
      create: jest.fn(),
    },
    profitSnapshot: { findMany: jest.fn().mockResolvedValue([]) },
    dailyReport: { findMany: jest.fn().mockResolvedValue([]) },
    attendantCompPlan: { findUnique: jest.fn().mockResolvedValue(null) },
    attendantPayrollAdjustment: { findMany: jest.fn().mockResolvedValue([]) },
    commissionLedger: { findUnique: jest.fn().mockResolvedValue(null) },
    $queryRaw: jest.fn().mockResolvedValue([]),
    $executeRawUnsafe: jest.fn().mockResolvedValue(0),
  },
}));

jest.mock('@/lib/marketingPeriodTotals', () => ({
  summarizeMarketingReportsForPeriod: jest.fn().mockResolvedValue({ totals: { totalSales: 0, totalProfit: 0, totalReceipts: 0, totalItems: 0, paymentStats: { totalSalesMpesa: 0, totalSalesCash: 0, countMpesaReceipts: 0, countCashReceipts: 0 } }, entryCount: 0, perReceipts: {} }),
}));

jest.mock('@/lib/supportEntries', () => ({
  getSupportPeriodAggregates: jest.fn().mockResolvedValue({ aggregates: {}, perReceipts: {} }),
}));

jest.mock('@/lib/posReceiptSummary', () => ({
  summarizePosReceiptsForPeriod: jest.fn().mockResolvedValue({
    totalSales: 0,
    totalProfit: 0,
    totalReceipts: 0,
    totalItems: 0,
  }),
}));

jest.mock('@/lib/commission', () => ({
  getOrCreateCommissionPeriod: jest.fn().mockResolvedValue({ period: { id: 'p' }, tiers: [], tradingPeriod: { start: new Date('2025-12-25T00:00:00Z'), end: new Date('2026-01-24T23:59:59.999Z'), key: '2025-12-24_2026-01-24' } }),
  computeSalesCommissionFromTiers: jest.fn().mockReturnValue(0),
  computeProductCommissions: jest.fn().mockReturnValue({ newProductCommission: 0, copiedCommission: 0, editedCommission: 0 }),
}));

const { getEarningsSummaryForUser } = require('@/lib/earningsSummary');
const { prisma } = require('@/lib/prisma');
const { getSupportPeriodAggregates } = require('@/lib/supportEntries');
const { summarizePosReceiptsForPeriod } = require('@/lib/posReceiptSummary');

describe('earningsSummary ledger lookup', () => {
  test('picks up ledger via detail.marketing.periodKey fallback', async () => {
    const ledgerRow = [{ id: 'L1', grossCommission: '1380', netCommission: '1380', penalties: '0', detail: { marketing: { periodKey: '2025-12-24_2026-01-24', commission: 1380 } } }];
    prisma.$queryRaw.mockResolvedValueOnce(ledgerRow);

    const summary = await getEarningsSummaryForUser({ userId: 'cmimxqfgo0004v5mc5pn1r486', asOf: new Date('2025-12-30T00:00:00Z') });

    expect(summary.commission).toBe(1380);
    expect(summary.ledger).not.toBeNull();
    expect(summary.ledger.grossCommission).toBe(1380);
  });

  test('uses support receipt profit for SUPPORT_OPS POS profit commission', async () => {
    prisma.user.findUnique.mockResolvedValueOnce({ email: 'justus@betech.co.ke', attendantCategory: 'SUPPORT_OPS' });
    prisma.userCommissionConfig.findUnique.mockResolvedValueOnce({
      userId: 'support-1',
      posTotalsMode: 'USER',
      salesCommissionMode: 'POS_PROFIT_10',
    });
    getSupportPeriodAggregates.mockResolvedValueOnce({
      aggregates: { totalSales: 343650, totalProfit: 78850, totalReceipts: 5, totalItems: 7 },
      perReceipts: {},
    });
    summarizePosReceiptsForPeriod.mockResolvedValueOnce({
      totalSales: 343650,
      totalProfit: 58100,
      totalReceipts: 8,
      totalItems: 11,
    });

    const summary = await getEarningsSummaryForUser({ userId: 'support-1', asOf: new Date('2025-12-30T00:00:00Z') });

    expect(summary.salesCommission).toBe(7885);
    expect(summary.totalProfit).toBe(78850);
    expect(summary.totalReceipts).toBe(5);
    expect(summary.totalItems).toBe(7);
  });
});
