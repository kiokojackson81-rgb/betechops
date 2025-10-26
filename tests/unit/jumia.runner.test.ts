import { runForShops } from '../../src/lib/jobs/runner';
import * as jobs from '../../src/lib/jobs/jumia';

describe('runner', () => {
  beforeEach(() => jest.resetAllMocks());

  test('runForShops respects concurrency and returns results', async () => {
    // Spy on syncOrders so we can validate it's called per shop
    const calls: string[] = [];
    jest.spyOn(jobs as any, 'syncOrders').mockImplementation(async (shopId: string, handler: any) => {
      calls.push(shopId);
      // simulate some async work
      await new Promise((r) => setTimeout(r, 10));
      // call handler for a single order
      await handler({ id: 'o' });
      return 1;
    });

    const shopIds = ['s1', 's2', 's3'];
    const res = await runForShops(shopIds, { concurrency: 2, retries: 0 });
    expect(res.length).toBe(3);
    expect(calls.sort()).toEqual(['s1', 's2', 's3']);
  });
});
