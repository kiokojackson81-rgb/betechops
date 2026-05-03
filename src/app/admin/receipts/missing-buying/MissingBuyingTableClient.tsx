"use client";

import React, { useState } from "react";
import { showToast } from "@/lib/ui/toast";

type ItemRow = {
  receiptId: string;
  id: string;
  productId?: string | null;
  quantity?: number | null;
  sellingPrice?: number | null;
};

export default function MissingBuyingTableClient({ missing }: { missing: Array<{ id: string; orderNumber?: string | null; createdAt: string; sellingTotal: number; items: ItemRow[] }> }) {
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const toggle = (key: string) => setSelected((s) => ({ ...s, [key]: !s[key] }));

  const priceSelected = async (receiptId: string) => {
    const keys = Object.keys(selected).filter((k) => selected[k] && k.startsWith(receiptId + ":"));
    if (!keys.length) return showToast("Select at least one item", "error");
    const raw = window.prompt(`Enter buying price (KES) to apply to ${keys.length} item(s)`);
    if (!raw) return;
    const v = Number(raw.replace(/[^0-9.\-]/g, ""));
    if (!Number.isFinite(v) || v <= 0) return showToast("Enter a valid buying price", "error");

    const payload = { items: keys.map((k) => ({ orderItemId: k.split(":" )[1], buyingPrice: Math.round(v) })) };
    try {
      const res = await fetch(`/api/receipts/price-items`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Failed to price items");
      showToast("Prices saved", "success");
      window.location.reload();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to price items", "error");
    }
  };

  return (
    <div>
      <table className="min-w-full text-sm border-collapse">
        <thead>
          <tr className="text-left text-slate-500 text-xs">
            <th className="pb-2">Receipt</th>
            <th className="pb-2">Created</th>
            <th className="pb-2">Selling</th>
            <th className="pb-2">Missing items</th>
            <th className="pb-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {missing.map((r) => (
            <tr key={r.id} className="border-t border-slate-800">
              <td className="py-2">{r.orderNumber ?? r.id}</td>
              <td className="py-2 text-slate-400">{new Date(r.createdAt).toLocaleString()}</td>
              <td className="py-2">KES {Number(r.sellingTotal ?? 0).toLocaleString()}</td>
              <td className="py-2 text-sm text-slate-200">
                {r.items.map((it) => (
                  <div key={it.id} className="flex items-center gap-3">
                    <input id={`${r.id}:${it.id}`} checked={Boolean(selected[`${r.id}:${it.id}`])} onChange={() => toggle(`${r.id}:${it.id}`)} type="checkbox" />
                    <div>{it.productId ?? it.id}</div>
                    <div className="text-xs text-slate-400">qty {it.quantity ?? 1}</div>
                  </div>
                ))}
              </td>
              <td className="py-2">
                <button onClick={() => priceSelected(r.id)} className="rounded border px-2 py-1 text-xs">Price selected</button>
                <a href={`/receipts/${r.id}`} className="ml-2 rounded border px-2 py-1 text-xs">Edit individually</a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
