jest.mock('server-only', () => ({}), { virtual: true });

import { jest } from '@jest/globals';

jest.mock('@/lib/prisma', () => ({
  prisma: { $transaction: jest.fn() },
}));

jest.mock('@/lib/auth', () => ({ requireAttendant: jest.fn(async () => ({ ok: true, user: { id: 'u1' } })) }));

jest.mock('@/workers/receiptSender', () => ({
  sendReceiptChannels: jest.fn(async () => ({ ok: true, sent: [], channelStatus: {}, pdfUrlCustomer: null, pdfUrlFull: null })),
}));

jest.mock('@/lib/productTableCapabilities', () => ({
  getProductTableCapabilities: jest.fn(async () => ({
    skuColumn: 'sku',
    nameColumn: 'name',
    categoryColumn: 'category',
    priceColumn: 'sellingPrice',
    activeColumn: null,
    available: new Set<string>(),
  })),
}));

jest.mock('@/lib/receiptInternalNotifications', () => ({
  getSiteUrl: jest.fn(() => 'https://ops.betech.co.ke'),
  notifyInternalReceipt: jest.fn(async () => {}),
  notifyInternalPodAlerts: jest.fn(async () => {}),
}));

jest.mock('@/lib/receiptReadAfterWrite', () => ({
  waitForReceiptById: jest.fn(async ({ receiptId }: { receiptId: string }) => ({ id: receiptId, data: {} })),
}));

jest.mock('@/lib/posCustomerAccountSync', () => ({
  syncPosReceiptToCustomerAccount: jest.fn(async () => {}),
}));

jest.mock('@/lib/supportCommission', () => ({
  recomputeSupportCommissionLedger: jest.fn(async () => {}),
}));

import { POST } from '../../src/app/api/receipts/route';
import { prisma } from '@/lib/prisma';
import { sendReceiptChannels } from '@/workers/receiptSender';
import { notifyInternalPodAlerts, notifyInternalReceipt } from '@/lib/receiptInternalNotifications';

const resolvedProduct = {
  id: 'p1',
  lastBuyingPrice: 0,
  variableCost: false,
  commissionEnabled: false,
  commissionAmount: 0,
  commissionRequiresApproval: false,
};

function buildTx(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    shop: { findFirst: async () => ({ id: 'shop1' }) },
    product: {
      findFirst: async () => resolvedProduct,
      findUnique: async () => resolvedProduct,
      create: async (d: any) => ({ id: 'p1', ...d }),
    },
    order: {
      upsert: async (d: any) => ({ id: 'o1', orderNumber: d.create.orderNumber }),
      aggregate: async () => ({ _sum: { totalAmount: 0, paidAmount: 0 } }),
    },
    orderItem: { deleteMany: async () => {}, create: async () => ({}) },
    receipt: {
      findUnique: async () => null,
      create: async (d: any) => ({ id: 'r1', ...d }),
      update: async (d: any) => ({ id: d.where.id, ...d.data }),
    },
    commissionRecord: { create: async (d: any) => ({ id: 'c1', ...d }), update: async () => ({}) },
    ...overrides,
  } as any;
}

