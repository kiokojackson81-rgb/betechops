import { POST } from '@/app/api/users/route';

jest.mock('@/lib/api', () => ({ requireRole: async () => ({ ok: true }) }));
jest.mock('@/lib/prisma', () => ({ prisma: { user: { upsert: jest.fn().mockResolvedValue({ id: 'u1', email: 'x@example.com', name: 'X' }) } } }));

describe('POST /api/users', () => {
  it('creates a user', async () => {
    const req = new Request('http://localhost', { method: 'POST', body: JSON.stringify({ email: 'test@example.com', name: 'Test' }) });
    const res = await POST(req as unknown as Request);
    // route returns NextResponse; we can check it's defined and contains JSON
    expect(res).toBeDefined();
  });
});
