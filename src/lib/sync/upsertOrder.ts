import { prisma } from '@/lib/prisma';
import type { NormalizedOrder } from '@/lib/connectors/normalize';
import { Role } from '@prisma/client';

function mapStatus(s: string) {
  const ss = (s || '').toLowerCase();
  if (ss.includes('pending')) return 'PENDING';
  if (ss.includes('ready') || ss.includes('ship')) return 'PROCESSING';
  if (ss.includes('process') || ss.includes('processing')) return 'PROCESSING';
  if (ss.includes('fulfil') || ss.includes('fulfilled')) return 'FULFILLED';
  if (ss.includes('complete') || ss.includes('delivered')) return 'COMPLETED';
  if (ss.includes('return')) return 'CANCELED';
  if (ss.includes('fail')) return 'CANCELED';
  if (ss.includes('cancel')) return 'CANCELED';
  return 'PENDING';
}

export async function upsertNormalizedOrder(n: NormalizedOrder) {
  const { externalOrderId, shopId, items, buyer, orderedAt, status } = n;
  const orderNumber = externalOrderId;
  const totalAmount = items.reduce((s, it) => s + (Number(it.salePrice || 0) * Number(it.qty || 0)), 0);

  const p = prisma;

  // Try to find existing order by unique orderNumber
  const existing = await p.order.findUnique({ where: { orderNumber } }).catch(() => null);
  if (existing) {
    // update summary fields
    const orderRecord = await p.order.update({ where: { id: existing.id }, data: { status: mapStatus(status), totalAmount, customerName: buyer?.name || existing.customerName } });
    // replace items (simple approach)
    await p.orderItem.deleteMany({ where: { orderId: existing.id } });
    const createdItems: unknown[] = [];
    for (const it of items) {
      let prod = (await p.product.findUnique({ where: { sku: it.externalSku } }).catch(() => null)) as { id: string } | null;
      if (!prod) {
        prod = (await p.product.create({ data: { sku: it.externalSku, name: it.title || it.externalSku, category: "unknown", sellingPrice: Number(it.salePrice || 0) } })) as { id: string };
      }
      const oi = await p.orderItem.create({ data: { orderId: existing.id, productId: prod.id, quantity: it.qty, sellingPrice: it.salePrice } });
      createdItems.push(oi as unknown);
    }
    return { orderId: orderRecord.id, order: orderRecord, createdItems };
  }

  // create new order
  const created = await p.order.create({ data: { orderNumber, shopId, customerName: buyer?.name || '', status: mapStatus(status), totalAmount, createdAt: new Date(orderedAt) } });
  const createdItems: unknown[] = [];
  for (const it of items) {
    let prod = (await p.product.findUnique({ where: { sku: it.externalSku } }).catch(() => null)) as { id: string } | null;
    if (!prod) {
      prod = (await p.product.create({ data: { sku: it.externalSku, name: it.title || it.externalSku, category: "unknown", sellingPrice: Number(it.salePrice || 0) } })) as { id: string };
    }
    const oi = await p.orderItem.create({ data: { orderId: created.id, productId: prod.id, quantity: it.qty, sellingPrice: it.salePrice } });
    createdItems.push(oi as unknown);
  }

  // Persist minimal snapshot in JumiaOrder sync table when available
  try {
    await p.jumiaOrder.upsert({
      where: { id: externalOrderId },
      create: {
        id: externalOrderId,
        number: Number.isFinite(Number(orderNumber)) ? Number(orderNumber) : null,
        status: status || "UNKNOWN",
        hasMultipleStatus: false,
        pendingSince: null,
        totalItems: items.length,
        packedItems: null,
        countryCode: null,
        isPrepayment: null,
        createdAtJumia: new Date(orderedAt),
        updatedAtJumia: new Date(orderedAt),
        shopId: shopId,
        shopName: undefined,
      },
      update: {
        status: status || "UNKNOWN",
        totalItems: items.length,
        updatedAtJumia: new Date(),
      },
    });
  } catch {
    // ignore if model not present or other issues
  }

  return { orderId: created.id, order: created, createdItems };
}

let _systemUserId: string | null | undefined;

async function getSystemUserId(): Promise<string | null> {
  if (_systemUserId !== undefined) return _systemUserId;
  const explicit = process.env.RETURNS_SYSTEM_USER_ID;
  if (explicit) {
    _systemUserId = explicit;
    return _systemUserId;
  }
  const admin = await prisma.user.findFirst({ where: { role: Role.ADMIN }, select: { id: true } }).catch(() => null);
  if (admin?.id) {
    _systemUserId = admin.id;
    return _systemUserId;
  }
  const any = await prisma.user.findFirst({ select: { id: true } }).catch(() => null);
  _systemUserId = any?.id ?? null;
  return _systemUserId;
}

function deriveReturnStatus(vendorStatus?: string, picked?: boolean) {
  if (picked) return 'picked_up';
  const s = (vendorStatus || '').toUpperCase();
  if (s.includes('DELIVERED') || s.includes('COMPLETED')) return 'picked_up';
  return 'pickup_scheduled';
}

function shouldPreserveStatus(current: string) {
  return current === 'picked_up' || current === 'received' || current === 'resolved';
}

export async function ensureReturnCaseForOrder(opts: {
  orderId: string;
  shopId: string;
  vendorStatus?: string;
  reasonCode?: string;
  vendorCreatedAt?: string | Date | null;
  picked?: boolean;
}) {
  const { orderId, shopId } = opts;
  const reasonCode = opts.reasonCode || opts.vendorStatus || 'JUMIA_RETURN';
  const picked = Boolean(opts.picked);
  const targetStatus = deriveReturnStatus(opts.vendorStatus, picked);
  const systemUserId = await getSystemUserId();
  if (!systemUserId) {
    console.warn('[returns] unable to create returnCase: no system user available');
    return null;
  }

  const existing = await prisma.returnCase.findFirst({ where: { orderId } });
  if (existing) {
    const data: Record<string, unknown> = {};
    if (reasonCode && existing.reasonCode !== reasonCode) data.reasonCode = reasonCode;
    if (picked && existing.status !== 'picked_up') {
      data.status = 'picked_up';
      if (!existing.pickedAt) data.pickedAt = new Date();
    } else if (!picked && !shouldPreserveStatus(existing.status)) {
      if (existing.status !== targetStatus) data.status = targetStatus;
    }
    if (Object.keys(data).length) {
      await prisma.returnCase.update({ where: { id: existing.id }, data });
    }
    return existing.id;
  }

  const created = await prisma.returnCase.create({
    data: {
      orderId,
      shopId,
      reasonCode,
      status: targetStatus,
      createdBy: systemUserId,
      pickedAt: picked ? new Date() : null,
      createdAt: opts.vendorCreatedAt ? new Date(opts.vendorCreatedAt) : undefined,
    },
  });
  return created.id;
}