describe('receipts API', () => {
  afterEach(() => jest.clearAllMocks());

  it('POST /api/receipts returns ok', async () => {
    (prisma as any).$transaction.mockImplementation(async (fn: any) => fn(buildTx()));

    const req = { json: async () => ({ items: [{ title: 'A', quantity: 1, unitPrice: 100 }], attendantId: 'u1' }) } as unknown as Request;
    const res = await POST(req as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBeTruthy();
  });

  it('treats paymentMethod=POD as POD delivery (sends POD internal alerts, skips normal internal)', async () => {
    const receiptCreateCalls: any[] = [];
    (prisma as any).$transaction.mockImplementation(async (fn: any) =>
      fn(
        buildTx({
          receipt: {
            findUnique: async () => null,
            create: async (d: any) => {
              receiptCreateCalls.push(d);
              return { id: 'r_pod', ...d };
            },
            update: async (d: any) => ({ id: d.where.id, ...d.data }),
          },
        }),
      ),
    );

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
    expect(receiptCreateCalls[0]?.data?.data?.podDelivery?.status).toBe('pending');
    expect(sendReceiptChannels).toHaveBeenCalledWith(
      'r_pod',
      ['whatsapp', 'email', 'sms'],
      expect.objectContaining({ skipDefaultChatraceTags: true, markPodSent: true }),
    );
    expect(notifyInternalPodAlerts).toHaveBeenCalledWith('r_pod', expect.anything());
    expect(notifyInternalReceipt).not.toHaveBeenCalled();
  });

  it('treats customerType=pod as POD delivery (sends POD internal alerts, skips normal internal)', async () => {
    const receiptCreateCalls: any[] = [];
    (prisma as any).$transaction.mockImplementation(async (fn: any) =>
      fn(
        buildTx({
          receipt: {
            findUnique: async () => null,
            create: async (d: any) => {
              receiptCreateCalls.push(d);
              return { id: 'r_pod2', ...d };
            },
            update: async (d: any) => ({ id: d.where.id, ...d.data }),
          },
        }),
      ),
    );

    const res = await POST(
      {
        json: async () => ({
          items: [{ title: 'A', quantity: 1, unitPrice: 100 }],
          attendantId: 'u1',
          customerType: 'pod',
        }),
        url: 'http://localhost/api/receipts',
      } as any,
    );

    expect(res.status).toBe(200);
    expect(receiptCreateCalls[0]?.data?.data?.podDelivery?.status).toBe('pending');
    expect(sendReceiptChannels).toHaveBeenCalledWith(
      'r_pod2',
      ['whatsapp', 'email', 'sms'],
      expect.objectContaining({ skipDefaultChatraceTags: true, markPodSent: true }),
    );
    expect(notifyInternalPodAlerts).toHaveBeenCalledWith('r_pod2', expect.anything());
    expect(notifyInternalReceipt).not.toHaveBeenCalled();
  });

  it('sends normal internal notification for non-POD receipts', async () => {
    (prisma as any).$transaction.mockImplementation(async (fn: any) =>
      fn(
        buildTx({
          receipt: {
            findUnique: async () => null,
            create: async (d: any) => ({ id: 'r_cash', ...d }),
            update: async (d: any) => ({ id: d.where.id, ...d.data }),
          },
        }),
      ),
    );

    const res = await POST(
      {
        json: async () => ({
          items: [{ title: 'A', quantity: 1, unitPrice: 100 }],
          attendantId: 'u1',
          paymentMethod: 'CASH',
        }),
        url: 'http://localhost/api/receipts',
      } as any,
    );

    expect(res.status).toBe(200);
    expect(sendReceiptChannels).toHaveBeenCalledWith('r_cash', [], expect.anything());
    expect(notifyInternalReceipt).toHaveBeenCalled();
    expect(notifyInternalPodAlerts).not.toHaveBeenCalled();
  });

  it('skips generic customer notifications for project receipts', async () => {
    (prisma as any).$transaction.mockImplementation(async (fn: any) =>
      fn(
        buildTx({
          receipt: {
            findUnique: async () => null,
            create: async (d: any) => ({ id: 'r_project', ...d }),
            update: async (d: any) => ({ id: d.where.id, ...d.data }),
          },
        }),
      ),
    );

    const res = await POST(
      {
        json: async () => ({
          items: [{ title: 'A', quantity: 1, unitPrice: 100 }],
          attendantId: 'u1',
          customerType: 'project',
        }),
        url: 'http://localhost/api/receipts',
      } as any,
    );

    expect(res.status).toBe(200);
    expect(sendReceiptChannels).not.toHaveBeenCalled();
    expect(notifyInternalReceipt).not.toHaveBeenCalled();
    expect(notifyInternalPodAlerts).not.toHaveBeenCalled();
  });
});
