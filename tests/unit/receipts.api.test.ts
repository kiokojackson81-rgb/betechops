import { jest } from '@jest/globals';

jest.mock('@/lib/prisma', () => ({
  prisma: { $transaction: jest.fn() },
}));

jest.mock('@/lib/auth', () => ({ requireAttendant: jest.fn(async () => ({ ok: true, user: { id: 'u1' } })) }));

import { POST } from '../../src/app/api/receipts/route';
import { prisma } from '@/lib/prisma';

describe('receipts API', () => {
  afterEach(() => jest.resetAllMocks());

  it('POST /api/receipts returns ok', async () => {
    (prisma as any).$transaction.mockImplementation(async (fn: any) => {
      // provide a minimal tx object used by the handler
      const tx: any = {
        shop: { findFirst: async () => ({ id: 'shop1' }) },
        product: { findFirst: async () => null, create: async (d: any) => ({ id: 'p1', ...d }) },
        order: { upsert: async (d: any) => ({ id: 'o1', orderNumber: d.create.orderNumber }), aggregate: async () => ({ _sum: { totalAmount: 0, paidAmount: 0 } }) },
        orderItem: { deleteMany: async () => {}, create: async () => ({}) },
        receipt: { findUnique: async () => null, create: async (d: any) => ({ id: 'r1', ...d }), update: async (d: any) => ({ id: d.where.id, ...d.data }) },
        commissionRecord: { create: async (d: any) => ({ id: 'c1', ...d }), update: async () => ({}) },
      };
      return fn(tx);
    });

    const req = { json: async () => ({ items: [{ title: 'A', quantity: 1, unitPrice: 100 }], attendantId: 'u1' }) } as unknown as Request;
    const res = await POST(req as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBeTruthy();
  });
});
