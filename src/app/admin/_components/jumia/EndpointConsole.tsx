"use client";
import React, { useEffect, useState } from "react";

type Shop = { id: string; name: string };
type EndpointDef = { id: string; label: string; method: 'GET'|'POST'|'PUT'|'PATCH'|'DELETE'; path: string; description?: string };

const ENDPOINTS: EndpointDef[] = [
  { id: "orders", label: "Orders", method: "GET", path: "/orders", description: "List orders" },
  { id: "order-items", label: "Order Items", method: "GET", path: "/orders/items", description: "Get order items" },
  { id: "print-labels", label: "Print Labels", method: "POST", path: "/orders/print-labels", description: "Print labels (returns base64)" },
  { id: "catalog-products", label: "Catalog Products", method: "GET", path: "/catalog/products", description: "Search products" },
  { id: "feeds-create", label: "Feeds Create", method: "POST", path: "/feeds/products/create", description: "Create feed" },
  { id: "consignment-stock", label: "Consignment Stock", method: "GET", path: "/consignment-stock", description: "Check consignment stock" },
  { id: "payout-statement", label: "Payout Statement", method: "GET", path: "/payout-statement", description: "Payouts" },
];

export default function EndpointConsole() {
  const [shops, setShops] = useState<Shop[]>([]);
  const [shopId, setShopId] = useState<string | null>(null);
  const [endpoint, setEndpoint] = useState<EndpointDef>(ENDPOINTS[0]);
  const [query, setQuery] = useState<string>("");
  const [payload, setPayload] = useState<string>("{}");
  const [result, setResult] = useState<unknown | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/shops');
        if (!r.ok) return;
        const j = (await r.json()) as Shop[];
        setShops(j || []);
        if (j && j.length) setShopId(j[0].id);
      } catch (e) {
        // ignore network errors for console
      }
    })();
  }, []);

  async function run() {
    if (!shopId) return setResult({ error: 'Select a shop' });
    setLoading(true); setResult(null);
    try {
      const qObj: Record<string, string> = {};
      if (query.trim()) {
        // parse simple key=value pairs separated by & or newlines
        const parts = query.split(/[&\n]/).map(s => s.trim()).filter(Boolean);
        for (const p of parts) {
          const [k,v] = p.split('=').map(s=>s.trim()); if (k) qObj[k]=v||'';
        }
      }

      let parsedPayload: unknown = undefined;
      if (payload && payload.trim()) {
        try { parsedPayload = JSON.parse(payload); } catch (e) { return setResult({ error: 'Invalid JSON payload' }); }
      }

      const res = await fetch('/api/jumia/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shopId, method: endpoint.method, path: endpoint.path, query: qObj, payload: parsedPayload }),
      });
      const j = await res.json();
      setResult(j as unknown);
    } catch (err) {
      setResult({ error: (err as Error)?.message || String(err) });
    } finally { setLoading(false); }
  }

  return (
    <div className="rounded-xl border border-white/10 bg-[#23272f] p-4">
      <h2 className="text-lg font-semibold mb-3">Jumia Endpoint Console</h2>
      <div className="grid md:grid-cols-3 gap-3">
        <div>
          <label className="block text-sm text-slate-300">Shop</label>
          <select value={shopId || ''} onChange={(e)=>setShopId(e.target.value)} className="w-full p-2 border">
            <option value="">-- select shop --</option>
            {shops.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm text-slate-300">Endpoint</label>
          <select value={endpoint.id} onChange={(e)=>setEndpoint(ENDPOINTS.find(en=>en.id===e.target.value) || ENDPOINTS[0])} className="w-full p-2 border">
            {ENDPOINTS.map(en => <option key={en.id} value={en.id}>{en.label} — {en.path}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm text-slate-300">Method</label>
          <input value={endpoint.method} readOnly className="w-full p-2 border bg-white/5" />
        </div>
      </div>

      <div className="mt-3 grid md:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm text-slate-300">Query (key=value per line or &amp;)</label>
          <textarea value={query} onChange={(e)=>setQuery(e.target.value)} rows={4} className="w-full p-2 border bg-white/5" />
        </div>
        <div>
          <label className="block text-sm text-slate-300">JSON payload (optional)</label>
          <textarea value={payload} onChange={(e)=>setPayload(e.target.value)} rows={4} className="w-full p-2 border bg-white/5" />
        </div>
      </div>

      <div className="mt-3 flex gap-2">
        <button onClick={run} disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded">{loading ? 'Running…' : 'Run'}</button>
        <button onClick={()=>{ setQuery(''); setPayload('{}'); setResult(null); }} className="px-4 py-2 border rounded">Reset</button>
      </div>

      <div className="mt-4">
        <h3 className="text-sm text-slate-300 mb-2">Result</h3>
        <div className="rounded-md bg-black/60 p-3 max-h-[420px] overflow-auto text-xs">
          <pre className="whitespace-pre-wrap break-words">{result ? JSON.stringify(result, null, 2) : 'No result yet'}</pre>
        </div>
      </div>
    </div>
  );
}
