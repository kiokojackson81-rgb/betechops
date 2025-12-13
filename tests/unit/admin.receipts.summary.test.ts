import { jest } from '@jest/globals';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    marketingReceipt: { findMany: jest.fn() },
    supportReceipt: { findMany: jest.fn() },
    marketingSale: { findMany: jest.fn() },
    supportReceiptItem: { findMany: jest.fn() },
  },
}));

import { GET } from '../../src/app/api/admin/receipts/summary/route';
import { prisma } from '@/lib/prisma';

describe('admin receipts summary', () => {
  afterEach(() => jest.resetAllMocks());

  it('computes admin summary using receipt-level UI profit (sellingTotal - sum(buyingPrice))', async () => {
    const start = '2025-12-12T00:00:00+03:00';
    const end = '2025-12-12T23:59:59.999+03:00';

    // One marketing receipt with partially missing buyingPrice
    (prisma as any).marketingReceipt.findMany.mockResolvedValue([
      { id: 'mr1', sellingTotal: 1000, items: [{ buyingPrice: 700 }, { buyingPrice: null }] },
    ]);

    // One support receipt with a known buyingPrice
    (prisma as any).supportReceipt.findMany.mockResolvedValue([
      { id: 'sr1', sellingTotal: 400, items: [{ buyingPrice: 150 }] },
    ]);

    const req: any = { url: `http://localhost/api/admin/receipts/summary?start=${encodeURIComponent(
      start,
    )}&end=${encodeURIComponent(end)}` };

    const res = await GET(req as any);
    expect(res).toBeDefined();
    const body = await res.json();

    // totalSales comes from receipts (1000 + 400)
    expect(body.totalSales).toBe(1400);
    // totalProfit excludes receipts with incomplete cost data; only the support receipt is counted
    // totalProfit = (400 - 150) = 250
    expect(body.totalProfit).toBe(250);
    expect(body.receiptsCount).toBe(2);
  });
});
