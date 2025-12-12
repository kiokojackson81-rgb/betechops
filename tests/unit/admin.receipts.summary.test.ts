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

  it('attributes sales to receipts and profit to pricing events (pricedAt)', async () => {
    const start = '2025-12-12T00:00:00+03:00';
    const end = '2025-12-12T23:59:59.999+03:00';

    // One marketing receipt in the window
    (prisma as any).marketingReceipt.findMany.mockResolvedValue([
      { id: 'mr1', sellingTotal: 1000, items: [{ buyingPrice: null }, { buyingPrice: null }] },
    ]);

    // No support receipts in this simple case
    (prisma as any).supportReceipt.findMany.mockResolvedValue([]);

    // One marketingSale priced during the window
    (prisma as any).marketingSale.findMany.mockResolvedValue([
      { sellingPrice: 1000, buyingPrice: 700, itemsCount: 1, pricedAt: new Date() },
    ]);

    // One support item priced during the window (per-item profit 50)
    (prisma as any).supportReceiptItem.findMany.mockResolvedValue([
      { buyingPrice: 150, receipt: { sellingTotal: 400, items: [{}, {}] } },
    ]);

    const req: any = { url: `http://localhost/api/admin/receipts/summary?start=${encodeURIComponent(
      start,
    )}&end=${encodeURIComponent(end)}` };

    const res = await GET(req as any);
    expect(res).toBeDefined();
    const body = await res.json();

    // totalSales comes from receipts (1000)
    expect(body.totalSales).toBe(1000);
    // totalProfit = marketing 300 + support 50
    expect(body.totalProfit).toBe(350);
    expect(body.receiptsCount).toBe(1);
  });
});
