// Ensure env vars are present to avoid DB lookups in loadConfig
process.env.base_url = process.env.base_url || 'https://vendor-api.jumia.com';
process.env.JUMIA_OIDC_ISSUER = process.env.JUMIA_OIDC_ISSUER || 'https://issuer.example';
process.env.JUMIA_CLIENT_ID = process.env.JUMIA_CLIENT_ID || 'FAKE_CLIENT';
process.env.JUMIA_REFRESH_TOKEN = process.env.JUMIA_REFRESH_TOKEN || 'FAKE_REFRESH';

import * as jumia from '../../src/lib/jumia';

describe('jumiaPaginator', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  

  beforeAll(() => {
    // stub global fetch for any token endpoint calls to prevent network requests
    const g: any = global;
    if (!g.fetch || !g.fetch.mock) {
      g.fetch = jest.fn(async (url: string) => {
        // if token endpoint called, return a minimal token response
        if (typeof url === 'string' && url.includes('/token')) {
          return {
            ok: true,
            status: 200,
            text: async () => JSON.stringify({ access_token: 'FAKE', expires_in: 3600 }),
            json: async () => ({ access_token: 'FAKE', expires_in: 3600 }),
          };
        }
        // generic positive response
        return { ok: true, status: 200, json: async () => ({}), text: async () => '' };
      });
    }
    // suppress noisy console.error during tests
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('iterates multiple pages using nextToken', async () => {

    const first = { orders: [{ id: 1 }], nextToken: 'abc' };
    const second = { orders: [{ id: 2 }] };
    const mockFetcher = jest.fn()
      .mockResolvedValueOnce(first)
      .mockResolvedValueOnce(second);

    const pages: any[] = [];
    for await (const p of jumia.jumiaPaginator('/orders', {}, mockFetcher)) {
      pages.push(p);
    }

    expect(pages.length).toBe(2);
    expect(pages[0]).toBe(first);
    expect(pages[1]).toBe(second);
  expect(mockFetcher).toHaveBeenCalledTimes(2);
  });

  it('retries once on 401 by refreshing token', async () => {
    const err: any = new Error('Unauthorized');
    err.status = 401;
    const mockFetcher = jest.fn().mockRejectedValueOnce(err).mockResolvedValueOnce({ orders: [] });
    const refreshSpy = jest.spyOn(jumia, 'getAccessToken' as any).mockResolvedValue('FAKE');

    const pages: any[] = [];
    for await (const p of jumia.jumiaPaginator('/orders', {}, mockFetcher)) {
      pages.push(p);
    }

  expect(mockFetcher).toHaveBeenCalledTimes(2);
  });
});
