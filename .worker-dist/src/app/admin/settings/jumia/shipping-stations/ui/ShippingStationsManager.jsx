"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = ShippingStationsManager;
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
    return (<div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-end gap-3">
        <div>
          <label className="block text-xs opacity-70 mb-1">Shop</label>
          <select className="px-3 py-2 rounded bg-black/20 border border-white/10 min-w-[16rem]" value={shopId} onChange={(e) => setShopId(e.target.value)}>
            {shops.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-xs opacity-70 mb-1">Default station (providerId)</label>
          <div className="flex gap-2">
            <input className="px-3 py-2 rounded bg-black/20 border border-white/10 w-full" value={providerId} onChange={(e) => setProviderId(e.target.value)} placeholder="Paste or pick from discovery below"/>
            <button className="px-3 py-2 rounded border border-white/10 hover:bg-white/10 disabled:opacity-50" onClick={saveDefault} disabled={!shopId || !providerId || !!busy}>{busy === 'save' ? 'Saving…' : 'Save'}</button>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-[var(--panel,#121723)] p-3">
        <div className="flex flex-col md:flex-row md:items-end gap-3">
          <div>
            <label className="block text-xs opacity-70 mb-1">Example order number</label>
            <input className="px-3 py-2 rounded bg-black/20 border border-white/10 min-w-[18rem]" value={orderId} onChange={(e) => setOrderId(e.target.value)} placeholder="Enter a recent order number"/>
          </div>
          <button className="px-3 py-2 rounded border border-white/10 hover:bg-white/10 disabled:opacity-50" onClick={discoverProviders} disabled={!shopId || !orderId || !!busy}>{busy === 'discover' ? 'Discovering…' : 'Discover providers'}</button>
        </div>

        {providers.length > 0 ? (<div className="mt-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {providers.map((p) => (<div key={String(p?.id ?? p?.providerId)} className="p-3 rounded border border-white/10 bg-black/10">
                <div className="font-medium">{String(p?.name || p?.label || p?.id)}</div>
                <div className="text-xs opacity-70 break-all">{String(p?.id ?? p?.providerId)}</div>
                {p?.requiredTrackingCode && <div className="text-xs mt-1 text-amber-400">Requires tracking code</div>}
                <button className="mt-2 px-3 py-1 rounded border border-white/10 hover:bg-white/10" onClick={() => applyProvider(p)}>Use as default</button>
              </div>))}
          </div>) : (<div className="mt-3 text-sm opacity-70">No providers loaded. Enter an order number and click Discover.</div>)}
      </div>
    </div>);
}
