"use client";

import { useEffect, useState } from "react";

type PendingItem = {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string | null;
  createdAt: string;
  shop?: { name?: string | null };
  items: Array<{
    id: string;
    quantity: number;
    price: number | null;          // unit selling price override (optional)
    subtotal: number | null;
    product?: {
      id: string;
      sku: string | null;
      name: string | null;
      sellingPrice: number | null; // catalog selling price
      actualPrice: number | null;  // lastBuyingPrice
    };
  }>;
};

function Tile({ title, value, tone = "neutral" }: { title: string; value: string | number; tone?: "green"|"red"|"neutral" }) {
  const toneClasses =
    tone === "green" ? "ring-emerald-400/40 shadow-[0_0_24px_rgba(16,185,129,.12)]"
    : tone === "red" ? "ring-rose-400/40 shadow-[0_0_24px_rgba(244,63,94,.12)]"
    : "ring-white/10";
  return (
    <div className={`rounded-2xl border border-white/10 backdrop-blur bg-white/5 p-4 ring-1 ${toneClasses}`}>
      <div className="text-sm text-slate-300">{title}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
    </div>
  );
}

export default function AttendantDashboard() {
  const [rows, setRows] = useState<PendingItem[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch(`/api/attendants/pending?take=20&q=${encodeURIComponent(q)}`, { cache: "no-store" });
      if (!r.ok) throw new Error(`pending ${r.status}`);
      const j = await r.json();
      setRows(j.rows || []);
    } catch (e: unknown) {
      setErr((e as Error)?.message || "Failed to load pending orders");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, [q]); // Re-run when search query changes

  const totals = (() => {
    const totalPending = rows.length;
    let withBuying = 0;
    let withoutBuying = 0;
    for (const o of rows) {
      for (const it of o.items) {
        if ((it.product?.actualPrice ?? 0) > 0) withBuying++;
        else withoutBuying++;
      }
    }
    return { totalPending, withBuying, withoutBuying };
  })();

  return (
    <div className="mx-auto max-w-7xl p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Attendant Dashboard</h1>
          <p className="text-slate-400 text-sm">Manage pending orders, set buying prices, and process returns.</p>
        </div>
        <div className="flex gap-2">
          <input
            placeholder="Search order #, name, phone, shop…"
            className="rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm outline-none focus:bg-white/10"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button onClick={refresh} className="rounded-xl border border-white/10 px-3 py-2 text-sm hover:bg-white/10">
            Refresh
          </button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Tile title="Total Pending Orders" value={totals.totalPending} />
        <Tile title="Orders With Buying Price Set (items)" value={totals.withBuying} tone="green" />
        <Tile title="Orders Without Buying Price (items)" value={totals.withoutBuying} tone="red" />
      </div>

      {/* Errors / Loading */}
      {err && <div className="mt-4 rounded border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">{err}</div>}
      {loading && <div className="mt-4 text-sm text-slate-400">Loading…</div>}

      {/* Pending Orders List */}
      <div className="mt-6 overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-white/5">
            <tr className="[&>th]:px-3 [&>th]:py-2 text-left text-slate-300">
              <th>Order #</th>
              <th>Customer</th>
              <th>Shop</th>
              <th>Items</th>
              <th>Buying Set</th>
              <th>Created</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {rows.map((o) => {
              const itemsCount = o.items.reduce((n, it) => n + it.quantity, 0);
              const buyingSet = o.items.filter(it => (it.product?.actualPrice ?? 0) > 0).length;
              return (
                <tr key={o.id} className="[&>td]:px-3 [&>td]:py-2">
                  <td className="font-mono">{o.orderNumber}</td>
                  <td>
                    <div className="font-medium">{o.customerName}</div>
                    <div className="text-slate-400">{o.customerPhone || "—"}</div>
                  </td>
                  <td>{o.shop?.name || "—"}</td>
                  <td>{itemsCount}</td>
                  <td>
                    <span className={`rounded px-2 py-0.5 text-xs ${buyingSet === o.items.length ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300"}`}>
                      {buyingSet}/{o.items.length}
                    </span>
                  </td>
                  <td>{new Date(o.createdAt).toLocaleString()}</td>
                  <td className="text-right">
                    <PriceModal orderId={o.id} items={o.items} onSaved={refresh} />
                    <ReturnModal orderId={o.id} onSaved={refresh} />
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && !loading && (
              <tr><td colSpan={7} className="px-3 py-8 text-center text-slate-400">No pending orders right now.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ===================== Modals (client) ===================== */
function Dialog({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="absolute left-1/2 top-1/2 w-[min(96vw,640px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/10 bg-[#0b0e13] p-4 shadow-xl">
        {children}
      </div>
    </div>
  );
}

function PriceModal({ orderId, items, onSaved }: { orderId: string; items: PendingItem["items"]; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [drafts, setDrafts] = useState(() =>
    items.map((it) => ({
      itemId: it.id,
      productId: it.product?.id || "",
      name: it.product?.name || "",
      sku: it.product?.sku || "",
      currentBuying: it.product?.actualPrice ?? 0,
      input: it.product?.actualPrice ?? 0,
    }))
  );
  const [saving, setSaving] = useState(false);

  const setInput = (i: number, v: number) => {
    const n = [...drafts];
    n[i].input = v;
    setDrafts(n);
  };

  const submit = async () => {
    setSaving(true);
    try {
      for (const d of drafts) {
        if (!Number.isFinite(d.input) || d.input <= 0) continue;
        await fetch(`/api/attendants/orders/${orderId}/price`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ productId: d.productId, lastBuyingPrice: d.input }),
        });
      }
      setOpen(false);
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button onClick={() => setOpen(true)} className="mr-2 rounded-lg border border-white/10 px-3 py-1.5 hover:bg-white/10">Set Prices</button>
      <Dialog open={open} onClose={() => setOpen(false)}>
        <h3 className="text-lg font-semibold">Set Buying Prices</h3>
        <div className="mt-3 max-h-[50vh] overflow-auto space-y-2">
          {drafts.map((d, i) => (
            <div key={d.itemId} className="grid grid-cols-12 gap-2 items-center">
              <div className="col-span-6">
                <div className="font-medium">{d.name}</div>
                <div className="text-slate-400 text-xs">{d.sku}</div>
              </div>
              <div className="col-span-3 text-sm text-slate-400">Current: {d.currentBuying > 0 ? `Ksh ${d.currentBuying}` : "—"}</div>
              <div className="col-span-3">
                <input
                  type="number"
                  className="w-full rounded-lg bg-white/5 border border-white/10 px-2 py-1"
                  value={d.input}
                  onChange={(e) => setInput(i, Number(e.target.value))}
                  min={1}
                />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={() => setOpen(false)} className="rounded-lg border border-white/10 px-3 py-1.5 hover:bg-white/10">Cancel</button>
          <button disabled={saving} onClick={submit} className="rounded-lg bg-yellow-400 px-4 py-2 font-semibold text-black hover:bg-yellow-300 disabled:opacity-60">
            {saving ? "Saving…" : "Save Prices"}
          </button>
        </div>
      </Dialog>
    </>
  );
}

function ReturnModal({ orderId, onSaved }: { orderId: string; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("orderId", orderId);
      fd.append("notes", notes);
      if (file) fd.append("photo", file);
      const r = await fetch("/api/returns", { method: "POST", body: fd });
      if (!r.ok) alert("Failed to submit return");
      setOpen(false);
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button onClick={() => setOpen(true)} className="rounded-lg border border-white/10 px-3 py-1.5 hover:bg-white/10">Submit Return</button>
      <Dialog open={open} onClose={() => setOpen(false)}>
        <h3 className="text-lg font-semibold">Return Documentation</h3>
        <div className="mt-3 space-y-3">
          <textarea
            placeholder="Notes (reason for return, condition, etc.)"
            className="w-full min-h-[120px] rounded-lg bg-white/5 border border-white/10 px-3 py-2"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm"
          />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={() => setOpen(false)} className="rounded-lg border border-white/10 px-3 py-1.5 hover:bg-white/10">Cancel</button>
          <button disabled={saving} onClick={submit} className="rounded-lg bg-yellow-400 px-4 py-2 font-semibold text-black hover:bg-yellow-300 disabled:opacity-60">
            {saving ? "Submitting…" : "Submit"}
          </button>
        </div>
      </Dialog>
    </>
  );
}