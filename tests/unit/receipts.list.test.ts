jest.mock("@/lib/auth", () => ({ auth: jest.fn().mockResolvedValue({ user: { id: "admin", role: "ADMIN" } }) }));
jest.mock("@/workers/receiptSender", () => ({ sendReceiptChannels: jest.fn() }));
jest.mock("server-only", () => ({}), { virtual: true });
import { jest } from '@jest/globals';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    receipt: { findMany: jest.fn() },
    marketingReceipt: { findMany: jest.fn() },
    supportReceipt: { findMany: jest.fn() },
  },
}));

import { GET } from '../../src/app/api/receipts/route';
import { prisma } from '@/lib/prisma';

describe('GET /api/receipts', () => {
  afterEach(() => jest.resetAllMocks());

  it('returns mapped receipts', async () => {
    (prisma as any).receipt.findMany.mockResolvedValue([{ id: 'r1', order: { orderNumber: 'ORD1', customerName: 'Alice', items: [] }, docType: 'RECEIPT', generatedAt: new Date().toISOString(), totals: { total: 100 }, issuedBy: { name: 'Bob' } }]);
    (prisma as any).marketingReceipt.findMany.mockResolvedValue([]);
    (prisma as any).supportReceipt.findMany.mockResolvedValue([]);
    const req = new Request('http://localhost/api/receipts?includeItems=true');
    const res = await GET(req as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.receipts)).toBe(true);
    expect(body.receipts[0].orderRef).toBe('ORD1');
  });

  it('uses explicit attendantId as a staff-owner filter for admin-style receipt links', async () => {
    (prisma as any).receipt.findMany.mockResolvedValue([]);
    (prisma as any).marketingReceipt.findMany.mockResolvedValue([]);
    (prisma as any).supportReceipt.findMany.mockResolvedValue([]);

    const req = new Request('http://localhost/api/receipts?attendantId=benjamin-id&start=2026-04-25&end=2026-05-24');
    const res = await GET(req as any);

    expect(res.status).toBe(200);
    const where = (prisma as any).receipt.findMany.mock.calls[0][0].where;
    expect(where.AND).toContainEqual({
      OR: [
        { order: { attendantId: 'benjamin-id' } },
        { data: { path: ["attendantId"], equals: 'benjamin-id' } },
        { data: { path: ["projectFlow", "handlerStaffId"], equals: 'benjamin-id' } },
      ],
    });
  });

  it('does not expose profit or completed payment status for an unpaid completed project', async () => {
    (prisma as any).receipt.findMany.mockResolvedValue([{
      id: 'project-unpaid', receiptNumber: 'BETECH2026091412548', docType: 'RECEIPT',
      generatedAt: new Date('2026-09-14T07:16:04.506Z'), totals: { total: 860000, buyingTotal: 500000 },
      data: { customerType: 'project', projectFlow: { isProject: true, stage: 'COMPLETED_POSTED', projectValue: 860000, totalPaidAmount: 0, paymentStatus: 'UNPAID' } },
      order: { orderNumber: 'BETECH2026091412548', customerName: 'University of Eastern Africa Baraton', totalAmount: 860000, paidAmount: 0, paymentStatus: 'UNPAID', status: 'COMPLETED', items: [] },
    }]);
    (prisma as any).marketingReceipt.findMany.mockResolvedValue([]);
    (prisma as any).supportReceipt.findMany.mockResolvedValue([]);
    const body = await (await GET(new Request('http://localhost/api/receipts?customerType=project&scope=global'))).json();
    expect(body.receipts[0]).toMatchObject({ projectStage: 'COMPLETED_POSTED', status: 'PENDING', paymentStatus: 'UNPAID' });
    expect(body.receipts[0].profit).toBeUndefined();
    expect(body.summary.totalProfit).toBe(0);
  });
});
