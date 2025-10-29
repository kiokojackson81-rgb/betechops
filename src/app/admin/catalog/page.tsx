export const dynamic = "force-dynamic";

import { getCatalogCategories, getCatalogProducts, jumiaFetch, loadDefaultShopAuth, jumiaPaginator } from "@/lib/jumia";

export default async function CatalogPage({
  searchParams,
}: {
  searchParams?: Promise<{ token?: string; size?: string; sellerSku?: string; categoryCode?: string; status?: string }>;
}) {
  const sp = (await searchParams) || {};

  // Small helper to bound long vendor calls so the page never hangs
  const withTimeout = async <T,>(p: Promise<T>, ms = 8000, fallback: T | (() => T) = (undefined as unknown as T)): Promise<T> => {
    return await Promise.race<Promise<T>>([
      p,
      new Promise<T>((resolve) => setTimeout(() => resolve(typeof fallback === 'function' ? (fallback as any)() : fallback), ms)),
    ]);
  };
  const size = Math.min(100, Math.max(1, Number(sp.size || 20)));
  const sellerSku = (sp.sellerSku || "").trim() || undefined;
  const categoryCode = sp.categoryCode ? Number(sp.categoryCode) : undefined;
  const token = (sp.token || "").trim() || undefined;
  const statusFilter = (sp.status || "").trim().toLowerCase() || undefined;

  const [cats, prods] = await Promise.all([
    withTimeout(getCatalogCategories(1), 8000, {} as any),
    withTimeout(getCatalogProducts({ size, token, sellerSku, categoryCode }), 8000, {} as any),
  ]).catch(() => [{}, {}] as any);

  const categories = Array.isArray((cats as any)?.items) ? (cats as any).items : Array.isArray((cats as any)?.data) ? (cats as any).data : [];
  const rawProducts = Array.isArray((prods as any)?.items) ? (prods as any).items : Array.isArray((prods as any)?.data) ? (prods as any).data : [];

  const nextToken = String((prods as any)?.nextToken ?? (prods as any)?.token ?? (prods as any)?.next ?? "");
  const products = statusFilter
    ? rawProducts.filter((p: any) => String(p.status || p.itemStatus || "").toLowerCase().includes(statusFilter))
    : rawProducts;

  // Compute summary counters (limited scan for performance)
  const limit = Math.min(500, size * 5);
  let total = 0; const byStatus: Record<string, number> = {};
  try {
    const start = Date.now();
    const shopAuth = await loadDefaultShopAuth();
    let scanned = 0; let pages = 0;
    const fetcher = async (p: string) => await withTimeout(
      jumiaFetch(p, shopAuth ? ({ shopAuth } as any) : ({} as any)),
      8000,
      {} as any
    );
    for await (const page of jumiaPaginator('/catalog/products', { size: String(size), ...(token ? { token } : {}) }, fetcher)) {
      const arr = Array.isArray((page as any)?.items) ? (page as any).items : Array.isArray((page as any)?.data) ? (page as any).data : [];
      for (const it of arr) {
        total += 1; scanned += 1;
        const st = String((it as any).status || (it as any).itemStatus || 'unknown').toLowerCase();
        byStatus[st] = (byStatus[st] || 0) + 1;
        if (scanned >= limit) break;
      }
      pages += 1;
      // stop after a few pages or if time exceeded to avoid hanging render
      if (scanned >= limit || pages >= 3 || (Date.now() - start) > 15000) break;
    }
  } catch {}

  const active = (byStatus['active'] || 0);
  const inactive = (byStatus['disabled'] || 0) + (byStatus['inactive'] || 0) + (byStatus['blocked'] || 0);

  const qs = (params: Record<string, string | number | undefined>) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") q.set(k, String(v));
    return q.toString();
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Catalog</h1>

      {/* Filters */}
      <form className="flex flex-wrap gap-2 items-end">
        <div>
          <label className="block text-xs mb-1">Seller SKU</label>
          <input name="sellerSku" defaultValue={sellerSku || ""} className="rounded bg-white/5 border border-white/10 px-3 py-1.5" />
        </div>
        <div>
          <label className="block text-xs mb-1">Category Code</label>
          <input name="categoryCode" defaultValue={categoryCode ? String(categoryCode) : ""} className="rounded bg-white/5 border border-white/10 px-3 py-1.5" />
        </div>
        <div>
          <label className="block text-xs mb-1">Status</label>
          <input name="status" placeholder="e.g., active, disabled" defaultValue={sp.status || ""} className="rounded bg-white/5 border border-white/10 px-3 py-1.5" />
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
        <a href={`/admin/catalog`} className="rounded border border-white/10 px-3 py-1.5 hover:bg-white/10">Clear</a>
      </form>

      <section>
        <h2 className="text-lg font-medium mb-2">Categories</h2>
        {categories.length === 0 ? (
          <p className="text-slate-400">No categories found.</p>
        ) : (
          <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {categories.slice(0, 12).map((c: any, i: number) => (
              <li key={i} className="p-3 rounded border border-white/10 bg-white/5">
                <div className="font-medium">{c.name || c.categoryName || c.title || `Category ${i+1}`}</div>
                {c.code && <div className="text-xs text-slate-400">Code: {String(c.code)}</div>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        {/* Summary */}
        <div className="mb-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-lg border border-white/10 bg-white/5 p-3"><div className="text-xs text-slate-400">Total scanned</div><div className="text-xl font-semibold">{total}</div></div>
          <div className="rounded-lg border border-white/10 bg-white/5 p-3"><div className="text-xs text-slate-400">Active</div><div className="text-xl font-semibold">{active}</div></div>
          <div className="rounded-lg border border-white/10 bg-white/5 p-3"><div className="text-xs text-slate-400">Inactive</div><div className="text-xl font-semibold">{inactive}</div></div>
          <div className="rounded-lg border border-white/10 bg-white/5 p-3"><div className="text-xs text-slate-400">Statuses</div><div className="text-sm">{Object.entries(byStatus).map(([k,v]) => <span key={k} className="mr-2">{k}:{v}</span>)}</div></div>
        </div>

        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-medium">Products</h2>
          <div className="text-xs text-slate-400">
            {token && <span className="mr-2">token: {token.slice(0, 6)}…</span>}
            {nextToken && (
              <a
                className="ml-2 underline"
                href={`/admin/catalog?${qs({ sellerSku, categoryCode, size, status: sp.status, token: nextToken })}`}
              >Next →</a>
            )}
          </div>
        </div>
        {products.length === 0 ? (
          <p className="text-slate-400">No products found.</p>
        ) : (
          <div className="overflow-x-auto rounded border border-white/10">
            <table className="min-w-full text-sm">
              <thead className="bg-white/5">
                <tr>
                  <th className="text-left px-3 py-2">SKU</th>
                  <th className="text-left px-3 py-2">Name</th>
                  <th className="text-left px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p: any, i: number) => (
                  <tr key={i} className="border-t border-white/10">
                    <td className="px-3 py-2 font-mono">{p.sellerSku || p.sku || p.sid || p.id || `SKU-${i+1}`}</td>
                    <td className="px-3 py-2">{p.name || p.title || p.productName || '-'}</td>
                    <td className="px-3 py-2 text-slate-400">{p.status || p.itemStatus || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
