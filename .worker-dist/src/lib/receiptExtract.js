"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractReceiptTotalKES = extractReceiptTotalKES;
exports.extractItemsShort = extractItemsShort;
const jsonGet_1 = require("@/lib/jsonGet");
function extractReceiptTotalKES(receipt) {
    const totals = receipt?.totals;
    return ((0, jsonGet_1.jnum)(totals, "sellingTotal") ||
        (0, jsonGet_1.jnum)(totals, "grandTotal") ||
        (0, jsonGet_1.jnum)(totals, "total") ||
        (0, jsonGet_1.jnum)(totals, "amount") ||
        (0, jsonGet_1.jnum)(totals, "subtotal") ||
        0);
}
function extractItemsShort(receipt, maxItems = 5) {
    const data = receipt?.data;
    const items = (Array.isArray((0, jsonGet_1.jn)(data, "items")) && (0, jsonGet_1.jn)(data, "items")) ||
        (Array.isArray((0, jsonGet_1.jn)(data, "lineItems")) && (0, jsonGet_1.jn)(data, "lineItems")) ||
        (Array.isArray((0, jsonGet_1.jn)(data, "lines")) && (0, jsonGet_1.jn)(data, "lines")) ||
        [];
    if (!Array.isArray(items) || items.length === 0)
        return "";
    const parts = items.slice(0, maxItems).map((item, index) => {
        const name = (0, jsonGet_1.jstr)(item, "name") ||
            (0, jsonGet_1.jstr)(item, "title") ||
            (0, jsonGet_1.jstr)(item, "item") ||
            (0, jsonGet_1.jstr)(item, "description") ||
            "Item";
        const qty = Number(item?.qty ?? item?.quantity ?? 1);
        const safeQty = Number.isFinite(qty) ? qty : 1;
        return `${index + 1}) ${name} x${safeQty}`;
    });
    const more = items.length > maxItems ? ` (+${items.length - maxItems} more)` : "";
    return parts.join(", ") + more;
}
