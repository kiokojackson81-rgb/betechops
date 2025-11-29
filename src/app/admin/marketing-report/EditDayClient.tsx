"use client";

import React, { useState } from "react";

type Item = { id?: string; productName: string; buyingPrice: number };
type Receipt = { id?: string; receiptNumber?: string | null; sellingTotal: number; paymentMethod: "MPESA" | "CASH"; items: Item[] };

export default function EditDayClient({ initialData }: { initialData: { id: string; date: string; receipts: Receipt[] } }) {
  const [receipts, setReceipts] = useState<Receipt[]>(initialData.receipts || []);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const updateReceipt = (index: number, patch: Partial<Receipt>) => {
    setReceipts((r) => r.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const addReceipt = () => {
    setReceipts((r) => [...r, { receiptNumber: "", sellingTotal: 0, paymentMethod: "MPESA", items: [{ productName: "", buyingPrice: 0 }] }]);
  };

  const removeReceipt = (index: number) => {
    const ok = window.confirm("Remove this receipt? This will delete its items too.");
    if (!ok) return;
    setReceipts((r) => r.filter((_, i) => i !== index));
  };

  const updateItem = (rIndex: number, iIndex: number, patch: Partial<Item>) => {
    setReceipts((rows) => rows.map((r, ri) => (ri === rIndex ? { ...r, items: r.items.map((it, ii) => (ii === iIndex ? { ...it, ...patch } : it)) } : r)));
  };

  const addItem = (rIndex: number) => {
    setReceipts((rows) => rows.map((r, i) => (i === rIndex ? { ...r, items: [...r.items, { productName: "", buyingPrice: 0 }] } : r)));
  };

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/marketing-report/update-entry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryId: initialData.id, receipts }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to save");
      // If API returns the updated entry, refresh local state
      if (data?.entry && Array.isArray(data.entry.receipts)) {
        setReceipts(data.entry.receipts.map((r: any) => ({ ...r })));
      }
      setMessage("Saved successfully");
    } catch (err: any) {
      setMessage(err?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const wipeAll = async () => {
    const ok = window.confirm("This will delete all receipts and items for this day. Are you sure?");
    if (!ok) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/marketing-report/update-entry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryId: initialData.id, action: "wipe" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to wipe");
      setReceipts([]);
      setMessage("Wiped receipts for the day.");
    } catch (err: any) {
      setMessage(err?.message || "Wipe failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {receipts.map((r, ri) => (
        <div key={ri} className="rounded border border-slate-800 bg-slate-950/40 p-3">
          <div className="grid gap-2 md:grid-cols-3">
            <input value={r.receiptNumber ?? ""} onChange={(e) => updateReceipt(ri, { receiptNumber: e.target.value })} placeholder="Receipt number" className="px-2 py-1 bg-slate-900 border border-slate-800 rounded" />
            <input type="number" value={r.sellingTotal} onChange={(e) => updateReceipt(ri, { sellingTotal: Number(e.target.value) || 0 })} className="px-2 py-1 bg-slate-900 border border-slate-800 rounded" />
            <select value={r.paymentMethod} onChange={(e) => updateReceipt(ri, { paymentMethod: e.target.value as any })} className="px-2 py-1 bg-slate-900 border border-slate-800 rounded">
              <option value="MPESA">MPESA</option>
              <option value="CASH">CASH</option>
            </select>
          </div>
          <div className="mt-2 flex justify-end">
            <button type="button" onClick={() => removeReceipt(ri)} className="text-sm text-red-400">Remove receipt</button>
          </div>
          <div className="mt-2 space-y-2">
            {r.items.map((it, ii) => (
              <div key={ii} className="flex gap-2">
                <input value={it.productName} onChange={(e) => updateItem(ri, ii, { productName: e.target.value })} placeholder="Product" className="flex-1 px-2 py-1 bg-slate-900 border border-slate-800 rounded" />
                <input type="number" value={it.buyingPrice} onChange={(e) => updateItem(ri, ii, { buyingPrice: Number(e.target.value) || 0 })} className="w-40 px-2 py-1 bg-slate-900 border border-slate-800 rounded" />
              </div>
            ))}
            <button type="button" onClick={() => addItem(ri)} className="text-sm text-emerald-300">+ Add item</button>
          </div>
        </div>
      ))}

      <div>
        <button type="button" onClick={addReceipt} className="text-sm text-emerald-300">+ Add receipt</button>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={saving} className="rounded px-4 py-2 bg-emerald-500 text-black">
          {saving ? "Saving..." : "Save changes"}
        </button>
        <button onClick={wipeAll} disabled={saving} className="rounded px-4 py-2 bg-rose-600 text-white">
          {saving ? "Working..." : "Wipe all receipts"}
        </button>
        {message && <div className="text-sm">{message}</div>}
      </div>
    </div>
  );
}
