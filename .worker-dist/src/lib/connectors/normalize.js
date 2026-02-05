"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeFromJumia = normalizeFromJumia;
exports.normalizeFromKilimall = normalizeFromKilimall;
// TODO(copilot): Extend normalizeFromJumia(order) to include:
// - shopIds[] (if orders can belong to multiple shops)
// - number (order number), totals (totalAmount, currency), deliveryOption
// - pendingSince (first seen pending timestamp)
// - preserve raw timestamps as UTC in a `raw` field for troubleshooting
function normalizeFromJumia(raw, shopId) {
    // Minimal defensive mapping. Real mapping should be expanded to match Jumia payload.
    const rawObj = (raw || {});
    const itemsArr = (rawObj.items || rawObj.orderItems || []);
    const items = itemsArr.map((it) => {
        const obj = (it || {});
        return {
            externalSku: obj.sku || obj.spu || String(obj.product_sku || obj.sku || ""),
            title: obj.title || obj.name || "",
            qty: Number(obj.quantity ?? obj.qty ?? 1),
            salePrice: Number(obj.price ?? obj.selling_price ?? 0),
            fees: {
                commission: Number(obj.commission ?? obj.fee ?? 0),
                shipping: Number(obj.shipping ?? 0),
                tax: Number(obj.tax ?? 0),
            },
        };
    });
    return {
        platform: 'JUMIA',
        shopId,
        externalOrderId: String(rawObj.externalId || rawObj.orderId || rawObj.order_number || rawObj.orderNumber),
        status: rawObj.status || rawObj.order_status || "",
        buyer: { name: rawObj.buyer_name || rawObj.customerName, phone: rawObj.buyer_phone || rawObj.customerPhone },
        orderedAt: rawObj.createdAt || rawObj.ordered_at || new Date().toISOString(),
        items,
    };
}
function normalizeFromKilimall(raw, shopId) {
    // Minimal mapping for Kilimall; expand as needed to match Kilimall response structure.
    const rawObj = (raw || {});
    const itemsArr = (rawObj.items || rawObj.order_items || []);
    const items = itemsArr.map((it) => {
        const obj = (it || {});
        return {
            externalSku: obj.sku || obj.spu || String(obj.product_sku || ""),
            title: obj.title || obj.name || "",
            qty: Number(obj.quantity ?? obj.qty ?? 1),
            salePrice: Number(obj.price ?? obj.price_total ?? 0),
            fees: {
                commission: Number(obj.commission ?? 0),
                shipping: Number(obj.shipping ?? 0),
                tax: Number(obj.tax ?? 0),
            },
        };
    });
    return {
        platform: 'KILIMALL',
        shopId,
        externalOrderId: String(rawObj.order_id || rawObj.externalOrderId || rawObj.trade_no || rawObj.order_no),
        status: rawObj.status || rawObj.order_status || "",
        buyer: { name: rawObj.buyer?.name || rawObj.customerName, phone: rawObj.buyer?.phone || rawObj.customerPhone },
        orderedAt: rawObj.created_at || rawObj.ordered_at || new Date().toISOString(),
        items,
    };
}
