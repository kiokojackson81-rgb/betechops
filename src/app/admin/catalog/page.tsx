export const dynamic = "force-dynamic";

import { getCatalogCategories, getCatalogProducts } from "@/lib/jumia";

export default async function CatalogPage() {
  const [cats, prods] = await Promise.all([
    getCatalogCategories(1),
    getCatalogProducts({ size: 20 }),
  ]).catch(() => [{}, {}] as any);

  const categories = Array.isArray((cats as any)?.items) ? (cats as any).items : Array.isArray((cats as any)?.data) ? (cats as any).data : [];
  const products = Array.isArray((prods as any)?.items) ? (prods as any).items : Array.isArray((prods as any)?.data) ? (prods as any).data : [];

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Catalog</h1>

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
        <h2 className="text-lg font-medium mb-2">Products</h2>
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
                {products.slice(0, 20).map((p: any, i: number) => (
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
