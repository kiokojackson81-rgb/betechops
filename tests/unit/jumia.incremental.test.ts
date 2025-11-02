import { prisma } from '@/lib/prisma';
import * as jumia from '@/lib/jumia';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    shop: { findMany: jest.fn() },
    config: { findUnique: jest.fn(), upsert: jest.fn() },
    jumiaOrder: { upsert: jest.fn() },
  },
}));

jest.mock('@/lib/jumia', () => ({
  jumiaFetch: jest.fn(),
  jumiaPaginator: jest.fn(),
  loadShopAuthById: jest.fn(),
}));

describe('syncOrdersIncremental', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-11-02T12:00:00.000Z'));
    jest.resetAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('processes first-time sync and advances cursor to latest vendor updatedAt', async () => {
    const { syncOrdersIncremental } = await import('@/lib/jobs/jumia');

    (prisma as any).shop.findMany.mockResolvedValue([{ id: 's1' }]);
    (prisma as any).config.findUnique.mockResolvedValue(null);
    (jumia.loadShopAuthById as jest.Mock).mockResolvedValue(undefined);

    const now = Date.now();
    const o1Updated = new Date(now - 5 * 60 * 1000).toISOString();
    const o2Updated = new Date(now - 1 * 60 * 1000).toISOString();

    (jumia.jumiaPaginator as jest.Mock).mockImplementation((_path: string, params: any) => (async function* () {
      if (params.status === 'PENDING') {
        yield { orders: [
          { id: 'o1', status: 'PENDING', createdAt: o1Updated, updatedAt: o1Updated },
          { id: 'o2', status: 'PROCESSING', createdAt: o2Updated, updatedAt: o2Updated },
        ] };
      }
    })());

    (prisma as any).jumiaOrder.upsert.mockResolvedValue({});
    (prisma as any).config.upsert.mockResolvedValue({});

    const summary = await syncOrdersIncremental();
    expect(summary.s1.processed).toBe(2);
    expect(summary.s1.upserted).toBe(2);
    expect(summary.s1.cursor).toBe(o2Updated);

    // assert cursor persisted
    expect((prisma as any).config.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { key: `jumia:orders:s1:cursor` },
      update: { json: { updatedAfter: o2Updated } },
      create: { key: `jumia:orders:s1:cursor`, json: { updatedAfter: o2Updated } },
    }));
  });

  it('uses 60-second overlap when existing cursor is present', async () => {
    const { syncOrdersIncremental } = await import('@/lib/jobs/jumia');

    const cursor = new Date('2025-11-01T12:00:00.000Z').toISOString();
    (prisma as any).shop.findMany.mockResolvedValue([{ id: 's1' }]);
    (prisma as any).config.findUnique.mockResolvedValue({ json: { updatedAfter: cursor } });
    (jumia.loadShopAuthById as jest.Mock).mockResolvedValue(undefined);

    (jumia.jumiaPaginator as jest.Mock).mockImplementation((_path: string, params: any) => (async function* () {
      if (params.status === 'PENDING') {
      // minimal page to drive loop
      yield { orders: [] };
      }
    })());

    await syncOrdersIncremental();

    const call = (jumia.jumiaPaginator as jest.Mock).mock.calls[0];
    const params = call[1];
    expect(params.status).toBe('PENDING');
    // overlap of 60s (respecting lookback baseline)
    const baseline = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000);
    const basis = Math.min(new Date(cursor).getTime(), baseline.getTime());
    const expected = new Date(basis - 60 * 1000).toISOString();
    expect(params.updatedAfter).toBe(expected);
  });

  it('upserts status changes for same id and updates cursor to latest updatedAt', async () => {
    const { syncOrdersIncremental } = await import('@/lib/jobs/jumia');

    (prisma as any).shop.findMany.mockResolvedValue([{ id: 's1' }]);
    (prisma as any).config.findUnique.mockResolvedValue(null);
    (jumia.loadShopAuthById as jest.Mock).mockResolvedValue(undefined);

    const u1 = '2025-11-01T10:00:00.000Z';
    const u2 = '2025-11-01T11:00:00.000Z';

    (jumia.jumiaPaginator as jest.Mock).mockImplementation((_path: string, params: any) => (async function* () {
      if (params.status === 'PENDING') {
        yield { orders: [
          { id: 'o1', status: 'PENDING', updatedAt: u1 },
          { id: 'o1', status: 'COMPLETED', updatedAt: u2 },
        ] };
      }
    })());

    (prisma as any).jumiaOrder.upsert.mockResolvedValue({});
    (prisma as any).config.upsert.mockResolvedValue({});

    const summary = await syncOrdersIncremental();
    expect(summary.s1.upserted).toBe(2);
    expect((prisma as any).jumiaOrder.upsert).toHaveBeenCalledTimes(2);
    expect(summary.s1.cursor).toBe(u2);
  });
});
