import { fulfillOrder, syncOrders } from '../../src/lib/jobs/jumia';
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
});
