import { jest } from '@jest/globals';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    receipt: { findMany: jest.fn() },
    supportReceipt: { findMany: jest.fn() },
    marketingReceipt: { findMany: jest.fn() },
  },
}));

jest.mock('@/lib/resolveTargetUser', () => ({
  resolveTargetUserId: jest.fn(async () => ({ resolvedUserId: 'u1', actorRole: 'ADMIN', actorId: 'u1' })),
  composeIdentityResponse: (meta: any, data: any) => data,
}));

jest.mock('@/lib/adminReceiptsSummary', () => ({
  getProfitReceiptContributorsForAdminFilters: jest.fn(async () => [
    { source: 'pos', id: 'r1', key: 'OR-1', receiptNumber: 'OR-1', sellingTotal: 200, buyingTotal: 50, profit: 150 },
    { source: 'pos', id: 'r2', key: 'OR-2', receiptNumber: 'OR-2', sellingTotal: 100, buyingTotal: 20, profit: 80 },
  ]),
}));

import { GET } from '../../src/app/api/receipts/route';
import { prisma } from '@/lib/prisma';
import { getProfitReceiptContributorsForAdminFilters } from '@/lib/adminReceiptsSummary';

describe('receipts profit drilldown', () => {
  afterEach(() => jest.resetAllMocks());

  it('returns receipts from admin summary helper and sums profit', async () => {
    // Mock receipts returned by prisma
    const now = new Date();
    const r1 = {
      id: 'r1',
      generatedAt: now,
      receiptNumber: null,
      docType: 'RECEIPT',
      totals: { total: 200 },
      order: {
        orderNumber: 'OR-1',
        totalAmount: 200,
        items: [
          { quantity: 1, orderCosts: [{ unitCost: 50 }], profitSnapshots: [], product: { lastBuyingPrice: 0 } },
        ],
        attendant: { id: 'u1', name: 'Alice' },
        paymentStatus: 'PAID',
      },
      issuedBy: { id: 'u1', name: 'Alice' },
    };
    const r2 = {
      id: 'r2',
      generatedAt: now,
      receiptNumber: null,
      docType: 'RECEIPT',
      totals: { total: 100 },
      order: {
        orderNumber: 'OR-2',
        totalAmount: 100,
        items: [
          { quantity: 1, orderCosts: [{ unitCost: 20 }], profitSnapshots: [], product: { lastBuyingPrice: 0 } },
        ],
        attendant: { id: 'u1', name: 'Alice' },
        paymentStatus: 'PAID',
      },
      issuedBy: { id: 'u1', name: 'Alice' },
    };

    (prisma as any).receipt.findMany.mockResolvedValue([r1, r2]);
    (prisma as any).supportReceipt.findMany.mockResolvedValue([]);
    (prisma as any).marketingReceipt.findMany.mockResolvedValue([]);

    const req = { url: 'http://localhost/api/receipts?summaryView=profit&start=2026-05-01&end=2026-05-04&attendantId=u1' } as any;
    const res = await GET(req as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.receipts)).toBe(true);
    expect(body.receipts.map((r: any) => r.id).sort()).toEqual(['r1', 'r2']);

    const sum = body.receipts.reduce((s: number, row: any) => s + Number(row.profit ?? 0), 0);
    // r1 profit = 200 - 50 = 150, r2 profit = 100 - 20 = 80 => total 230
    expect(sum).toBe(230);

    // Ensure helper was called with expected args
    expect(getProfitReceiptContributorsForAdminFilters).toHaveBeenCalled();
  });
});
