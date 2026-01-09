"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamic = void 0;
exports.default = JumiaReturnsPage;
const jsx_runtime_1 = require("react/jsx-runtime");
exports.dynamic = "force-dynamic";
const jumia_1 = require("@/lib/jumia");
const prisma_1 = require("@/lib/prisma");
async function fetchReturns({ token, size, status, shopId }) {
    const qs = new URLSearchParams();
    if (token)
        qs.set("token", token);
    if (size)
        qs.set("size", String(size));
    if (status)
        qs.set("status", status);
    const q = qs.toString() ? `?${qs.toString()}` : "";
    const shopAuth = shopId ? await (0, jumia_1.loadShopAuthById)(shopId).catch(() => undefined) : await (0, jumia_1.loadDefaultShopAuth)();
    // Try /returns first; fallback to /orders?status=RETURNED
    try {
        const j = await (0, jumia_1.jumiaFetch)(`/returns${q}`, shopAuth ? { shopAuth } : {});
        const items = Array.isArray(j?.items) ? j.items : Array.isArray(j?.data) ? j.data : j?.returns || [];
        const nextToken = String(j?.nextToken ?? j?.token ?? j?.next ?? "");
        return { items, nextToken, pathUsed: "/returns" };
    }
    catch {
        const status2 = status || "RETURNED";
        const join = q ? `${q}&status=${encodeURIComponent(status2)}` : `?status=${encodeURIComponent(status2)}`;
        const j = await (0, jumia_1.jumiaFetch)(`/orders${join}`, shopAuth ? { shopAuth } : {});
        const items = Array.isArray(j?.orders) ? j.orders : Array.isArray(j?.items) ? j.items : Array.isArray(j?.data) ? j.data : [];
        const nextToken = String(j?.nextToken ?? j?.token ?? j?.next ?? "");
        return { items, nextToken, pathUsed: "/orders" };
    }
}
async function JumiaReturnsPage({ searchParams, }) {
    const sp = (await searchParams) || {};
    const size = Math.min(100, Math.max(1, Number(sp.size || 20)));
    const token = (sp.token || "").trim() || undefined;
    const status = (sp.status || "").trim() || undefined;
    const shopId = (sp.shopId || "ALL").toString();
    let items = [];
    let nextToken = "";
    let pathUsed = "";
    if (shopId.toUpperCase() === "ALL") {
        const shops = await prisma_1.prisma.shop.findMany({ where: { isActive: true, platform: "JUMIA" }, select: { id: true, name: true } });
        const pages = await Promise.all(shops.map(async (s) => {
            try {
                const r = await fetchReturns({ token: undefined, size, status, shopId: s.id });
                // tag shop on items
                const tagged = (r.items || []).map((x) => ({ ...x, _shop: s }));
                return { items: tagged };
            }
            catch {
                return { items: [] };
            }
        }));
        items = pages.flatMap((p) => p.items);
        pathUsed = "/returns|/orders (per shop)";
        nextToken = ""; // aggregated view has no unified next token
    }
    else {
        const r = await fetchReturns({ token, size, status, shopId });
        items = r.items;
        nextToken = r.nextToken;
        pathUsed = r.pathUsed;
    }
    const qs = (params) => {
        const q = new URLSearchParams();
        for (const [k, v] of Object.entries(params))
            if (v !== undefined && v !== "")
                q.set(k, String(v));
        return q.toString();
    };
    return ((0, jsx_runtime_1.jsxs)("div", { className: "p-6 space-y-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between", children: [(0, jsx_runtime_1.jsx)("h1", { className: "text-2xl font-semibold", children: "Jumia Returns" }), (0, jsx_runtime_1.jsxs)("div", { className: "text-xs text-slate-400", children: ["source: ", pathUsed] })] }), (0, jsx_runtime_1.jsxs)("form", { className: "flex flex-wrap gap-2 items-end", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "block text-xs mb-1", children: "Shop" }), (0, jsx_runtime_1.jsxs)("select", { name: "shopId", defaultValue: shopId, className: "rounded bg-white/5 border border-white/10 px-2 py-1.5", children: [(0, jsx_runtime_1.jsx)("option", { value: "ALL", children: "All Jumia" }), (await prisma_1.prisma.shop.findMany({ where: { isActive: true, platform: "JUMIA" }, select: { id: true, name: true }, orderBy: { name: "asc" } }))
                                        .map((s) => ((0, jsx_runtime_1.jsx)("option", { value: s.id, children: s.name }, s.id)))] })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "block text-xs mb-1", children: "Status" }), (0, jsx_runtime_1.jsx)("input", { name: "status", placeholder: "RETURNED or waiting-pickup", defaultValue: sp.status || "", className: "rounded bg-white/5 border border-white/10 px-3 py-1.5" })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "block text-xs mb-1", children: "Page Size" }), (0, jsx_runtime_1.jsx)("select", { name: "size", defaultValue: String(size), className: "rounded bg-white/5 border border-white/10 px-2 py-1.5", children: [20, 50, 100].map((n) => ((0, jsx_runtime_1.jsx)("option", { value: n, children: n }, n))) })] }), (0, jsx_runtime_1.jsx)("button", { className: "rounded border border-white/10 px-3 py-1.5 hover:bg-white/10", children: "Apply" }), (0, jsx_runtime_1.jsx)("a", { href: `/admin/returns/jumia`, className: "rounded border border-white/10 px-3 py-1.5 hover:bg-white/10", children: "Clear" })] }), (0, jsx_runtime_1.jsx)("div", { className: "overflow-x-auto rounded border border-white/10", children: (0, jsx_runtime_1.jsxs)("table", { className: "min-w-full text-sm", children: [(0, jsx_runtime_1.jsx)("thead", { className: "bg-white/5", children: (0, jsx_runtime_1.jsxs)("tr", { children: [(0, jsx_runtime_1.jsx)("th", { className: "text-left px-3 py-2", children: "Order" }), (0, jsx_runtime_1.jsx)("th", { className: "text-left px-3 py-2", children: "Customer" }), (0, jsx_runtime_1.jsx)("th", { className: "text-left px-3 py-2", children: "Status" }), (0, jsx_runtime_1.jsx)("th", { className: "text-left px-3 py-2", children: "Created" }), (0, jsx_runtime_1.jsx)("th", { className: "text-left px-3 py-2", children: "Shop" })] }) }), (0, jsx_runtime_1.jsx)("tbody", { children: items.map((it, i) => ((0, jsx_runtime_1.jsxs)("tr", { className: "border-t border-white/10", children: [(0, jsx_runtime_1.jsx)("td", { className: "px-3 py-2 font-mono", children: it.orderNumber || it.id || it.externalId || `#${i + 1}` }), (0, jsx_runtime_1.jsx)("td", { className: "px-3 py-2", children: it.customerName || it.buyerName || '-' }), (0, jsx_runtime_1.jsx)("td", { className: "px-3 py-2 text-slate-400", children: it.status || '-' }), (0, jsx_runtime_1.jsx)("td", { className: "px-3 py-2", children: it.createdAt || it.created || it.date || '-' }), (0, jsx_runtime_1.jsx)("td", { className: "px-3 py-2", children: it._shop?.name || '-' })] }, i))) })] }) }), (0, jsx_runtime_1.jsxs)("div", { className: "text-xs text-slate-400", children: [token && (0, jsx_runtime_1.jsxs)("span", { className: "mr-2", children: ["token: ", token.slice(0, 6), "\u2026"] }), nextToken && ((0, jsx_runtime_1.jsx)("a", { className: "ml-2 underline", href: `/admin/returns/jumia?${qs({ size, status, token: nextToken, shopId })}`, children: "Next \u2192" }))] })] }));
}
