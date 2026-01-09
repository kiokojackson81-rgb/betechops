"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = ShippingStationsManager;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
function ShippingStationsManager({ shops }) {
    const [shopId, setShopId] = (0, react_1.useState)(shops[0]?.id || '');
    const [providerId, setProviderId] = (0, react_1.useState)('');
    const [orderId, setOrderId] = (0, react_1.useState)('');
    const [providers, setProviders] = (0, react_1.useState)([]);
    const [busy, setBusy] = (0, react_1.useState)(null);
    (0, react_1.useEffect)(() => {
        let cancelled = false;
        async function loadDefaults() {
            try {
                const res = await fetch('/api/settings/jumia/shipping-defaults', { cache: 'no-store' });
                if (!res.ok)
                    return;
                const j = await res.json();
                const d = j?.defaults || {};
                if (!cancelled)
                    setProviderId(d?.[shopId]?.providerId || '');
            }
            catch { }
        }
        if (shopId)
            void loadDefaults();
        return () => { cancelled = true; };
    }, [shopId]);
    async function saveDefault() {
        if (!shopId || !providerId)
            return;
        setBusy('save');
        try {
            await fetch('/api/settings/jumia/shipping-defaults', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ shopId, providerId }),
            });
        }
        finally {
            setBusy(null);
        }
    }
    async function discoverProviders() {
        if (!shopId || !orderId)
            return;
        setBusy('discover');
        try {
            // fetch items for the order
            const itemsRes = await fetch(`/api/jumia/orders/${encodeURIComponent(orderId)}/items?shopId=${encodeURIComponent(shopId)}`, { cache: 'no-store' });
            const itemsJson = itemsRes.ok ? await itemsRes.json() : { items: [] };
            const items = Array.isArray(itemsJson?.items) ? itemsJson.items : [];
            const first = items[0];
            if (!first?.id) {
                setProviders([]);
                return;
            }
            // fetch providers for first item
            const provRes = await fetch('/api/jumia/providers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ shopId, orderItemIds: [first.id] }),
            });
            const provJson = provRes.ok ? await provRes.json() : {};
            const list = Array.isArray(provJson?.providers) ? provJson.providers : [];
            setProviders(list);
        }
        finally {
            setBusy(null);
        }
    }
    function applyProvider(p) {
        const id = p?.id || p?.providerId || '';
        if (id)
            setProviderId(String(id));
    }
    return ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col md:flex-row md:items-end gap-3", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "block text-xs opacity-70 mb-1", children: "Shop" }), (0, jsx_runtime_1.jsx)("select", { className: "px-3 py-2 rounded bg-black/20 border border-white/10 min-w-[16rem]", value: shopId, onChange: (e) => setShopId(e.target.value), children: shops.map((s) => ((0, jsx_runtime_1.jsx)("option", { value: s.id, children: s.name }, s.id))) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex-1", children: [(0, jsx_runtime_1.jsx)("label", { className: "block text-xs opacity-70 mb-1", children: "Default station (providerId)" }), (0, jsx_runtime_1.jsxs)("div", { className: "flex gap-2", children: [(0, jsx_runtime_1.jsx)("input", { className: "px-3 py-2 rounded bg-black/20 border border-white/10 w-full", value: providerId, onChange: (e) => setProviderId(e.target.value), placeholder: "Paste or pick from discovery below" }), (0, jsx_runtime_1.jsx)("button", { className: "px-3 py-2 rounded border border-white/10 hover:bg-white/10 disabled:opacity-50", onClick: saveDefault, disabled: !shopId || !providerId || !!busy, children: busy === 'save' ? 'Saving…' : 'Save' })] })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "rounded-xl border border-white/10 bg-[var(--panel,#121723)] p-3", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col md:flex-row md:items-end gap-3", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "block text-xs opacity-70 mb-1", children: "Example order number" }), (0, jsx_runtime_1.jsx)("input", { className: "px-3 py-2 rounded bg-black/20 border border-white/10 min-w-[18rem]", value: orderId, onChange: (e) => setOrderId(e.target.value), placeholder: "Enter a recent order number" })] }), (0, jsx_runtime_1.jsx)("button", { className: "px-3 py-2 rounded border border-white/10 hover:bg-white/10 disabled:opacity-50", onClick: discoverProviders, disabled: !shopId || !orderId || !!busy, children: busy === 'discover' ? 'Discovering…' : 'Discover providers' })] }), providers.length > 0 ? ((0, jsx_runtime_1.jsx)("div", { className: "mt-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3", children: providers.map((p) => ((0, jsx_runtime_1.jsxs)("div", { className: "p-3 rounded border border-white/10 bg-black/10", children: [(0, jsx_runtime_1.jsx)("div", { className: "font-medium", children: String(p?.name || p?.label || p?.id) }), (0, jsx_runtime_1.jsx)("div", { className: "text-xs opacity-70 break-all", children: String(p?.id ?? p?.providerId) }), p?.requiredTrackingCode && (0, jsx_runtime_1.jsx)("div", { className: "text-xs mt-1 text-amber-400", children: "Requires tracking code" }), (0, jsx_runtime_1.jsx)("button", { className: "mt-2 px-3 py-1 rounded border border-white/10 hover:bg-white/10", onClick: () => applyProvider(p), children: "Use as default" })] }, String(p?.id ?? p?.providerId)))) })) : ((0, jsx_runtime_1.jsx)("div", { className: "mt-3 text-sm opacity-70", children: "No providers loaded. Enter an order number and click Discover." }))] })] }));
}
