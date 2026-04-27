"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { showToast } from "@/lib/ui/toast";

type PosProduct = {
  id: string;
  sku: string;
  name: string;
  category: string;
  sellingPrice: number;
  lastBuyingPrice?: number | null;
  isActive: boolean;
  commissionEnabled: boolean;
  commissionAmount?: number | string | null;
  commissionRequiresApproval: boolean;
};

type ProductDraft = {
  id?: string;
  name: string;
  sellingPrice: string;
};

const emptyDraft: ProductDraft = {
  name: "",
  sellingPrice: "",
};

const fieldClass =
  "w-full rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-400/60 focus:outline-none";

function formatMoney(value: number | string | null | undefined) {
  const amount = Number(value ?? 0);
  return `KES ${Number.isFinite(amount) ? amount.toLocaleString("en-KE", { maximumFractionDigits: 0 }) : "0"}`;
}

export default function BrendahProductDesk() {
  const [products, setProducts] = useState<PosProduct[]>([]);
  const [draft, setDraft] = useState<ProductDraft>(emptyDraft);
  const [query, setQuery] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const formRef = useRef<HTMLElement | null>(null);
  const nameInputRef = useRef<HTMLInputElement | null>(null);

  const loadProducts = useCallback(async (productQuery = query) => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/attendant/pos-products?q=${encodeURIComponent(productQuery)}&includeInactive=${showInactive ? "1" : "0"}&limit=200`,
        { cache: "no-store" },
      );
      const json = await res.json().catch(() => ({ items: [] }));
      if (!res.ok) throw new Error(json?.error || "Failed to load products");
      setProducts(Array.isArray(json.items) ? json.items : []);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to load products", "error");
    } finally {
      setLoading(false);
    }
  }, [query, showInactive]);

  useEffect(() => {
    void loadProducts("");
  }, [loadProducts]);

  useEffect(() => {
    const handle = setTimeout(() => {
      void loadProducts(query);
    }, 250);
    return () => clearTimeout(handle);
  }, [loadProducts, query]);

  useEffect(() => {
    if (!draft.id) return;
    nameInputRef.current?.focus();
    nameInputRef.current?.select();
  }, [draft.id]);

  const activeCount = useMemo(
    () => products.filter((product) => product.isActive).length,
    [products],
  );

  const submitDraft = async () => {
    if (!draft.name.trim()) return showToast("Product name is required", "error");
    if (!draft.sellingPrice.trim()) return showToast("Selling price is required", "error");

    setSaving(true);
    try {
      const payload = {
        name: draft.name.trim(),
        sellingPrice: Number(draft.sellingPrice || 0),
      };
      const res = await fetch(
        draft.id ? `/api/attendant/pos-products/${draft.id}` : "/api/attendant/pos-products",
        {
          method: draft.id ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Failed to save product");
      showToast(draft.id ? "Product updated" : "Product created", "success");
      setDraft(emptyDraft);
      await loadProducts(query);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to save product", "error");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (product: PosProduct) => {
    setDraft({
      id: product.id,
      name: product.name,
      sellingPrice: String(product.sellingPrice ?? ""),
    });
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    showToast(`Editing ${product.name}`, "success");
  };

  const deleteProduct = async (product: PosProduct) => {
    const confirmed = window.confirm(
      `Delete "${product.name}"? Historical POS receipts will stay unchanged and linked products will be archived.`,
    );
    if (!confirmed) return;

    setDeletingId(product.id);
    try {
      const res = await fetch(`/api/attendant/pos-products/${product.id}`, {
        method: "DELETE",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Failed to delete product");
      if (draft.id === product.id) setDraft(emptyDraft);
      showToast(json?.message || "Product deleted", "success");
      await loadProducts(query);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to delete product", "error");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <section
        ref={formRef}
        className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-xl shadow-black/40"
      >
        <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Product Desk</p>
                <h2 className="text-2xl font-semibold text-white">
                  {draft.id ? "Edit product" : "Create product"}
                </h2>
                <p className="mt-2 max-w-2xl text-sm text-slate-400">
                  Add the product name and selling price here. Admin will complete buying price and commission later.
                </p>
              </div>
              {draft.id ? (
                <button
                  type="button"
                  className="rounded-xl border border-white/10 px-3 py-2 text-sm text-slate-200 hover:bg-white/5"
                  onClick={() => setDraft(emptyDraft)}
                >
                  Reset
                </button>
              ) : null}
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="text-sm text-slate-300 md:col-span-2">
                Product name
                <input
                  ref={nameInputRef}
                  className={`${fieldClass} mt-1`}
                  value={draft.name}
                  onChange={(e) => setDraft((current) => ({ ...current, name: e.target.value }))}
                />
              </label>
              <label className="text-sm text-slate-300">
                Selling price
                <input
                  className={`${fieldClass} mt-1`}
                  type="number"
                  min="0"
                  value={draft.sellingPrice}
                  onChange={(e) => setDraft((current) => ({ ...current, sellingPrice: e.target.value }))}
                />
              </label>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm text-slate-300">
                <div className="font-medium text-slate-100">Admin completes later</div>
                <div className="mt-1 text-slate-400">
                  Buying price, commission amount, and approval rules stay under admin control.
                </div>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-black hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => void submitDraft()}
                disabled={saving}
              >
                {saving ? "Saving..." : draft.id ? "Update product" : "Create product"}
              </button>
              {draft.id ? (
                <div className="text-sm text-emerald-200">
                  Editing: <span className="font-semibold text-white">{draft.name || "Product"}</span>
                </div>
              ) : null}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Catalog size</div>
              <div className="mt-3 text-3xl font-semibold text-white">{products.length}</div>
              <div className="mt-1 text-sm text-slate-400">Products visible in your POS product desk.</div>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Active products</div>
              <div className="mt-3 text-3xl font-semibold text-emerald-300">{activeCount}</div>
              <div className="mt-1 text-sm text-slate-400">Available to pick on the POS receipt form.</div>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-xl shadow-black/40">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Catalog</p>
            <h2 className="text-2xl font-semibold text-white">Manage products</h2>
            <p className="mt-2 text-sm text-slate-400">
              Create, edit, or remove products. Historical POS receipts remain unchanged if an old product is archived.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3">
            <input
              className="w-full max-w-sm rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-sm text-slate-100"
              placeholder="Search products"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
              />
              Show archived products
            </label>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-800">
          <table className="min-w-full divide-y divide-slate-800 text-sm">
            <thead className="bg-slate-950/70 text-left text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Selling</th>
                <th className="px-4 py-3">Buying</th>
                <th className="px-4 py-3">Commission</th>
                <th className="px-4 py-3">State</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 bg-slate-950/40">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                    Loading products...
                  </td>
                </tr>
              ) : products.length ? (
                products.map((product) => (
                  <tr key={product.id} className={draft.id === product.id ? "bg-emerald-500/5" : undefined}>
                    <td className="px-4 py-3 align-top">
                      <div className="font-semibold leading-7 text-white">{product.name}</div>
                      <div className="text-xs uppercase tracking-wide text-slate-400">
                        {product.sku}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top text-slate-200">
                      {formatMoney(product.sellingPrice)}
                    </td>
                    <td className="px-4 py-3 align-top text-slate-200">
                      {product.lastBuyingPrice != null ? formatMoney(product.lastBuyingPrice) : (
                        <span className="text-slate-500">Admin pending</span>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top text-slate-200">
                      {product.commissionEnabled ? (
                        <div>
                          <div>{formatMoney(product.commissionAmount)}</div>
                          <div className="text-xs text-slate-400">
                            {product.commissionRequiresApproval ? "Approval required" : "Auto release"}
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-500">Admin pending</span>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          product.isActive
                            ? "bg-emerald-500/15 text-emerald-200"
                            : "bg-slate-800 text-slate-400"
                        }`}
                      >
                        {product.isActive ? "Active" : "Archived"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right align-top">
                      <div className="flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          className="rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/5"
                          onClick={() => startEdit(product)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="rounded-xl border border-rose-500/40 px-3 py-2 text-xs font-semibold text-rose-200 hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                          onClick={() => void deleteProduct(product)}
                          disabled={deletingId === product.id}
                        >
                          {deletingId === product.id ? "Deleting..." : "Delete"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                    No products found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
