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
        var _a, _b, _c, _d, _e, _f, _g, _h;
        const obj = (it || {});
        return {
            externalSku: obj.sku || obj.spu || String(obj.product_sku || obj.sku || ""),
            title: obj.title || obj.name || "",
            qty: Number((_b = (_a = obj.quantity) !== null && _a !== void 0 ? _a : obj.qty) !== null && _b !== void 0 ? _b : 1),
            salePrice: Number((_d = (_c = obj.price) !== null && _c !== void 0 ? _c : obj.selling_price) !== null && _d !== void 0 ? _d : 0),
            fees: {
                commission: Number((_f = (_e = obj.commission) !== null && _e !== void 0 ? _e : obj.fee) !== null && _f !== void 0 ? _f : 0),
                shipping: Number((_g = obj.shipping) !== null && _g !== void 0 ? _g : 0),
                tax: Number((_h = obj.tax) !== null && _h !== void 0 ? _h : 0),
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
    var _a, _b;
    // Minimal mapping for Kilimall; expand as needed to match Kilimall response structure.
    const rawObj = (raw || {});
    const itemsArr = (rawObj.items || rawObj.order_items || []);
    const items = itemsArr.map((it) => {
        var _a, _b, _c, _d, _e, _f, _g;
        const obj = (it || {});
        return {
            externalSku: obj.sku || obj.spu || String(obj.product_sku || ""),
            title: obj.title || obj.name || "",
            qty: Number((_b = (_a = obj.quantity) !== null && _a !== void 0 ? _a : obj.qty) !== null && _b !== void 0 ? _b : 1),
            salePrice: Number((_d = (_c = obj.price) !== null && _c !== void 0 ? _c : obj.price_total) !== null && _d !== void 0 ? _d : 0),
            fees: {
                commission: Number((_e = obj.commission) !== null && _e !== void 0 ? _e : 0),
                shipping: Number((_f = obj.shipping) !== null && _f !== void 0 ? _f : 0),
                tax: Number((_g = obj.tax) !== null && _g !== void 0 ? _g : 0),
            },
        };
    });
    return {
        platform: 'KILIMALL',
        shopId,
        externalOrderId: String(rawObj.order_id || rawObj.externalOrderId || rawObj.trade_no || rawObj.order_no),
        status: rawObj.status || rawObj.order_status || "",
        buyer: { name: ((_a = rawObj.buyer) === null || _a === void 0 ? void 0 : _a.name) || rawObj.customerName, phone: ((_b = rawObj.buyer) === null || _b === void 0 ? void 0 : _b.phone) || rawObj.customerPhone },
        orderedAt: rawObj.created_at || rawObj.ordered_at || new Date().toISOString(),
        items,
    };
}
