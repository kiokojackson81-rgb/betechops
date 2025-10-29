export const dynamic = "force-dynamic";

import { jumiaFetch, loadDefaultShopAuth } from "@/lib/jumia";

async function fetchReturns({ token, size, status }: { token?: string; size?: number; status?: string }) {
  const qs = new URLSearchParams();
  if (token) qs.set("token", token);
  if (size) qs.set("size", String(size));
  if (status) qs.set("status", status);
  const q = qs.toString() ? `?${qs.toString()}` : "";

  const shopAuth = await loadDefaultShopAuth();
  // Try /returns first; fallback to /orders?status=RETURNED
  try {
    const j: any = await jumiaFetch(`/returns${q}`, shopAuth ? ({ shopAuth } as any) : ({} as any));
    const items = Array.isArray(j?.items) ? j.items : Array.isArray(j?.data) ? j.data : j?.returns || [];
    const nextToken = String(j?.nextToken ?? j?.token ?? j?.next ?? "");
    return { items, nextToken, pathUsed: "/returns" };
  } catch {
    const status2 = status || "RETURNED";
    const join = q ? `${q}&status=${encodeURIComponent(status2)}` : `?status=${encodeURIComponent(status2)}`;
    const j: any = await jumiaFetch(`/orders${join}`, shopAuth ? ({ shopAuth } as any) : ({} as any));
    const items = Array.isArray(j?.orders) ? j.orders : Array.isArray(j?.items) ? j.items : Array.isArray(j?.data) ? j.data : [];
    const nextToken = String(j?.nextToken ?? j?.token ?? j?.next ?? "");
    return { items, nextToken, pathUsed: "/orders" };
  }
}

export default async function JumiaReturnsPage({
  searchParams,
}: {
  searchParams?: Promise<{ token?: string; size?: string; status?: string }>;
}) {
  const sp = (await searchParams) || {};
  const size = Math.min(100, Math.max(1, Number(sp.size || 20)));
  const token = (sp.token || "").trim() || undefined;
  const status = (sp.status || "").trim() || undefined;

  const { items, nextToken, pathUsed } = await fetchReturns({ token, size, status });

  const qs = (params: Record<string, string | number | undefined>) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") q.set(k, String(v));
    return q.toString();
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Jumia Returns</h1>
        <div className="text-xs text-slate-400">source: {pathUsed}</div>
      </div>

      <form className="flex flex-wrap gap-2 items-end">
        <div>
          <label className="block text-xs mb-1">Status</label>
          <input name="status" placeholder="RETURNED or waiting-pickup" defaultValue={sp.status || ""} className="rounded bg-white/5 border border-white/10 px-3 py-1.5" />
        </div>
        <div>
          <label className="block text-xs mb-1">Page Size</label>
          <select name="size" defaultValue={String(size)} className="rounded bg-white/5 border border-white/10 px-2 py-1.5">
            {[20, 50, 100].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
        <button className="rounded border border-white/10 px-3 py-1.5 hover:bg-white/10">Apply</button>
        <a href={`/admin/returns/jumia`} className="rounded border border-white/10 px-3 py-1.5 hover:bg-white/10">Clear</a>
      </form>

      <div className="overflow-x-auto rounded border border-white/10">
        <table className="min-w-full text-sm">
          <thead className="bg-white/5">
            <tr>
              <th className="text-left px-3 py-2">Order</th>
              <th className="text-left px-3 py-2">Customer</th>
              <th className="text-left px-3 py-2">Status</th>
              <th className="text-left px-3 py-2">Created</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it: any, i: number) => (
              <tr key={i} className="border-t border-white/10">
                <td className="px-3 py-2 font-mono">{it.orderNumber || it.id || it.externalId || `#${i+1}`}</td>
                <td className="px-3 py-2">{it.customerName || it.buyerName || '-'}</td>
                <td className="px-3 py-2 text-slate-400">{it.status || '-'}</td>
                <td className="px-3 py-2">{it.createdAt || it.created || it.date || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="text-xs text-slate-400">
        {token && <span className="mr-2">token: {token.slice(0, 6)}…</span>}
        {nextToken && (
          <a
            className="ml-2 underline"
            href={`/admin/returns/jumia?${qs({ size, status, token: nextToken })}`}
          >Next →</a>
        )}
      </div>
    </div>
  );
}
