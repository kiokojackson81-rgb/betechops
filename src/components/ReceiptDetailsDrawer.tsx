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
  // support older responses that returned items at root
  items?: { id: string; title?: string; quantity?: number; sellingPrice?: number }[];
  // newer shape: receipt object with order and items
  receipt?: any;
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
        // store full response so we can access supportItems and posCommission data
        if (!cancelled) setDetail(data);
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
                  {(() => {
                    const items = Array.isArray(detail?.items) && detail.items.length ? detail.items : detail?.receipt?.order?.items ?? [];
                    if (!items || !items.length) return <div className="text-sm text-slate-400">No items available.</div>;
                    return items.map((it: any) => {
                      const title = it.title || it.product?.name || "Item";
                      const qty = it.quantity ?? 1;
                      const selling = Number(it.sellingPrice ?? it.price ?? 0);
                      const buying = (it.orderCosts && it.orderCosts[0] && Number(it.orderCosts[0].unitCost)) || null;
                      const isVariable = it.product?.buyingPriceType === "VARIABLE";
                      return (
                        <div key={it.id} className="flex items-center justify-between text-sm text-slate-200">
                          <div>
                            <div className="font-medium">{title}</div>
                            <div className="text-xs text-slate-400">Qty: {qty}</div>
                            {isVariable && !buying && <div className="text-xs text-amber-300">Variable item — needs pricing</div>}
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-emerald-300">KES {selling.toLocaleString("en-KE")}</div>
                            {!buying && isVariable ? (
                              <button
                                onClick={async () => {
                                  const raw = window.prompt(`Enter buying price for ${title} (KES)`);
                                  if (!raw) return;
                                  const v = Number(raw.replace(/[^0-9.\-]/g, ""));
                                  if (!Number.isFinite(v) || v <= 0) { window.dispatchEvent(new CustomEvent('betechops:toast', { detail: { message: 'Enter a valid buying price', type: 'error' } })); return; }
                                  try {
                                    const res = await fetch(`/api/receipts/price-item`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ orderItemId: it.id, buyingPrice: Math.round(v) }) });
                                    const data = await res.json().catch(() => ({}));
                                    if (!res.ok) {
                                      throw new Error(data?.error || 'Failed to price item');
                                    }
                                    window.dispatchEvent(new CustomEvent('betechops:toast', { detail: { message: 'Buying price saved', type: 'success' } }));
                                    // refresh
                                    const refreshed = await fetch(`/api/receipts/${id}`, { cache: 'no-store' });
                                    const rd = await refreshed.json();
                                    setDetail(rd);
                                  } catch (err) {
                                    window.dispatchEvent(new CustomEvent('betechops:toast', { detail: { message: err instanceof Error ? err.message : 'Failed to save buying price', type: 'error' } }));
                                  }
                                }}
                                className="rounded bg-amber-600 px-2 py-1 text-xs font-medium text-white hover:bg-amber-500"
                              >
                                Price item
                              </button>
                            ) : (
                              buying ? <div className="text-slate-400 text-xs">Bought: KES {Number(buying).toLocaleString('en-KE')}</div> : null
                            )}
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
