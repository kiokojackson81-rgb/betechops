import { summarizeMarketingReportsForPeriod } from '@/lib/marketingPeriodTotals';

describe('marketingPeriodTotals POD exclusion', () => {
  const period = { start: new Date('2026-01-01T00:00:00Z'), end: new Date('2026-02-01T00:00:00Z') } as any;

  test('excludes marketing receipt when POS POD-pending exists', async () => {
    const mockClient: any = {
      receipt: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'pos1', data: null, order: { orderNumber: 'BETECH2026013028707' } },
        ]),
      },
      marketingDailyEntry: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'm1',
            submittedById: 'u1',
            date: new Date(),
            receipts: [
              { receiptNumber: 'BETECH2026013028707', sellingTotal: 1000, paymentMethod: 'MPESA', items: [] },
            ],
            sales: [],
          },
        ]),
      },
      dailyReport: { findMany: jest.fn().mockResolvedValue([]) },
    };

    const res = await summarizeMarketingReportsForPeriod({ userId: 'u1', period, client: mockClient });
    expect(res.totals.totalSales).toBe(0);
    expect(res.totals.totalReceipts).toBe(0);
  });

  test('includes marketing receipt when no POS POD-pending exists', async () => {
    const mockClient: any = {
      receipt: { findMany: jest.fn().mockResolvedValue([]) },
      marketingDailyEntry: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'm2',
            submittedById: 'u1',
            date: new Date(),
            receipts: [
              { receiptNumber: 'BETECH2026013028707', sellingTotal: 1500, paymentMethod: 'CASH', items: [] },
            ],
            sales: [],
          },
        ]),
      },
      dailyReport: { findMany: jest.fn().mockResolvedValue([]) },
    };

    const res = await summarizeMarketingReportsForPeriod({ userId: 'u1', period, client: mockClient });
    expect(res.totals.totalSales).toBe(1500);
    expect(res.totals.totalReceipts).toBe(1);
  });
});
