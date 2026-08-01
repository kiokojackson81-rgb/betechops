import { jest } from '@jest/globals';

jest.mock('@/workers/receiptSender', () => ({ sendReceiptChannels: jest.fn().mockResolvedValue({ ok: true, sent: ['email'] }) }));
jest.mock('@/lib/auth', () => ({ auth: jest.fn(async () => ({ user: { id: 'u1' } })) }));
jest.mock('@/lib/prisma', () => ({ prisma: { receipt: { findUnique: jest.fn().mockResolvedValue({ id: 'r1', data: {} }) } } }));
jest.mock('@/lib/receiptReadAfterWrite', () => ({
  waitForReceiptById: jest.fn(async ({ receiptId }: { receiptId: string }) => ({ id: receiptId, data: {} })),
}));

import { POST } from '../../src/app/api/receipts/[id]/send/route';
import { waitForReceiptById } from '@/lib/receiptReadAfterWrite';
import { sendReceiptChannels } from '@/workers/receiptSender';

describe('POST /api/receipts/:id/send', () => {
  afterEach(() => jest.clearAllMocks());

  it('calls worker and returns ok when authenticated', async () => {
    const req: any = { json: async () => ({ channels: ['email'] }), headers: { get: (_k: string) => undefined } };
    const res = await POST(req as any, { params: { id: 'r1' } } as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBeTruthy();
  });

  it('rejects generic resend for project receipts', async () => {
    (waitForReceiptById as jest.Mock).mockResolvedValueOnce({
      id: 'r_project',
      data: { customerType: 'project' },
    });

    const req: any = { json: async () => ({ channels: ['email'] }), headers: { get: (_k: string) => undefined } };
    const res = await POST(req as any, { params: { id: 'r_project' } } as any);
    expect(res.status).toBe(400);
    expect(sendReceiptChannels).not.toHaveBeenCalled();
  });
});
