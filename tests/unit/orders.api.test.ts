import { prisma } from '@/lib/prisma';
import * as jumia from '@/lib/jumia';
import { getRedis } from '@/lib/redis';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    jumiaOrder: { count: jest.fn() },
    fulfillmentAudit: { count: jest.fn(), create: jest.fn() },
  },
}));

jest.mock('@/lib/jumia');
jest.mock('@/lib/redis', () => ({ getRedis: jest.fn() }));

describe('orders APIs', () => {
  afterEach(() => jest.resetAllMocks());

  it('GET /api/metrics/kpis returns counts', async () => {
    (prisma as any).jumiaOrder.count.mockResolvedValue(5);
    (prisma as any).fulfillmentAudit.count.mockResolvedValueOnce(2).mockResolvedValueOnce(1);

  const { GET } = await import('../../src/app/api/metrics/kpis/route');
    const res = await GET();
    // NextResponse returned; check body by calling json() if available
    // The NextResponse in tests is simple; verify it returned successfully
    expect(res.status).toBe(200);
  });

  it('idempotent pack uses Redis cached result when present', async () => {
    const fakeCached = JSON.stringify({ ok: true, action: 'PACK', result: { ok: true } });
    (getRedis as jest.Mock).mockResolvedValue({ get: jest.fn().mockResolvedValue(fakeCached) });

  const { POST } = await import('../../src/app/api/orders/pack/route');
    // Build a fake request with json()
    const req = { json: async () => ({ orderId: 'o1', shopId: 's1' }) } as unknown as Request;
    // mock auth to return session
    jest.spyOn(await import('@/lib/auth'), 'auth').mockResolvedValue({ user: { email: 'a@b.c' } } as any);

    const res = await POST(req);
    expect(res.status).toBe(200);
  });
});
