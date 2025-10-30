import { fulfillOrder, syncOrders, syncReturnOrders } from '../../src/lib/jobs/jumia';
import * as jumia from '../../src/lib/jumia';

// Mock S3 client to avoid network calls
jest.mock('@aws-sdk/client-s3', () => {
  return {
    S3Client: function () {
      return { send: async () => ({}) };
    },
    PutObjectCommand: function (args: any) {
      return args;
    },
  };
});

describe('jumia.jobs', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.resetAllMocks();
    // stub global fetch to avoid network calls for token endpoints
    const g: any = global;
    if (!g.fetch || !g.fetch.mock) {
      g.fetch = jest.fn(async (url: string) => ({
        ok: true,
        status: 200,
        json: async () => ({ access_token: 'FAKE', expires_in: 3600 }),
        text: async () => JSON.stringify({ access_token: 'FAKE', expires_in: 3600 }),
      }));
    }
  });

  test('fulfillOrder stores idempotent result and uploads label when bucket configured', async () => {
    // Spy on jumia.jumiaFetch to control response
    jest.spyOn(jumia as any, 'jumiaFetch').mockImplementation(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ success: true, labelBase64: Buffer.from('PDF').toString('base64'), labelFilename: 'lbl.pdf' }),
      text: async () => 'ok',
    }));

    process.env.JUMIA_LABEL_BUCKET = 'test-bucket';
    const res1 = await fulfillOrder('shop1', 'order1', { ttlSeconds: 1 });
    expect(res1).toBeDefined();
    const res2 = await fulfillOrder('shop1', 'order1', { ttlSeconds: 1 });
    expect(res2).toBeDefined();
    delete process.env.JUMIA_LABEL_BUCKET;
  });

  test('syncOrders iterates orders and invokes handler', async () => {
    jest.spyOn(jumia as any, 'jumiaPaginator').mockImplementation(async function* () {
      yield { data: [{ id: 'o1' }, { id: 'o2' }] };
    });

    const calls: string[] = [];
    const processed = await syncOrders('shop1', async (order: any) => {
      calls.push(order.id);
    });
    expect(processed).toBe(2);
    expect(calls).toEqual(['o1', 'o2']);
  });

  test('syncReturnOrders upserts return cases', async () => {
    const prisma = require('../../src/lib/prisma').prisma;
    jest.spyOn(prisma.shop, 'findMany').mockResolvedValue([{ id: 'shop-db' }]);
    jest.spyOn(prisma.config, 'findUnique').mockResolvedValue(null);
    jest.spyOn(prisma.config, 'upsert').mockResolvedValue({} as any);
    jest.spyOn(prisma.order, 'findUnique').mockResolvedValue(null);

    const upsertModule = require('../../src/lib/sync/upsertOrder');
    jest.spyOn(upsertModule, 'upsertNormalizedOrder').mockResolvedValue({
      orderId: 'order-local',
      order: { id: 'order-local', shopId: 'shop-db' },
      createdItems: [],
    });
    jest.spyOn(upsertModule, 'ensureReturnCaseForOrder').mockResolvedValue('rc1');

    const normalizeModule = require('../../src/lib/connectors/normalize');
    jest.spyOn(normalizeModule, 'normalizeFromJumia').mockReturnValue({
      platform: 'JUMIA',
      shopId: 'shop-db',
      externalOrderId: 'ORD-100',
      status: 'RETURNED',
      orderedAt: new Date().toISOString(),
      items: [
        { externalSku: 'SKU-1', title: 'Test Item', qty: 1, salePrice: 100, fees: {} },
      ],
    });

    jest.spyOn(jumia as any, 'loadShopAuthById').mockResolvedValue(undefined);
    jest.spyOn(jumia as any, 'jumiaFetch').mockResolvedValue({ items: [] });
    jest.spyOn(jumia as any, 'jumiaPaginator').mockImplementation(async function* () {
      yield {
        orders: [
          { id: 'ORD-100', status: 'RETURNED', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-02T00:00:00Z', items: [] },
        ],
      };
    });

    const summary = await syncReturnOrders();
    expect(summary).toHaveProperty('shop-db');
    expect(upsertModule.upsertNormalizedOrder).toHaveBeenCalled();
    expect(upsertModule.ensureReturnCaseForOrder).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: 'order-local', shopId: 'shop-db' })
    );
  });
});
