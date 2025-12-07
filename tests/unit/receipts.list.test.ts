import { jest } from '@jest/globals';

jest.mock('@/lib/prisma', () => ({
  prisma: { receipt: { findMany: jest.fn() } },
}));

import { GET } from '../../src/app/api/receipts/list/route';
import { prisma } from '@/lib/prisma';

describe('GET /api/receipts/list', () => {
  afterEach(() => jest.resetAllMocks());

  it('returns mapped receipts', async () => {
    (prisma as any).receipt.findMany.mockResolvedValue([{ id: 'r1', order: { orderNumber: 'ORD1', customerName: 'Alice', items: [] }, docType: 'RECEIPT', generatedAt: new Date().toISOString(), totals: { total: 100 }, issuedBy: { name: 'Bob' } }]);
    const req = new Request('http://localhost/api/receipts/list?includeItems=true');
    const res = await GET(req as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.receipts)).toBe(true);
    expect(body.receipts[0].orderRef).toBe('ORD1');
  });
});
