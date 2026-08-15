"use client";

import { useEffect, useRef, useState } from "react";
import { getProductSimilarityScore } from "@/lib/posProductSimilarity";
import { showToast } from "@/lib/ui/toast";

export type PosCatalogProduct = {
  id: string;
  name: string;
  sku: string;
  category?: string | null;
  sellingPrice: number;
  lastBuyingPrice?: number | null;
  variableCost?: boolean;
  defaultWarranty?: string | null;
  isActive?: boolean;
  commissionEnabled?: boolean;
  commissionAmount?: number | string | null;
  commissionRequiresApproval?: boolean;
  soldCount?: number;
};

type PosProductSelectorModalProps = {
  open: boolean;
  onClose: () => void;
  onSelect: (product: PosCatalogProduct) => void;
};

const searchInputClass =
  "mt-1 w-full min-w-0 rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-400/60 focus:outline-none";

export default function PosProductSelectorModal({ open, onClose, onSelect }: PosProductSelectorModalProps) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<PosCatalogProduct[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      setActiveIndex(0);
      return;
    }

    inputRef.current?.focus();
    let cancelled = false;
    const handle = window.setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ activeOnly: "1", limit: "20" });
        if (query.trim()) params.set("search", query.trim());
        const response = await fetch(`/api/products?${params.toString()}`, { cache: "no-store" });
        if (!response.ok) throw new Error("Failed to load catalog");
        const data = await response.json().catch(() => []);
        if (!cancelled) {
          setResults(Array.isArray(data) ? data : []);
          setActiveIndex(0);
        }
      } catch (error) {
        if (!cancelled) {
          setResults([]);
          showToast(error instanceof Error ? error.message : "Failed to load catalog", "error");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, query ? 250 : 0);

    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [open, query]);

  if (!open) return null;

  const selectProduct = (product: PosCatalogProduct) => {
    onSelect(product);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pos-product-selector-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-3xl rounded-3xl border border-white/10 bg-slate-900 p-5 shadow-2xl shadow-black/60">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-slate-400">POS Catalog</p>
            <h2 id="pos-product-selector-title" className="text-xl font-semibold text-white">Select product</h2>
            <p className="text-sm text-slate-400">Search the active POS catalog and select the product to add.</p>
          </div>
          <button type="button" className="rounded-xl border border-white/10 px-3 py-2 text-sm text-slate-200 hover:bg-white/5" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="mt-4">
          <input
            ref={inputRef}
            role="combobox"
            aria-autocomplete="list"
            aria-expanded="true"
            aria-controls="pos-product-options"
            aria-activedescendant={results[activeIndex] ? `pos-product-${results[activeIndex].id}` : undefined}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                onClose();
              } else if (event.key === "ArrowDown" && results.length) {
                event.preventDefault();
                setActiveIndex((current) => (current + 1) % results.length);
              } else if (event.key === "ArrowUp" && results.length) {
                event.preventDefault();
                setActiveIndex((current) => (current - 1 + results.length) % results.length);
              } else if (event.key === "Enter" && results[activeIndex]) {
                event.preventDefault();
                selectProduct(results[activeIndex]);
              }
            }}
            placeholder="Search by product name, SKU, or category"
            className={searchInputClass}
          />
        </div>

        <div id="pos-product-options" role="listbox" className="mt-4 max-h-[420px] space-y-2 overflow-y-auto pr-1">
          {loading ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-6 text-sm text-slate-300">Loading products...</div>
          ) : results.length ? (
            results.map((product, index) => {
              const similarityScore = query.trim() ? getProductSimilarityScore(query, product.name) : 0;
              return (
                <button
                  id={`pos-product-${product.id}`}
                  key={product.id}
                  type="button"
                  role="option"
                  aria-selected={index === activeIndex}
                  className={`flex w-full items-start justify-between gap-4 rounded-2xl border px-4 py-3 text-left hover:border-emerald-500/40 hover:bg-slate-950 ${
                    index === activeIndex ? "border-emerald-500/50 bg-slate-950" : "border-slate-800 bg-slate-950/70"
                  }`}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => selectProduct(product)}
                >
                  <div className="min-w-0 space-y-1">
                    <div className="break-words font-semibold text-white">{product.name}</div>
                    <div className="break-all text-xs uppercase tracking-wide text-slate-400">
                      {product.sku}{product.category ? ` · ${product.category}` : ""}
                    </div>
                    <div className="text-xs text-slate-400">
                      Selling: KES {Number(product.sellingPrice || 0).toLocaleString()}{product.variableCost ? " · Priced later" : ""}
                    </div>
                  </div>
                  {similarityScore >= 0.5 ? (
                    <div className="shrink-0 rounded-full border border-amber-400/30 px-2 py-1 text-xs font-semibold text-amber-100">
                      {Math.round(similarityScore * 100)}% similar
                    </div>
                  ) : null}
                </button>
              );
            })
          ) : (
            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-6 text-sm text-slate-300">No products found.</div>
          )}
        </div>
      </div>
    </div>
  );
}
