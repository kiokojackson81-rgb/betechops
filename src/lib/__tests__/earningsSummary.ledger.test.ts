import { jest } from '@jest/globals';

// Mock dependencies used by getEarningsSummaryForUser
jest.unstable_mockModule('@/lib/prisma', () => ({
  prisma: {
    profitSnapshot: { findMany: jest.fn().mockResolvedValue([]) },
    dailyReport: { findMany: jest.fn().mockResolvedValue([]) },
    attendantCompPlan: { findUnique: jest.fn().mockResolvedValue(null) },
    attendantPayrollAdjustment: { findMany: jest.fn().mockResolvedValue([]) },
    commissionLedger: { findUnique: jest.fn().mockResolvedValue(null) },
    $queryRaw: jest.fn().mockResolvedValue([]),
  },
}));

jest.unstable_mockModule('@/lib/marketingPeriodTotals', () => ({
  summarizeMarketingReportsForPeriod: jest.fn().mockResolvedValue({ totals: { totalSales: 0, totalProfit: 0, totalReceipts: 0, totalItems: 0, paymentStats: { totalSalesMpesa: 0, totalSalesCash: 0, countMpesaReceipts: 0, countCashReceipts: 0 } }, entryCount: 0, perReceipts: {} }),
}));

jest.unstable_mockModule('@/lib/supportEntries', () => ({
  getSupportPeriodAggregates: jest.fn().mockResolvedValue({ aggregates: {}, perReceipts: {} }),
}));

jest.unstable_mockModule('@/lib/commission', () => ({
  getOrCreateCommissionPeriod: jest.fn().mockResolvedValue({ period: { id: 'p' }, tiers: [], tradingPeriod: { start: new Date('2025-12-25T00:00:00Z'), end: new Date('2026-01-24T23:59:59.999Z'), key: '2025-12-24_2026-01-24' } }),
  computeSalesCommissionFromTiers: jest.fn().mockReturnValue(0),
  computeProductCommissions: jest.fn().mockReturnValue({ newProductCommission: 0, copiedCommission: 0, editedCommission: 0 }),
}));

const { getEarningsSummaryForUser } = await import('../earningsSummary');
const { prisma } = await import('@/lib/prisma');

describe('earningsSummary ledger lookup', () => {
  test('picks up ledger via detail.marketing.periodKey fallback', async () => {
    // Arrange: make $queryRaw return a ledger row with grossCommission
    const ledgerRow = [{ id: 'L1', grossCommission: '1380', netCommission: '1380', penalties: '0', detail: { marketing: { periodKey: '2025-12-24_2026-01-24', commission: 1380 } } }];
    prisma.$queryRaw.mockResolvedValueOnce(ledgerRow);

    // Act
    const summary = await getEarningsSummaryForUser({ userId: 'cmimxqfgo0004v5mc5pn1r486', asOf: new Date('2025-12-30T00:00:00Z') });

    // Assert
    expect(summary.commission).toBe(1380);
    expect(summary.ledger).not.toBeNull();
    expect((summary.ledger as any).grossCommission).toBe(1380);
  });
});
