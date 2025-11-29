"use client";

import React from "react";
import Card from "@/app/_components/Card";
import Input from "@/app/_components/Input";
import Button from "@/app/_components/Button";

type ReceiptItem = { id: string; productName: string; buyingPrice: number | "" };
type ReceiptRow = {
  id: string;
  receiptNumber: string;
  sellingTotal: number | "";
  paymentMethod: "MPESA" | "CASH";
  items: ReceiptItem[];
};

const pillClass = (checked: boolean) =>
  `rounded-full border px-4 py-2 text-sm font-medium transition ${
    checked
      ? "border-emerald-400 bg-emerald-400 text-black shadow-lg shadow-emerald-500/20"
      : "border-slate-700 bg-slate-800 text-slate-200 hover:border-slate-500"
  }`;

export default function ReceiptsEditor({
  receipts,
  setReceipts,
  totals,
}: {
  receipts: ReceiptRow[];
  setReceipts: React.Dispatch<React.SetStateAction<ReceiptRow[]>>;
  totals: { totalSales: number; totalProfit: number; totalItems: number };
}) {
  const newSaleRow = (): ReceiptRow => ({
    id: typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : Math.random().toString(36).slice(2),
    receiptNumber: "",
    sellingTotal: "",
    paymentMethod: "MPESA",
    items: [
      {
        id: typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : Math.random().toString(36).slice(2),
        productName: "",
        buyingPrice: "",
      },
    ],
  });

  const updateReceipt = (id: string, patch: Partial<ReceiptRow>) => {
    setReceipts((rows) => rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  const addReceipt = () => setReceipts((rows) => [...rows, newSaleRow()]);
  const removeReceipt = (id: string) => setReceipts((rows) => (rows.length > 1 ? rows.filter((r) => r.id !== id) : rows));

  const addItem = (receiptId: string) => {
    setReceipts((rows) =>
      rows.map((r) =>
        r.id === receiptId
          ? {
              ...r,
              items: [
                ...r.items,
                {
                  id: typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : Math.random().toString(36).slice(2),
                  productName: "",
                  buyingPrice: "",
                },
              ],
            }
          : r
      )
    );
  };

  const updateItem = (receiptId: string, itemId: string, patch: Partial<ReceiptItem>) => {
    setReceipts((rows) =>
      rows.map((r) => (r.id === receiptId ? { ...r, items: r.items.map((it) => (it.id === itemId ? { ...it, ...patch } : it)) } : r))
    );
  };

  const removeItem = (receiptId: string, itemId: string) => {
    setReceipts((rows) =>
      rows.map((r) =>
        r.id === receiptId
          ? {
              ...r,
              items: r.items.filter((it) => it.id !== itemId).length > 0 ? r.items.filter((it) => it.id !== itemId) : r.items,
            }
          : r
      )
    );
  };

  return (
    <Card className="border-slate-800 bg-slate-900/60 shadow-xl shadow-black/20 space-y-4">
      <div className="flex flex-col gap-1">
        <p className="text-xs uppercase tracking-wide text-slate-400">Sales records</p>
        <h2 className="text-xl font-semibold">Add each receipt for today</h2>
        <p className="text-sm text-slate-400">Totals are calculated automatically.</p>
      </div>

      <div className="flex flex-col gap-3">
        {receipts.map((receipt) => (
          <div key={receipt.id} className="space-y-3 rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-200">Receipt</div>
              <Button variant="secondary" type="button" className="px-3 py-2 text-xs" onClick={() => removeReceipt(receipt.id)}>
                Remove receipt
              </Button>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-1">
                <label className="text-xs uppercase tracking-wide text-slate-400">Selling total (KES)</label>
                <Input
                  type="number"
                  min={0}
                  value={receipt.sellingTotal === "" ? "" : receipt.sellingTotal}
                  onChange={(e) => updateReceipt(receipt.id, { sellingTotal: e.target.value === "" ? "" : Math.max(0, Number(e.target.value)) })}
                  placeholder="0"
                  className="w-full rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-slate-100"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs uppercase tracking-wide text-emerald-200">Receipt number (required)</label>
                <Input
                  value={receipt.receiptNumber}
                  onChange={(e) => updateReceipt(receipt.id, { receiptNumber: e.target.value })}
                  placeholder="Required"
                  className="w-full rounded-xl border border-emerald-500 bg-emerald-900/10 px-3 py-2 text-emerald-200"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs uppercase tracking-wide text-slate-400">Payment method</label>
                <div className="flex gap-2">
                  {(["MPESA", "CASH"] as const).map((method) => (
                    <button key={method} type="button" onClick={() => updateReceipt(receipt.id, { paymentMethod: method })} className={pillClass(receipt.paymentMethod === method)}>
                      {method === "MPESA" ? "MPESA" : "Cash"}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-xs uppercase tracking-wide text-slate-400">Products in this receipt</div>
              <div className="flex flex-col gap-2">
                {receipt.items.map((item) => (
                  <div key={item.id} className="grid gap-2 md:grid-cols-[2fr_1fr_auto] md:items-center">
                    <Input value={item.productName} onChange={(e) => updateItem(receipt.id, item.id, { productName: e.target.value })} placeholder="Product name" className="w-full rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-slate-100" />
                    <Input
                      type="number"
                      min={0}
                      value={item.buyingPrice === "" ? "" : item.buyingPrice}
                      onChange={(e) => updateItem(receipt.id, item.id, { buyingPrice: e.target.value === "" ? "" : Math.max(0, Number(e.target.value)) })}
                      placeholder="Buying price (KES)"
                      className="w-full rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-slate-100"
                    />
                    <Button variant="secondary" type="button" className="px-3 py-2 text-xs" onClick={() => removeItem(receipt.id, item.id)}>
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
              <Button type="button" variant="secondary" className="px-3 py-2 text-xs" onClick={() => addItem(receipt.id)}>
                + Add product to this receipt
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-950/70 p-3 text-sm text-slate-200">
        <div className="space-y-1">
          <div>Total receipts: {receipts.length}</div>
          <div>Total sales (KES): {totals.totalSales.toLocaleString()}</div>
          <div>Total profit (KES): {totals.totalProfit.toLocaleString()}</div>
          <div>Total items: {totals.totalItems}</div>
        </div>
        <Button type="button" variant="secondary" className="px-4" onClick={addReceipt}>
          + Add receipt
        </Button>
      </div>
    </Card>
  );
}
