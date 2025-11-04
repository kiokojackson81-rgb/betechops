import { jest } from '@jest/globals';

// Mock prisma used by routes
jest.mock('@/lib/prisma', () => ({
  prisma: {
    jumiaOrder: { findUnique: jest.fn() },
    config: { findUnique: jest.fn(), upsert: jest.fn() },
  },
}));

// Mock auth/role gating
jest.mock('@/lib/api', () => {
  const original = jest.requireActual('@/lib/api');
  return {
    ...original,
    requireRole: jest.fn(async () => ({ ok: true, role: 'ADMIN', session: { user: { email: 'test@example.com', role: 'ADMIN' } } })),
  };
});

// Mock Jumia client calls
jest.mock('@/lib/jumia', () => ({
  getOrderItems: jest.fn(),
  getShipmentProviders: jest.fn(),
  postOrdersPack: jest.fn(),
  postOrdersPackV2: jest.fn(),
  postOrdersReadyToShip: jest.fn(),
  postOrdersPrintLabels: jest.fn(),
}));

import { prisma } from '@/lib/prisma';
import * as jumia from '@/lib/jumia';

describe('Jumia per-order routes', () => {
  const shopId = 'shop-test-1';
  const orderId = 'order-123';
  const itemId = 'item-abc';

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('POST /api/jumia/orders/[id]/pack returns 201 and uses provider discovery', async () => {
    (prisma as any).jumiaOrder.findUnique.mockResolvedValue({ shopId });
  (jumia.getOrderItems as any).mockResolvedValue({ items: [{ id: itemId }] });
  (jumia.getShipmentProviders as any).mockResolvedValue({ providers: [{ id: 'P1', name: 'OnlyProv', requiredTrackingCode: false }] });
  (jumia.postOrdersPack as any).mockResolvedValue({ ok: true });

    const { POST } = await import('../../src/app/api/jumia/orders/[id]/pack/route');
    const req = {
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ shipmentProviderId: 'P1' }),
      nextUrl: new URL(`http://localhost/api/jumia/orders/${orderId}/pack?shopId=${shopId}`),
    } as any;

    const res = await POST(req, { params: Promise.resolve({ id: orderId }) });
    expect(res.status).toBe(201);
  });

  it('POST /api/jumia/orders/[id]/ready-to-ship auto-packs and returns 201', async () => {
    (prisma as any).jumiaOrder.findUnique.mockResolvedValue({ shopId });
  (jumia.getOrderItems as any).mockResolvedValue({ items: [{ id: itemId, status: 'PENDING' }] });
  (jumia.getShipmentProviders as any).mockResolvedValue({ providers: [{ id: 'P1', name: 'OnlyProv', requiredTrackingCode: false }] });
  (jumia.postOrdersPack as any).mockResolvedValue({ ok: true });
  (jumia.postOrdersReadyToShip as any).mockResolvedValue({ ok: true });

    const { POST } = await import('../../src/app/api/jumia/orders/[id]/ready-to-ship/route');
    const req = {
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ orderItemIds: [itemId] }),
      nextUrl: new URL(`http://localhost/api/jumia/orders/${orderId}/ready-to-ship?shopId=${shopId}`),
    } as any;

    const res = await POST(req, { params: Promise.resolve({ id: orderId }) });
    expect(res.status).toBe(201);
  });

  it('POST /api/jumia/orders/[id]/print-labels returns 201 JSON when label not inline', async () => {
    (prisma as any).jumiaOrder.findUnique.mockResolvedValue({ shopId });
  (jumia.getOrderItems as any).mockResolvedValue({ items: [{ id: itemId }] });
    // Return a structure without extractable inline label to exercise JSON 201 path
  (jumia.postOrdersPrintLabels as any).mockResolvedValue({ success: { ok: true } });

    const { POST } = await import('../../src/app/api/jumia/orders/[id]/print-labels/route');
    const req = {
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ orderItemIds: [itemId] }),
      nextUrl: new URL(`http://localhost/api/jumia/orders/${orderId}/print-labels?shopId=${shopId}`),
    } as any;

    const res = await POST(req, { params: Promise.resolve({ id: orderId }) });
    expect(res.status).toBe(201);
  });
});
