"use client";

import { useMemo, useState, useEffect } from "react";

type ShopOption = { id: string; name: string };
type EndpointOption = { label: string; path: string };

const DEFAULT_ENDPOINTS: EndpointOption[] = [
  { label: "Orders", path: "/orders" },
  { label: "Order Items", path: "/orders/items" },
  { label: "Print Labels", path: "/orders/print-labels" },
  { label: "Catalog Products", path: "/catalog/products" },
  { label: "Create Feed", path: "/feeds/products/create" },
];

export default function EndpointConsole({ shops: initialShops, endpoints }: { shops?: ShopOption[]; endpoints?: EndpointOption[] }) {
  const [shopId, setShopId] = useState("");
  const [endpoint, setEndpoint] = useState(endpoints?.[0]?.path || DEFAULT_ENDPOINTS[0].path);
  const [method, setMethod] = useState("GET");
  const [queryStr, setQueryStr] = useState("");
  const [payload, setPayload] = useState("{}");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<unknown | null>(null);
  const [shops, setShops] = useState<ShopOption[]>(initialShops ?? []);

  useEffect(() => {
    if (!initialShops) {
      (async () => {
        try {
          const r = await fetch("/api/shops");
          if (!r.ok) return;
          const j = await r.json();
          setShops(j || []);
          if ((j || []).length) setShopId(j[0].id);
        } catch {
          // ignore
        }
      })();
    } else if (initialShops.length) {
      setShopId(initialShops[0].id);
    }
  }, [initialShops]);

  const queryObj = useMemo(() => {
    const out: Record<string, string> = {};
    queryStr
      .split(/\r?\n|&/g)
      .map(s => s.trim())
      .filter(Boolean)
      .forEach(line => {
        const [k, ...rest] = line.split("=");
        if (k) out[k.trim()] = rest.join("=")?.trim() ?? "";
      });
    return out;
  }, [queryStr]);

  function getErrorMessage(e: unknown) {
    if (typeof e === 'string') return e;
    if (e && typeof e === 'object' && 'message' in e) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (e as any).message || String(e);
    }
    return String(e);
  }

  async function run() {
    setBusy(true);
    setResult(null);
    try {
      let json: unknown = undefined;
      if (method !== "GET" && method !== "DELETE" && payload.trim()) {
        try { json = JSON.parse(payload); } catch { throw new Error("Invalid JSON payload"); }
      }

      const res = await fetch("/api/jumia/console", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shopId: shopId || undefined, path: endpoint, method, query: queryObj, json }),
      });
      const j = await res.json();
      setResult(j as unknown);
    } catch (e: unknown) {
      setResult({ ok: false, error: getErrorMessage(e) } as unknown);
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setQueryStr("");
    setPayload("{}");
    setResult(null);
  }

  const badge = (source?: string) =>
    source === "SHOP" ? (
      <span className="ml-2 text-xs rounded-full px-2 py-0.5 bg-emerald-500/20 text-emerald-300">Using SHOP creds</span>
    ) : source === "ENV" ? (
      <span className="ml-2 text-xs rounded-full px-2 py-0.5 bg-yellow-500/20 text-yellow-300">Using ENV fallback</span>
    ) : null;

  const endpointList = endpoints ?? DEFAULT_ENDPOINTS;
  type ResultWithMeta = { _meta?: { authSource?: string; platform?: string; baseUrl?: string; path?: string }; status?: number };
  const meta = (result as unknown as ResultWithMeta | null)?._meta;
  const httpStatus = (result as unknown as ResultWithMeta | null)?.status;

  return (
    <div className="space-y-3">
      <div className="grid lg:grid-cols-4 gap-3">
        <select value={shopId} onChange={e=>setShopId(e.target.value)} className="border p-2">
          <option value="">{`-- select shop --`}</option>
          {shops.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>

        <select value={endpoint} onChange={e=>setEndpoint(e.target.value)} className="border p-2">
          {endpointList.map(ep => <option key={ep.path} value={ep.path}>{`${ep.label} — ${ep.path}`}</option>)}
        </select>

        <select value={method} onChange={e=>setMethod(e.target.value)} className="border p-2">
          {["GET","POST","PUT","DELETE"].map(m => <option key={m}>{m}</option>)}
        </select>

        <div className="flex gap-2">
          <button onClick={run} disabled={busy} className="px-3 py-2 bg-blue-600 text-white rounded">Run</button>
          <button onClick={reset} className="px-3 py-2 rounded border">Reset</button>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm mb-1">Query (key=value per line or &)</label>
          <textarea value={queryStr} onChange={e=>setQueryStr(e.target.value)} rows={8} className="w-full border p-2 font-mono text-sm" />
        </div>
        <div>
          <label className="block text-sm mb-1">JSON payload (optional)</label>
          <textarea value={payload} onChange={e=>setPayload(e.target.value)} rows={8} className="w-full border p-2 font-mono text-sm" />
        </div>
      </div>

      <div>
        <label className="block text-sm mb-1">Result</label>
        <div className="rounded bg-black/40 text-slate-200 p-3 font-mono text-sm overflow-auto">
          {meta && (
            <div className="mb-2">
              <div className="flex items-center gap-2">
                <span>Auth Source: <strong>{meta.authSource}</strong></span>
                {badge(meta.authSource)}
              </div>
              <div className="opacity-75">
                Platform: {meta.platform} • Base: {meta.baseUrl} • Path: {meta.path}
              </div>
              {httpStatus && <div className="opacity-75">HTTP Status: {httpStatus}</div>}
            </div>
          )}
          <pre className="whitespace-pre-wrap break-words">
            {JSON.stringify(result ?? { "No result yet": true }, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}
