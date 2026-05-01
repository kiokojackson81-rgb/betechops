import { jest } from '@jest/globals';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    receipt: { findMany: jest.fn() },
    marketingReceipt: { findMany: jest.fn() },
    supportReceipt: { findMany: jest.fn() },
  },
}));

import { GET } from '../../src/app/api/receipts/route';
import { prisma } from '@/lib/prisma';

describe('GET /api/receipts', () => {
  afterEach(() => jest.resetAllMocks());

  it('returns mapped receipts', async () => {
    (prisma as any).receipt.findMany.mockResolvedValue([{ id: 'r1', order: { orderNumber: 'ORD1', customerName: 'Alice', items: [] }, docType: 'RECEIPT', generatedAt: new Date().toISOString(), totals: { total: 100 }, issuedBy: { name: 'Bob' } }]);
    (prisma as any).marketingReceipt.findMany.mockResolvedValue([]);
    (prisma as any).supportReceipt.findMany.mockResolvedValue([]);
    const req = new Request('http://localhost/api/receipts?includeItems=true');
    const res = await GET(req as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.receipts)).toBe(true);
    expect(body.receipts[0].orderRef).toBe('ORD1');
  });

  it('uses explicit attendantId as an issuer filter for admin-style receipt links', async () => {
    (prisma as any).receipt.findMany.mockResolvedValue([]);
    (prisma as any).marketingReceipt.findMany.mockResolvedValue([]);
    (prisma as any).supportReceipt.findMany.mockResolvedValue([]);

    const req = new Request('http://localhost/api/receipts?attendantId=benjamin-id&start=2026-04-25&end=2026-05-24');
    const res = await GET(req as any);

    expect(res.status).toBe(200);
    const where = (prisma as any).receipt.findMany.mock.calls[0][0].where;
    expect(where.AND).toContainEqual({ issuedById: 'benjamin-id' });
  });
});
