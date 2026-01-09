"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadDefaultProviders = loadDefaultProviders;
exports.chunk = chunk;
exports.fallbackTrackingCode = fallbackTrackingCode;
exports.resolvePackPackagesForOrders = resolvePackPackagesForOrders;
exports.collectOrderItemIdsByStatus = collectOrderItemIdsByStatus;
exports.packWithV2 = packWithV2;
exports.readyToShip = readyToShip;
exports.printLabels = printLabels;
const prisma_1 = require("@/lib/prisma");
const jumia_1 = require("@/lib/jumia");
async function loadDefaultProviders() {
    const row = await prisma_1.prisma.config.findUnique({ where: { key: 'jumia:shipper-defaults' } }).catch(() => null);
    return (row?.json ?? {}) || {};
}
function chunk(arr, size) {
    const out = [];
    for (let i = 0; i < arr.length; i += size)
        out.push(arr.slice(i, i + size));
    return out;
}
function fallbackTrackingCode(base) {
    const ts = Date.now();
    return `AUTO-${base}-${ts}`.slice(0, 32);
}
async function resolvePackPackagesForOrders(opts) {
    const { shopId, orderIds, defaultProviders } = opts;
    const maxItems = opts.maxItems ?? 500;
    const packages = [];
    for (const orderId of orderIds) {
        const items = await (0, jumia_1.getOrderItems)({ shopId, orderId }).catch(() => []);
        const pendingItems = (items || []).filter((it) => (it?.status || '').toUpperCase() === 'PENDING');
        if (pendingItems.length === 0)
            continue;
        // pick provider: default for shop or from provider list for first item
        let shipmentProviderId = defaultProviders[shopId]?.providerId;
        let trackingCode;
        if (!shipmentProviderId || shipmentProviderId === 'auto') {
            const prov = await (0, jumia_1.getShipmentProviders)({ shopId, orderItemIds: [pendingItems[0].id] }).catch(() => ({ providers: [] }));
            const provider = (prov?.providers || []).find((p) => !p?.requiredTrackingCode) || (prov?.providers || [])[0];
            if (!provider)
                continue;
            shipmentProviderId = provider.id;
            if (provider.requiredTrackingCode)
                trackingCode = fallbackTrackingCode(pendingItems[0].id.slice(0, 8));
        }
        const picked = pendingItems.slice(0, Math.max(1, Math.floor(maxItems / orderIds.length)));
        packages.push({
            orderNumber: orderId,
            shipmentProviderId,
            trackingCode,
            orderItems: picked.map((it) => ({ id: it.id })),
        });
    }
    return packages;
}
async function collectOrderItemIdsByStatus(opts) {
    const { shopId, orderIds, includeStatuses } = opts;
    const max = opts.max ?? 1000;
    const want = new Set(includeStatuses.map((s) => s.toUpperCase()));
    const out = [];
    for (const orderId of orderIds) {
        if (out.length >= max)
            break;
        const items = await (0, jumia_1.getOrderItems)({ shopId, orderId }).catch(() => []);
        for (const it of items || []) {
            const st = String(it?.status || '').toUpperCase();
            if (want.has(st)) {
                out.push(it.id);
                if (out.length >= max)
                    break;
            }
        }
    }
    return out;
}
async function packWithV2(shopId, packages) {
    if (!packages.length)
        return { ok: true, packages: 0, result: [] };
    const result = await (0, jumia_1.postOrdersPackV2)({ shopId, packages });
    return { ok: true, packages: packages.length, result };
}
async function readyToShip(shopId, orderItemIds) {
    if (!orderItemIds.length)
        return { ok: true, items: 0 };
    const batches = chunk(orderItemIds, 180);
    const results = [];
    for (const ids of batches) {
        const r = await (0, jumia_1.postOrdersReadyToShip)({ shopId, orderItemIds: ids });
        results.push(r);
    }
    return { ok: true, items: orderItemIds.length, result: results };
}
async function printLabels(shopId, orderItemIds, includeLabels = false) {
    if (!orderItemIds.length)
        return { ok: true, items: 0, labels: [] };
    const batches = chunk(orderItemIds, 120);
    const allLabels = [];
    for (const ids of batches) {
        const r = await (0, jumia_1.postOrdersPrintLabels)({ shopId, orderItemIds: ids });
        const labels = (r?.labels || []).map((x) => (includeLabels ? x : { trackingNumber: x.trackingNumber }));
        allLabels.push(...labels);
    }
    return { ok: true, items: orderItemIds.length, labels: allLabels };
}
