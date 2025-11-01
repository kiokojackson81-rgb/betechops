import { prisma } from '@/lib/prisma';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    jumiaOrder: { deleteMany: jest.fn() },
  },
}));

describe('cleanup-jumia-orders', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('deletes using vendor updatedAt -> createdAt -> local createdAt precedence', async () => {
    const fixedNow = new Date('2025-11-01T15:00:00.000Z').getTime();
    jest.spyOn(Date, 'now').mockReturnValue(fixedNow);

    (prisma as any).jumiaOrder.deleteMany.mockResolvedValue({ count: 42 });

  const { performCleanup } = await import('../../scripts/cleanup-jumia-orders');
    const res = await performCleanup(60);

    expect(res.deleted).toBe(42);
    expect(res.retentionDays).toBe(60);

    expect((prisma as any).jumiaOrder.deleteMany).toHaveBeenCalledTimes(1);
    const arg = (prisma as any).jumiaOrder.deleteMany.mock.calls[0][0];
    // Verify shape of where clause
    expect(arg.where.OR).toHaveLength(3);
    const [cond1, cond2, cond3] = arg.where.OR;
    expect(cond1).toHaveProperty('updatedAtJumia');
    expect(cond2.AND).toEqual(expect.arrayContaining([
      expect.objectContaining({ updatedAtJumia: null }),
      expect.objectContaining({ createdAtJumia: expect.any(Object) }),
    ]));
    expect(cond3.AND).toEqual(expect.arrayContaining([
      expect.objectContaining({ updatedAtJumia: null }),
      expect.objectContaining({ createdAtJumia: null }),
      expect.objectContaining({ createdAt: expect.any(Object) }),
    ]));

    const cutoff = new Date(fixedNow - 60 * 24 * 60 * 60 * 1000);
    expect((cond1 as any).updatedAtJumia.lt instanceof Date).toBe(true);
    // Close enough check with toISOString
    expect(((cond1 as any).updatedAtJumia.lt as Date).toISOString()).toBe(cutoff.toISOString());
  });
});
