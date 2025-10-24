import { POST } from '@/app/api/shops/[id]/assign/route';

jest.mock('@/lib/api', () => ({ requireRole: async () => ({ ok: true }) }));
jest.mock('@/lib/prisma', () => ({ prisma: { userShop: { upsert: jest.fn().mockResolvedValue({ id: 'as1', userId: 'u1', shopId: 's1', roleAtShop: 'ATTENDANT' }) }, user: { findUnique: jest.fn().mockResolvedValue({ id: 'u1', email: 't@example.com' }) } } }));

describe('POST /api/shops/[id]/assign', () => {
  it('upserts assignment', async () => {
    const req = new Request('http://localhost/api/shops/s1/assign', { method: 'POST', body: JSON.stringify({ userId: 'u1', roleAtShop: 'ATTENDANT' }) });
    const res = await POST(req as unknown as Request, { params: Promise.resolve({ id: 's1' }) } as unknown as { params: Promise<{ id: string }> });
    expect(res).toBeDefined();
  });
});
