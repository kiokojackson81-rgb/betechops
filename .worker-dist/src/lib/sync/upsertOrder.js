"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.upsertNormalizedOrder = upsertNormalizedOrder;
exports.ensureReturnCaseForOrder = ensureReturnCaseForOrder;
const prisma_1 = require("@/lib/prisma");
const client_1 = require("@prisma/client");
function mapStatus(s) {
    const ss = (s || '').toLowerCase();
    if (ss.includes('pending'))
        return 'PENDING';
    if (ss.includes('ready') || ss.includes('ship'))
        return 'PROCESSING';
    if (ss.includes('process') || ss.includes('processing'))
        return 'PROCESSING';
    if (ss.includes('fulfil') || ss.includes('fulfilled'))
        return 'FULFILLED';
    if (ss.includes('complete') || ss.includes('delivered'))
        return 'COMPLETED';
    if (ss.includes('return'))
        return 'CANCELED';
    if (ss.includes('fail'))
        return 'CANCELED';
    if (ss.includes('cancel'))
        return 'CANCELED';
    return 'PENDING';
}
async function upsertNormalizedOrder(n) {
    const { externalOrderId, shopId, items, buyer, orderedAt, status } = n;
    const orderNumber = externalOrderId;
    const totalAmount = items.reduce((s, it) => s + (Number(it.salePrice || 0) * Number(it.qty || 0)), 0);
    const p = prisma_1.prisma;
    // Try to find existing order by unique orderNumber
    const existing = await p.order.findUnique({ where: { orderNumber } }).catch(() => null);
    if (existing) {
        // update summary fields
        const orderRecord = await p.order.update({ where: { id: existing.id }, data: { status: mapStatus(status), totalAmount, customerName: buyer?.name || existing.customerName } });
        // replace items (simple approach)
        await p.orderItem.deleteMany({ where: { orderId: existing.id } });
        const createdItems = [];
        for (const it of items) {
            let prod = (await p.product.findUnique({ where: { sku: it.externalSku } }).catch(() => null));
            if (!prod) {
                prod = (await p.product.create({ data: { sku: it.externalSku, name: it.title || it.externalSku, category: "unknown", sellingPrice: Number(it.salePrice || 0) } }));
            }
            const oi = await p.orderItem.create({ data: { orderId: existing.id, productId: prod.id, quantity: it.qty, sellingPrice: it.salePrice } });
            createdItems.push(oi);
        }
        return { orderId: orderRecord.id, order: orderRecord, createdItems };
    }
    // create new order
    const created = await p.order.create({ data: { orderNumber, shopId, customerName: buyer?.name || '', status: mapStatus(status), totalAmount, createdAt: new Date(orderedAt) } });
    const createdItems = [];
    for (const it of items) {
        let prod = (await p.product.findUnique({ where: { sku: it.externalSku } }).catch(() => null));
        if (!prod) {
            prod = (await p.product.create({ data: { sku: it.externalSku, name: it.title || it.externalSku, category: "unknown", sellingPrice: Number(it.salePrice || 0) } }));
        }
        const oi = await p.orderItem.create({ data: { orderId: created.id, productId: prod.id, quantity: it.qty, sellingPrice: it.salePrice } });
        createdItems.push(oi);
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
    }
    catch {
        // ignore if model not present or other issues
    }
    return { orderId: created.id, order: created, createdItems };
}
let _systemUserId;
async function getSystemUserId() {
    if (_systemUserId !== undefined)
        return _systemUserId;
    const explicit = process.env.RETURNS_SYSTEM_USER_ID;
    if (explicit) {
        _systemUserId = explicit;
        return _systemUserId;
    }
    const admin = await prisma_1.prisma.user.findFirst({ where: { role: client_1.Role.ADMIN }, select: { id: true } }).catch(() => null);
    if (admin?.id) {
        _systemUserId = admin.id;
        return _systemUserId;
    }
    const any = await prisma_1.prisma.user.findFirst({ select: { id: true } }).catch(() => null);
    _systemUserId = any?.id ?? null;
    return _systemUserId;
}
function deriveReturnStatus(vendorStatus, picked) {
    if (picked)
        return 'picked_up';
    const s = (vendorStatus || '').toUpperCase();
    if (s.includes('DELIVERED') || s.includes('COMPLETED'))
        return 'picked_up';
    return 'pickup_scheduled';
}
function shouldPreserveStatus(current) {
    return current === 'picked_up' || current === 'received' || current === 'resolved';
}
async function ensureReturnCaseForOrder(opts) {
    const { orderId, shopId } = opts;
    const reasonCode = opts.reasonCode || opts.vendorStatus || 'JUMIA_RETURN';
    const picked = Boolean(opts.picked);
    const targetStatus = deriveReturnStatus(opts.vendorStatus, picked);
    const systemUserId = await getSystemUserId();
    if (!systemUserId) {
        console.warn('[returns] unable to create returnCase: no system user available');
        return null;
    }
    const existing = await prisma_1.prisma.returnCase.findFirst({ where: { orderId } });
    if (existing) {
        const data = {};
        if (reasonCode && existing.reasonCode !== reasonCode)
            data.reasonCode = reasonCode;
        if (picked && existing.status !== 'picked_up') {
            data.status = 'picked_up';
            if (!existing.pickedAt)
                data.pickedAt = new Date();
        }
        else if (!picked && !shouldPreserveStatus(existing.status)) {
            if (existing.status !== targetStatus)
                data.status = targetStatus;
        }
        if (Object.keys(data).length) {
            await prisma_1.prisma.returnCase.update({ where: { id: existing.id }, data });
        }
        return existing.id;
    }
    const created = await prisma_1.prisma.returnCase.create({
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
