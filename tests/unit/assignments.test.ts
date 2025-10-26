import { getUserShops, upsertAssignments } from '@/lib/assignments';
import { prisma } from '@/lib/prisma';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    shopAssignment: {
      findMany: jest.fn(),
      createMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

describe('assignments service', () => {
  afterEach(() => jest.resetAllMocks());

  it('getUserShops calls prisma.shopAssignment.findMany and returns value', async () => {
    const mock = (prisma as any).shopAssignment.findMany as jest.Mock;
    mock.mockResolvedValue([{ shopId: 's1', userId: 'u1', shop: { id: 's1', name: 'Shop 1' } }]);

    const res = await getUserShops('u1');
    expect(mock).toHaveBeenCalledWith({ where: { userId: 'u1' }, include: { shop: true } });
    expect(res).toEqual([{ shopId: 's1', userId: 'u1', shop: { id: 's1', name: 'Shop 1' } }]);
  });

  it('upsertAssignments deletes previous and creates new entries in a transaction', async () => {
    const txMock = {
      shopAssignment: {
        deleteMany: jest.fn().mockResolvedValue(undefined),
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    (prisma as any).$transaction.mockImplementation(async (cb: any) => cb(txMock));

    const res = await upsertAssignments('u1', [{ shopId: 's1', role: 'ATTENDANT' }]);
    expect(txMock.shopAssignment.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u1' } });
    expect(txMock.shopAssignment.createMany).toHaveBeenCalled();
    expect(res).toEqual({ count: 1 });
  });
});
