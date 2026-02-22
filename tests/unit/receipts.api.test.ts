import { jest } from '@jest/globals';

jest.mock('@/lib/prisma', () => ({
  prisma: { $transaction: jest.fn() },
}));

jest.mock('@/lib/auth', () => ({ requireAttendant: jest.fn(async () => ({ ok: true, user: { id: 'u1' } })) }));

jest.mock('@/workers/receiptSender', () => ({
  sendReceiptChannels: jest.fn(async () => ({ ok: true, sent: [], channelStatus: {}, pdfUrlCustomer: null, pdfUrlFull: null })),
}));

jest.mock('@/lib/receiptInternalNotifications', () => ({
  getSiteUrl: jest.fn(() => 'https://ops.betech.co.ke'),
  notifyInternalReceipt: jest.fn(async () => {}),
  notifyInternalPodAlerts: jest.fn(async () => {}),
}));

import { POST } from '../../src/app/api/receipts/route';
import { prisma } from '@/lib/prisma';
import { sendReceiptChannels } from '@/workers/receiptSender';
import { notifyInternalPodAlerts, notifyInternalReceipt } from '@/lib/receiptInternalNotifications';

describe('receipts API', () => {
  afterEach(() => jest.resetAllMocks());

  it('POST /api/receipts returns ok', async () => {
    (prisma as any).$transaction.mockImplementation(async (fn: any) => {
      // provide a minimal tx object used by the handler
      const tx: any = {
        shop: { findFirst: async () => ({ id: 'shop1' }) },
        product: { findFirst: async () => null, create: async (d: any) => ({ id: 'p1', ...d }) },
        order: { upsert: async (d: any) => ({ id: 'o1', orderNumber: d.create.orderNumber }), aggregate: async () => ({ _sum: { totalAmount: 0, paidAmount: 0 } }) },
        orderItem: { deleteMany: async () => {}, create: async () => ({}) },
        receipt: { findUnique: async () => null, create: async (d: any) => ({ id: 'r1', ...d }), update: async (d: any) => ({ id: d.where.id, ...d.data }) },
        commissionRecord: { create: async (d: any) => ({ id: 'c1', ...d }), update: async () => ({}) },
      };
      return fn(tx);
    });

    const req = { json: async () => ({ items: [{ title: 'A', quantity: 1, unitPrice: 100 }], attendantId: 'u1' }) } as unknown as Request;
    const res = await POST(req as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBeTruthy();
  });

  it('treats paymentMethod=POD as POD delivery (sends POD internal alerts, skips normal internal)', async () => {
    const receiptCreateCalls: any[] = [];

    (prisma as any).$transaction.mockImplementation(async (fn: any) => {
      const tx: any = {
        shop: { findFirst: async () => ({ id: 'shop1' }) },
        product: { findFirst: async () => null, create: async (d: any) => ({ id: 'p1', ...d }) },
        order: {
          upsert: async (d: any) => ({ id: 'o1', orderNumber: d.create.orderNumber }),
          aggregate: async () => ({ _sum: { totalAmount: 0, paidAmount: 0 } }),
        },
        orderItem: { deleteMany: async () => {}, create: async () => ({}) },
        receipt: {
          findUnique: async () => null,
          create: async (d: any) => {
            receiptCreateCalls.push(d);
            return { id: 'r_pod', ...d };
          },
          update: async (d: any) => ({ id: d.where.id, ...d.data }),
        },
        commissionRecord: { create: async (d: any) => ({ id: 'c1', ...d }), update: async () => ({}) },
      };
      return fn(tx);
    });

    const req = {
      json: async () => ({
        items: [{ title: 'A', quantity: 1, unitPrice: 100 }],
        attendantId: 'u1',
        paymentMethod: 'POD',
      }),
      url: 'http://localhost/api/receipts',
    } as unknown as Request;

    const res = await POST(req as any);
    expect(res.status).toBe(200);

    expect(receiptCreateCalls.length).toBeGreaterThan(0);
    const createdReceiptPayload = receiptCreateCalls[0];
    expect(createdReceiptPayload?.data?.data?.podDelivery?.status).toBe('pending');

    expect(sendReceiptChannels).toHaveBeenCalledWith(
      'r_pod',
      ['whatsapp'],
      expect.objectContaining({ skipDefaultChatraceTags: true, markPodSent: true }),
    );
    expect(notifyInternalPodAlerts).toHaveBeenCalledWith('r_pod', expect.anything());
    expect(notifyInternalReceipt).not.toHaveBeenCalled();
  });

  it('treats customerType=pod as POD delivery (sends POD internal alerts, skips normal internal)', async () => {
    const receiptCreateCalls: any[] = [];

    (prisma as any).$transaction.mockImplementation(async (fn: any) => {
      const tx: any = {
        shop: { findFirst: async () => ({ id: 'shop1' }) },
        product: { findFirst: async () => null, create: async (d: any) => ({ id: 'p1', ...d }) },
        order: {
          upsert: async (d: any) => ({ id: 'o1', orderNumber: d.create.orderNumber }),
          aggregate: async () => ({ _sum: { totalAmount: 0, paidAmount: 0 } }),
        },
        orderItem: { deleteMany: async () => {}, create: async () => ({}) },
        receipt: {
          findUnique: async () => null,
          create: async (d: any) => {
            receiptCreateCalls.push(d);
            return { id: 'r_pod2', ...d };
          },
          update: async (d: any) => ({ id: d.where.id, ...d.data }),
        },
        commissionRecord: { create: async (d: any) => ({ id: 'c1', ...d }), update: async () => ({}) },
      };
      return fn(tx);
    });

    const req = {
      json: async () => ({
        items: [{ title: 'A', quantity: 1, unitPrice: 100 }],
        attendantId: 'u1',
        customerType: 'pod',
      }),
      url: 'http://localhost/api/receipts',
    } as unknown as Request;

    const res = await POST(req as any);
    expect(res.status).toBe(200);

    expect(receiptCreateCalls.length).toBeGreaterThan(0);
    const createdReceiptPayload = receiptCreateCalls[0];
    expect(createdReceiptPayload?.data?.data?.podDelivery?.status).toBe('pending');

    expect(sendReceiptChannels).toHaveBeenCalledWith(
      'r_pod2',
      ['whatsapp'],
      expect.objectContaining({ skipDefaultChatraceTags: true, markPodSent: true }),
    );
    expect(notifyInternalPodAlerts).toHaveBeenCalledWith('r_pod2', expect.anything());
    expect(notifyInternalReceipt).not.toHaveBeenCalled();
  });

  it('sends normal internal notification for non-POD receipts', async () => {
    (sendReceiptChannels as jest.Mock).mockClear();
    (notifyInternalPodAlerts as jest.Mock).mockClear();
    (notifyInternalReceipt as jest.Mock).mockClear();

    (prisma as any).$transaction.mockImplementation(async (fn: any) => {
      const tx: any = {
        shop: { findFirst: async () => ({ id: 'shop1' }) },
        product: { findFirst: async () => null, create: async (d: any) => ({ id: 'p1', ...d }) },
        order: {
          upsert: async (d: any) => ({ id: 'o1', orderNumber: d.create.orderNumber }),
          aggregate: async () => ({ _sum: { totalAmount: 0, paidAmount: 0 } }),
        },
        orderItem: { deleteMany: async () => {}, create: async () => ({}) },
        receipt: {
          findUnique: async () => null,
          create: async (d: any) => ({ id: 'r_cash', ...d }),
          update: async (d: any) => ({ id: d.where.id, ...d.data }),
        },
        commissionRecord: { create: async (d: any) => ({ id: 'c1', ...d }), update: async () => ({}) },
      };
      return fn(tx);
    });

    const req = {
      json: async () => ({
        items: [{ title: 'A', quantity: 1, unitPrice: 100 }],
        attendantId: 'u1',
        paymentMethod: 'CASH',
      }),
      url: 'http://localhost/api/receipts',
    } as unknown as Request;

    const res = await POST(req as any);
    expect(res.status).toBe(200);

    expect(sendReceiptChannels).toHaveBeenCalledWith('r_cash', [], expect.anything());
    expect(notifyInternalReceipt).toHaveBeenCalled();
    expect(notifyInternalPodAlerts).not.toHaveBeenCalled();
  });
});
