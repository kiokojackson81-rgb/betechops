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

  it('merges first pages from all shops, sorts by createdAt desc, and enforces page size', async () => {
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
    expect(body.isLastPage).toBe(true);
    expect(body.nextToken).toBeNull();
  });
});
