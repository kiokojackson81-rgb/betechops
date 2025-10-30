import { prisma } from '@/lib/prisma';
import type { NormalizedOrder } from '@/lib/connectors/normalize';

function mapStatus(s: string) {
  const ss = (s || '').toLowerCase();
  if (ss.includes('pending')) return 'PENDING';
  if (ss.includes('process') || ss.includes('processing')) return 'PROCESSING';
  if (ss.includes('fulfil') || ss.includes('fulfilled')) return 'FULFILLED';
  if (ss.includes('complete')) return 'COMPLETED';
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
    await p.order.update({ where: { id: existing.id }, data: { status: mapStatus(status), totalAmount } });
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
    return { orderId: existing.id, createdItems };
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

  return { orderId: created.id, createdItems };
}
