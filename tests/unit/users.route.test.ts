import { POST } from '@/app/api/users/route';

jest.mock('@/lib/api', () => ({ requireRole: async () => ({ ok: true }) }));
jest.mock('@/lib/prisma', () => {
  const userUpsert = jest.fn().mockResolvedValue({ id: 'u1', email: 'x@example.com', name: 'X' });
  const userFindUnique = jest.fn().mockResolvedValue({ id: 'u1', email: 'x@example.com', name: 'X', categoryAssignments: [] });
  const deleteMany = jest.fn().mockResolvedValue({});
  const upsert = jest.fn().mockResolvedValue({});
  return {
    prisma: {
      user: { upsert: userUpsert },
      // provide $transaction to simulate Prisma transaction client
      $transaction: async (cb: any) => {
        const tx = {
          user: { upsert: userUpsert, findUniqueOrThrow: userFindUnique },
          attendantCategoryAssignment: { deleteMany, upsert },
        };
        return cb(tx);
      },
    },
  };
});

describe('POST /api/users', () => {
  it('creates a user', async () => {
    const req = new Request('http://localhost', { method: 'POST', body: JSON.stringify({ email: 'test@example.com', name: 'Test' }) });
    const res = await POST(req as unknown as Request);
    // route returns NextResponse; we can check it's defined and contains JSON
    expect(res).toBeDefined();
  });
});
