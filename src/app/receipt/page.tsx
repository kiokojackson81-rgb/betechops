"use client";

import React from "react";

type ReceiptItem = {
  id: number;
  description: string;
  quantity: number;
  unitPrice: number;
};

export default function ReceiptPage() {
  const [items, setItems] = React.useState<ReceiptItem[]>([
    { id: 1, description: "", quantity: 1, unitPrice: 0 },
  ]);
  const [paymentMethod, setPaymentMethod] = React.useState<"MPESA" | "CASH">("MPESA");
  const [notes, setNotes] = React.useState("");
  const [descLoadingId, setDescLoadingId] = React.useState<number | null>(null);
  const [notesLoading, setNotesLoading] = React.useState(false);

  const updateItem = (id: number, patch: Partial<ReceiptItem>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  };

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      {
        id: prev.length ? prev[prev.length - 1].id + 1 : 1,
        description: "",
        quantity: 1,
        unitPrice: 0,
      },
    ]);
  };

  const removeItem = (id: number) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  const aiDescription = async (item: ReceiptItem) => {
    if (!item.description.trim()) return;
    setDescLoadingId(item.id);
    try {
      const res = await fetch("/api/ai/receipt-description", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawDescription: item.description }),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.description) {
        updateItem(item.id, { description: data.description });
      }
    } finally {
      setDescLoadingId(null);
    }
  };

  const aiNotes = async () => {
    if (!items.length) return;
    setNotesLoading(true);
    try {
      const res = await fetch("/api/ai/receipt-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((it) => ({ description: it.description })),
          paymentMethod,
        }),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.notes) setNotes(data.notes);
    } finally {
      setNotesLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="rounded-2xl border border-slate-700 p-4 space-y-3">
        {items.map((item) => (
          <div key={item.id} className="flex gap-2 items-start">
            <textarea
              className="flex-1 rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm"
              placeholder="Item description"
              value={item.description}
              onChange={(e) => updateItem(item.id, { description: e.target.value })}
            />
            <input
              type="number"
              className="w-16 rounded-lg bg-slate-900 border border-slate-700 px-2 py-2 text-sm"
              value={item.quantity}
              onChange={(e) =>
                updateItem(item.id, { quantity: Number(e.target.value) })
              }
            />
            <input
              type="number"
              className="w-28 rounded-lg bg-slate-900 border border-slate-700 px-2 py-2 text-sm"
              value={item.unitPrice}
              onChange={(e) =>
                updateItem(item.id, { unitPrice: Number(e.target.value) })
              }
            />
            <button
              type="button"
              onClick={() => aiDescription(item)}
              disabled={descLoadingId === item.id}
              className="px-2 py-1 rounded-full border border-slate-600 text-xs"
            >
              {descLoadingId === item.id ? "…" : "✨ AI"}
            </button>
            <button
              type="button"
              onClick={() => removeItem(item.id)}
              className="text-xs text-red-400"
            >
              Remove
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={addItem}
          className="mt-2 rounded-full bg-emerald-500 px-4 py-2 text-sm font-medium"
        >
          + Add item
        </button>
      </div>

      <div className="flex gap-4 items-center">
        <span className="text-sm text-slate-300">Payment method:</span>
        <button
          type="button"
          onClick={() => setPaymentMethod("MPESA")}
          className={`px-4 py-2 rounded-full text-sm ${
            paymentMethod === "MPESA" ? "bg-emerald-500 text-black" : "bg-slate-800"
          }`}
        >
          MPESA
        </button>
        <button
          type="button"
          onClick={() => setPaymentMethod("CASH")}
          className={`px-4 py-2 rounded-full text-sm ${
            paymentMethod === "CASH" ? "bg-emerald-500 text-black" : "bg-slate-800"
          }`}
        >
          Cash
        </button>
      </div>

      <div>
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm text-slate-300">GENERAL NOTES / TERMS</span>
          <button
            type="button"
            onClick={aiNotes}
            disabled={notesLoading}
            className="px-3 py-1 rounded-full border border-slate-600 text-xs"
          >
            {notesLoading ? "…" : "✨ Generate notes"}
          </button>
        </div>
        <textarea
          className="w-full min-h-[120px] rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Any special notes or terms for this receipt…"
        />
      </div>
    </div>
  );
}
