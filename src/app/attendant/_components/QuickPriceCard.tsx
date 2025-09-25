"use client";

import { useMemo, useState } from "react";

type Product = { id: string; name: string; sku: string; sellingPrice: number; lastBuyingPrice?: number };

export default function QuickPriceCard() {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Product | null>(null);
  const [buy, setBuy] = useState<string>("");

  const margin = useMemo(() => {
    if (!selected) return null;
    const buying = Number(buy);
    if (!Number.isFinite(buying) || buying <= 0) return null;
    const profit = selected.sellingPrice - buying;
    const pct = (profit / selected.sellingPrice) * 100;
    return { profit, pct };
  }, [buy, selected]);

  const money = (v: number) => `KES ${new Intl.NumberFormat().format(v)}`;

  const search = async () => {
    if (!query.trim()) return;
    const r = await fetch(`/api/products?search=${encodeURIComponent(query)}`, { cache: "no-store" });
    if (r.ok) {
      const arr = (await r.json()) as Product[];
      setSelected(arr[0] || null);
      if (arr[0]?.lastBuyingPrice) setBuy(String(arr[0].lastBuyingPrice));
    }
  };

  const save = async () => {
    if (!selected) return;
    const buying = Number(buy);
    if (!Number.isFinite(buying) || buying <= 0) return alert("Enter a valid buying price > 0");
    const prev = selected.lastBuyingPrice;

    setSelected({ ...selected, lastBuyingPrice: buying });
    try {
      const r = await fetch(`/api/attendants/orders/price`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: selected.id, lastBuyingPrice: buying }),
      });
      if (!r.ok) throw new Error("save error");
      alert("Buying price saved");
    } catch {
      setSelected({ ...selected, lastBuyingPrice: prev });
      alert("Failed to save");
    }
  };

  return (
    <section className="rounded-2xl border border-white/10 bg-[linear-gradient(135deg,rgba(18,22,32,.9),rgba(18,22,32,.7))] p-4 backdrop-blur">
      <h2 className="mb-3 text-lg font-semibold">Quick Price Set</h2>

      <div className="flex flex-col gap-3 sm:flex-row">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Scan / type SKU or product name" className="w-full rounded-lg border border-white/10 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-slate-500" />
        <button onClick={search} className="rounded-lg bg-white/10 px-3 py-2 text-sm hover:bg-white/20">Find</button>
      </div>

      {selected && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-[#0b0e13] p-3">
            <div className="text-xs text-slate-400">Product</div>
            <div className="text-sm font-medium">{selected.name}</div>
            <div className="text-xs text-slate-500">{selected.sku}</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-[#0b0e13] p-3">
            <div className="text-xs text-slate-400">Selling Price</div>
            <div className="text-lg font-semibold">{money(selected.sellingPrice)}</div>
          </div>

          <div className="rounded-xl border border-white/10 bg-[#0b0e13] p-3">
            <div className="text-xs text-slate-400">Buying Price</div>
            <input value={buy} onChange={(e) => setBuy(e.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-transparent px-2 py-1 text-sm outline-none" placeholder="e.g. 1200" />
          </div>

          <div className="rounded-xl border border-white/10 bg-[#0b0e13] p-3">
            <div className="text-xs text-slate-400">Profit / Margin</div>
            {margin ? (
              <div className="mt-1 text-sm">
                <span className={`${margin.pct >= 15 ? "text-green-300" : margin.pct >= 5 ? "text-yellow-300" : "text-red-300"}`}>{money(margin.profit)} · {margin.pct.toFixed(1)}%</span>
              </div>
            ) : (
              <div className="mt-1 text-sm text-slate-500">—</div>
            )}
          </div>
        </div>
      )}

      <div className="mt-4 flex items-center gap-2">
        <button onClick={save} disabled={!selected} className="rounded-lg bg-white/10 px-3 py-2 text-sm hover:bg-white/20 disabled:opacity-50">Save Buying Price</button>
        <button onClick={() => { setQuery(""); setSelected(null); setBuy(""); }} className="rounded-lg border border-white/10 px-3 py-2 text-sm hover:bg-white/10">Clear</button>
      </div>
    </section>
  );
}
