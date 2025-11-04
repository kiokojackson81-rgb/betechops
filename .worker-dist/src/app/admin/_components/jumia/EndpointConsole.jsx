"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = EndpointConsole;
const react_1 = require("react");
const DEFAULT_ENDPOINTS = [
    { label: "Orders", path: "/orders" },
    { label: "Order Items", path: "/orders/items" },
    { label: "Print Labels", path: "/orders/print-labels" },
    { label: "Catalog Products", path: "/catalog/products" },
    { label: "Create Feed", path: "/feeds/products/create" },
];
function EndpointConsole({ shops: initialShops, endpoints }) {
    const [shopId, setShopId] = (0, react_1.useState)("");
    // Default to Catalog Products endpoint
    const [endpoint, setEndpoint] = (0, react_1.useState)(endpoints?.[0]?.path || "/catalog/products");
    const [method, setMethod] = (0, react_1.useState)("GET");
    const [queryStr, setQueryStr] = (0, react_1.useState)("size=5");
    const [payload, setPayload] = (0, react_1.useState)("{}");
    const [busy, setBusy] = (0, react_1.useState)(false);
    const [result, setResult] = (0, react_1.useState)(null);
    const [shops, setShops] = (0, react_1.useState)(initialShops ?? []);
    const [totalHint, setTotalHint] = (0, react_1.useState)(null);
    (0, react_1.useEffect)(() => {
        if (!initialShops) {
            (async () => {
                try {
                    const r = await fetch("/api/shops");
                    if (!r.ok)
                        return;
                    const j = await r.json();
                    setShops(j || []);
                    if ((j || []).length)
                        setShopId(j[0].id);
                }
                catch {
                    // ignore
                }
            })();
        }
        else if (initialShops.length) {
            setShopId(initialShops[0].id);
        }
    }, [initialShops]);
    const queryObj = (0, react_1.useMemo)(() => {
        const out = {};
        queryStr
            .split(/\r?\n|&/g)
            .map(s => s.trim())
            .filter(Boolean)
            .forEach(line => {
            const [k, ...rest] = line.split("=");
            if (k)
                out[k.trim()] = rest.join("=")?.trim() ?? "";
        });
        return out;
    }, [queryStr]);
    function getErrorMessage(e) {
        if (typeof e === 'string')
            return e;
        if (e && typeof e === 'object' && 'message' in e) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return e.message || String(e);
        }
        return String(e);
    }
    async function run() {
        setBusy(true);
        setResult(null);
        setTotalHint(null);
        try {
            let json = undefined;
            if (method !== "GET" && method !== "DELETE" && payload.trim()) {
                try {
                    json = JSON.parse(payload);
                }
                catch {
                    throw new Error("Invalid JSON payload");
                }
            }
            const res = await fetch("/api/jumia/console", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ shopId: shopId || undefined, path: endpoint, method, query: queryObj, json }),
            });
            const j = await res.json();
            // try to hint total from the response
            try {
                const data = j?.data;
                const t = (data && typeof data === 'object' && (data.total || data.totalCount || data.totalElements))
                    || (Array.isArray(data?.products) ? data.products.length : null);
                if (typeof t === 'number')
                    setTotalHint(Number(t));
            }
            catch { }
            setResult(j);
        }
        catch (e) {
            setResult({ ok: false, error: getErrorMessage(e) });
        }
        finally {
            setBusy(false);
        }
    }
    function reset() {
        setQueryStr("");
        setPayload("{}");
        setResult(null);
    }
    const badge = (source) => source === "SHOP" ? (<span className="ml-2 text-xs rounded-full px-2 py-0.5 bg-emerald-500/20 text-emerald-300">Using SHOP creds</span>) : source === "ENV" ? (<span className="ml-2 text-xs rounded-full px-2 py-0.5 bg-yellow-500/20 text-yellow-300">Using ENV fallback</span>) : null;
    const endpointList = endpoints ?? DEFAULT_ENDPOINTS;
    const meta = result?._meta;
    const httpStatus = result?.status;
    // When shop changes, default query to include shopId and size=5 and auto-run
    (0, react_1.useEffect)(() => {
        if (!shopId)
            return;
        const parts = new URLSearchParams(queryStr.replace(/\n/g, '&'));
        parts.set('shopId', shopId);
        if (!parts.get('size'))
            parts.set('size', '5');
        const qs = Array.from(parts.entries()).map(([k, v]) => `${k}=${v}`).join('&');
        setQueryStr(qs);
        // Auto-run when on catalog products
        if (endpoint === '/catalog/products') {
            run();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [shopId]);
    return (<div className="space-y-3">
      <div className="grid lg:grid-cols-4 gap-3">
        <select value={shopId} onChange={e => setShopId(e.target.value)} className="border p-2">
          <option value="">{`-- select shop --`}</option>
          {shops.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>

        <select value={endpoint} onChange={e => setEndpoint(e.target.value)} className="border p-2">
          {endpointList.map(ep => <option key={ep.path} value={ep.path}>{`${ep.label} — ${ep.path}`}</option>)}
        </select>

        <select value={method} onChange={e => setMethod(e.target.value)} className="border p-2">
          {["GET", "POST", "PUT", "DELETE"].map(m => <option key={m}>{m}</option>)}
        </select>

        <div className="flex gap-2">
          <button onClick={run} disabled={busy} className="px-3 py-2 bg-blue-600 text-white rounded">Run</button>
          <button onClick={reset} className="px-3 py-2 rounded border">Reset</button>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm mb-1">Query (key=value per line or &)</label>
          <textarea value={queryStr} onChange={e => setQueryStr(e.target.value)} rows={8} className="w-full border p-2 font-mono text-sm"/>
        </div>
        <div>
          <label className="block text-sm mb-1">JSON payload (optional)</label>
          <textarea value={payload} onChange={e => setPayload(e.target.value)} rows={8} className="w-full border p-2 font-mono text-sm"/>
        </div>
      </div>

      <div>
        <label className="block text-sm mb-1">Result</label>
        <div className="rounded bg-black/40 text-slate-200 p-3 font-mono text-sm overflow-auto">
          {meta && (<div className="mb-2">
              <div className="flex items-center gap-2">
                <span>Auth Source: <strong>{meta.authSource}</strong></span>
                {badge(meta.authSource)}
              </div>
              <div className="opacity-75">
                Platform: {meta.platform} • Base: {meta.baseUrl} • Path: {meta.path}
              </div>
              {httpStatus && <div className="opacity-75">HTTP Status: {httpStatus}</div>}
              {totalHint !== null && <div className="opacity-75">Total Count: {totalHint}</div>}
            </div>)}
          <pre className="whitespace-pre-wrap break-words">
            {JSON.stringify(result ?? { "No result yet": true }, null, 2)}
          </pre>
        </div>
      </div>
    </div>);
}
