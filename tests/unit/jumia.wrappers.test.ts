import { getShops, getCatalogProducts, getShipmentProviders } from '../../src/lib/jumia';

// Spy and mock oidc token functions to avoid network calls
const oidc = require('../../src/lib/oidc');

beforeAll(() => {
  jest.spyOn(oidc, 'getJumiaAccessToken').mockResolvedValue('FAKE_TOKEN');
  jest.spyOn(oidc, 'getAccessTokenFromEnv').mockResolvedValue('FAKE_TOKEN');
});

afterAll(() => {
  jest.restoreAllMocks();
});

describe('Jumia wrappers', () => {
  beforeEach(() => {
    // ensure base_url is used by jumiaFetch
    process.env.base_url = 'https://vendor-api.jumia.com';
  });

  afterEach(() => {
    jest.resetAllMocks();
    delete process.env.base_url;
  });

  test('getShops calls /shops and returns shops array', async () => {
    const mockResp = { shops: [{ id: 's1', name: 'Shop 1' }] };
    // mock global.fetch
    (global as any).fetch = jest.fn().mockImplementation(async (url: string) => {
      expect(url).toBe('https://vendor-api.jumia.com/shops');
      return {
        ok: true,
        status: 200,
        json: async () => mockResp,
      };
    });

    const shops = await getShops();
    expect(Array.isArray(shops)).toBe(true);
    expect(shops[0].id).toBe('s1');
  });

  test('getCatalogProducts composes query params and returns object', async () => {
    const mockResp = { products: [{ id: 'p1' }], nextToken: null };
    (global as any).fetch = jest.fn().mockImplementation(async (url: string) => {
      // we expect size=5 param
      expect(url).toContain('/catalog/products');
      expect(url).toContain('size=5');
      return {
        ok: true,
        status: 200,
        json: async () => mockResp,
      };
    });

    const res = await getCatalogProducts({ size: 5 });
    expect(res.products).toBeDefined();
    expect(res.products[0].id).toBe('p1');
  });

  test('getShipmentProviders builds orderItemId[] query correctly', async () => {
    const ids = ['oi1', 'oi2'];
    const mockResp = { providers: ['SPX', 'Jumia'] };
    (global as any).fetch = jest.fn().mockImplementation(async (url: string) => {
      expect(url).toContain('/orders/shipment-providers');
      // both ids should appear
      expect(url).toContain('orderItemId=oi1');
      expect(url).toContain('orderItemId=oi2');
      return {
        ok: true,
        status: 200,
        json: async () => mockResp,
      };
    });

    const res = await getShipmentProviders(ids);
    expect(res.providers).toBeDefined();
  });
});
