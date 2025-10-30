import * as prismaMod from '../../src/lib/prisma';
import * as jumiaMod from '../../src/lib/jumia';

jest.mock('../../src/lib/prisma', () => ({
  prisma: {
    shop: { findMany: jest.fn() },
  },
}));

jest.mock('../../src/lib/jumia', () => ({
  jumiaFetch: jest.fn(),
  loadShopAuthById: jest.fn().mockResolvedValue({ apiBase: 'https://vendor-api.jumia.com', clientId: 'x', refreshToken: 'y' }),
}));

describe('GET /api/orders?shopId=ALL aggregation', () => {
  afterEach(() => jest.resetAllMocks());

  it('merges first pages from all shops, sorts by createdAt desc, and enforces page size with a nextToken', async () => {
    // Arrange: two active JUMIA shops
    (prismaMod as any).prisma.shop.findMany.mockResolvedValue([
      { id: 's1', platform: 'JUMIA' },
      { id: 's2', platform: 'JUMIA' },
    ]);

    // First call (s1) → newer orders; second call (s2) → older orders
    const orders1 = {
      orders: [
        { id: 'o-3', createdAt: '2025-10-30T10:00:00.000Z' },
        { id: 'o-1', createdAt: '2025-10-29T12:00:00.000Z' },
      ],
    } as any;
    const orders2 = {
      orders: [
        { id: 'o-2', createdAt: '2025-10-30T08:00:00.000Z' },
        { id: 'o-0', createdAt: '2025-10-28T12:00:00.000Z' },
      ],
    } as any;
    (jumiaMod as any).jumiaFetch
      .mockResolvedValueOnce(orders1)
      .mockResolvedValueOnce(orders2);

    // Act: call GET handler with shopId=ALL&size=3
    const { GET } = await import('../../src/app/api/orders/route');
    const req = { url: 'http://localhost/api/orders?shopId=ALL&size=3' } as any;
    const res = await GET(req);

    // Assert
    expect(res.status).toBe(200);
    const body = await (res as any).json();
    const ids = (body.orders || []).map((o: any) => o.id);
    // Expect global sort desc by createdAt: o-3 (10:00) > o-2 (08:00) > o-1 (prev day) then sliced to 3
    expect(ids).toEqual(['o-3', 'o-2', 'o-1']);
    // With more data remaining, expect a non-null nextToken and not last page
    expect(typeof body.nextToken).toBe('string');
    expect(body.isLastPage).toBe(false);
  });

  it.skip('continues with nextToken to serve older results without duplicates', async () => {
    // Ensure a clean module state for fresh mocks
    jest.resetModules();
    // Arrange: two active JUMIA shops
    (prismaMod as any).prisma.shop.findMany.mockResolvedValue([
      { id: 's1', platform: 'JUMIA' },
      { id: 's2', platform: 'JUMIA' },
    ]);

    // First call for each shop returns two records each
    const pageS1 = { orders: [
      { id: 'a3', createdAt: '2025-10-30T12:00:00.000Z' },
      { id: 'a1', createdAt: '2025-10-30T09:00:00.000Z' },
    ] } as any;
    const pageS2 = { orders: [
      { id: 'b2', createdAt: '2025-10-30T11:00:00.000Z' },
      { id: 'b0', createdAt: '2025-10-30T08:00:00.000Z' },
    ] } as any;

    // Mock sequence: first fan-out (s1, s2)
    (jumiaMod as any).jumiaFetch
      .mockResolvedValueOnce(pageS1)
      .mockResolvedValueOnce(pageS2)
      // second request (with nextToken) will fan-out again; we re-use same pages and rely on server-side cursor filtering
      .mockResolvedValueOnce(pageS1)
      .mockResolvedValueOnce(pageS2);

  const { GET } = await import('../../src/app/api/orders/route');

    // Page 1 (size=2) → a3, b2
    const req1 = { url: 'http://localhost/api/orders?shopId=ALL&size=2' } as any;
    const res1 = await GET(req1);
    const body1 = await (res1 as any).json();
    const ids1 = (body1.orders || []).map((o: any) => o.id);
    expect(ids1).toEqual(['a3', 'b2']);
    expect(typeof body1.nextToken).toBe('string');

    // Page 2 using nextToken → a1, b0
    const req2 = { url: `http://localhost/api/orders?shopId=ALL&size=2&nextToken=${encodeURIComponent(body1.nextToken)}` } as any;
    const res2 = await GET(req2);
    const body2 = await (res2 as any).json();
    const ids2 = (body2.orders || []).map((o: any) => o.id);
    expect(ids2).toEqual(['a1', 'b0']);
  });
});
