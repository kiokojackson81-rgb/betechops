"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = SyncedShopsList;
const jsx_runtime_1 = require("react/jsx-runtime");
function formatTs(value) {
    if (!value)
        return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime()))
        return null;
    try {
        return new Intl.DateTimeFormat(undefined, {
            year: "numeric",
            month: "short",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "Africa/Nairobi",
        }).format(date);
    }
    catch {
        return date.toISOString();
    }
}
function SyncedShopsList({ shops }) {
    if (!Array.isArray(shops) || shops.length === 0) {
        return ((0, jsx_runtime_1.jsx)("p", { className: "text-sm text-slate-400", children: "No synced Jumia shops detected yet." }));
    }
    return ((0, jsx_runtime_1.jsx)("div", { className: "space-y-3", children: shops.map((shop) => {
            const lastSync = formatTs(shop.lastOrdersUpdatedBefore);
            const updated = formatTs(shop.updatedAt);
            return ((0, jsx_runtime_1.jsxs)("div", { className: "rounded border border-white/10 bg-white/5 p-3", children: [(0, jsx_runtime_1.jsx)("div", { className: "font-medium", children: shop.name }), (0, jsx_runtime_1.jsxs)("div", { className: "text-xs text-slate-400", children: ["Account: ", shop.accountLabel ?? "Jumia", " \u00B7 ID: ", shop.id] }), lastSync && ((0, jsx_runtime_1.jsxs)("div", { className: "text-xs text-slate-400", children: ["Last orders sync: ", lastSync] })), !lastSync && updated && ((0, jsx_runtime_1.jsxs)("div", { className: "text-xs text-slate-500", children: ["Updated: ", updated] }))] }, shop.id));
        }) }));
}
