import { jest } from '@jest/globals';
import { summarizeMarketingReportsForPeriod } from '@/lib/marketingPeriodTotals';
import { getSupportPeriodAggregates } from '@/lib/supportEntries';
import { canonicalReceiptNumber } from '@/lib/receipts/utils';
import { prisma } from '@/lib/prisma';

// Minimal TradingPeriod mock
const period = { start: new Date('2026-01-31T00:00:00.000Z'), end: new Date('2026-01-31T23:59:59.999Z') } as any;

beforeEach(() => {
  jest.restoreAllMocks();
});

afterEach(() => {
  jest.resetAllMocks();
});

test('marketingPeriodTotals excludes POS receipts that are POD-pending', async () => {
  // Mock receipts: one POS receipt with podDelivery.pending and one marketingReceipt
  const posReceipt = {
    id: 'pos-1',
    generatedAt: new Date('2026-01-31T10:00:00.000Z'),
    data: { podDelivery: { status: 'pending' }, receiptNumber: 'BETECH20260131-38640' },
    order: { orderNumber: 'BETECH20260131-38640', items: [], attendant: { id: 'att-1', name: 'Att' } },
  } as any;

  const marketingEntry = [{
    id: 'm-1',
    submittedById: 'att-1',
    date: new Date('2026-01-31T11:00:00.000Z'),
    receipts: [{ id: 'mr-1', receiptNumber: 'BETECH20260131-38640', sellingTotal: 5000, items: [], paymentMethod: 'MPESA' }],
    sales: [],
  }];

  jest.spyOn(prisma.receipt, 'findMany' as any).mockResolvedValue([posReceipt] as any);

  // Mock marketingDailyEntry and dailyReport
  jest.spyOn(prisma.marketingDailyEntry, 'findMany' as any).mockResolvedValue(marketingEntry as any);
  jest.spyOn(prisma.dailyReport, 'findMany' as any).mockResolvedValue([] as any);

  const res = await summarizeMarketingReportsForPeriod({ userId: 'att-1', period, client: prisma as any });
  // Since the POS receipt is pending POD, the marketing entry with same canonical should be excluded,
  // resulting in zero sales counted.
  expect(res.totals.totalSales).toBe(0);
  expect(res.totals.totalReceipts).toBe(0);
});

test('supportEntries excludes POS receipts that are POD-pending', async () => {
  const posReceipt = {
    id: 'pos-1',
    generatedAt: new Date('2026-01-31T10:00:00.000Z'),
    data: { podDelivery: { status: 'pending' }, receiptNumber: 'BETECH20260131-38640' },
    order: { orderNumber: 'BETECH20260131-38640', items: [], attendant: { id: 'att-1', name: 'Att' } },
  } as any;

  const supportEntries = [{
    id: 's-1',
    submittedById: 'att-1',
    date: new Date('2026-01-31T11:00:00.000Z'),
    receipts: [{ id: 'sr-1', receiptNumber: 'BETECH20260131-38640', sellingTotal: 4000, buyingTotal: 0, paymentMethod: 'MPESA', items: [] }],
  }];

  jest.spyOn(prisma.receipt, 'findMany' as any).mockResolvedValue([posReceipt] as any);

  jest.spyOn(prisma.supportDailyEntry, 'findMany' as any).mockResolvedValue(supportEntries as any);

  const { aggregates } = await getSupportPeriodAggregates({ userId: 'att-1', period });
  // The support receipt should be skipped because POS pending exists, so totals zero
  expect(aggregates.totalSales).toBe(0);
  expect(aggregates.totalReceipts).toBe(0);
});
