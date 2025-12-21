"use client";

import { useEffect, useState } from "react";

type ReceiptDetail = {
  id: string;
  orderRef?: string | null;
  docType?: string | null;
  createdAt: string;
  customerName?: string | null;
  attendantName?: string | null;
  total?: number | null;
  items?: { id: string; title?: string; quantity?: number; sellingPrice?: number }[];
};

export default function ReceiptDetailsDrawer({ id, open, onClose }: { id: string | null; open: boolean; onClose: () => void; }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<ReceiptDetail | null>(null);

  useEffect(() => {
    if (!open || !id) return;
    let cancelled = false;
    const controller = new AbortController();
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/receipts/${id}`, { cache: "no-store", signal: controller.signal });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error || `Failed to load receipt ${id}`);
        }
        const data = await res.json();
        if (!cancelled) setDetail(data.receipt ?? data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [open, id]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1" onClick={onClose} />
      <aside className="w-[420px] max-w-full bg-slate-900/95 border-l border-slate-800 p-4 text-slate-50 shadow-xl">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-lg font-semibold">Receipt details</h3>
            <p className="text-sm text-slate-400">Full receipt view</p>
          </div>
          <div>
            <button onClick={onClose} className="text-sm text-slate-300 hover:text-white">Close</button>
          </div>
        </div>

        <div className="mt-4">
          {loading && <div className="text-sm text-slate-400">Loading...</div>}
          {error && <div className="text-sm text-rose-400">{error}</div>}
          {!loading && !error && detail && (
            <div className="space-y-3">
              <div>
                <div className="text-sm text-slate-400">{detail.docType ?? "Receipt"}</div>
                <div className="text-md font-semibold">{detail.orderRef ?? detail.id}</div>
                <div className="text-xs text-slate-500">{new Date(detail.createdAt).toLocaleString()}</div>
                <div className="text-xs text-slate-500">{detail.customerName ?? "Customer"} — {detail.attendantName ?? "Attendant"}</div>
              </div>

              <div className="rounded-lg border border-white/5 bg-slate-950/50 p-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-slate-400">Total</div>
                  <div className="text-lg font-semibold text-emerald-300">KES {Number(detail.total ?? 0).toLocaleString("en-KE")}</div>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold">Items</h4>
                <div className="mt-2 space-y-2">
                  {Array.isArray(detail.items) && detail.items.length ? (
                    detail.items.map((it) => (
                      <div key={it.id} className="flex items-center justify-between text-sm text-slate-200">
                        <div>
                          <div className="font-medium">{it.title}</div>
                          <div className="text-xs text-slate-400">Qty: {it.quantity ?? 1}</div>
                        </div>
                        <div className="text-emerald-300">KES {Number(it.sellingPrice ?? 0).toLocaleString("en-KE")}</div>
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-slate-400">No items available.</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
