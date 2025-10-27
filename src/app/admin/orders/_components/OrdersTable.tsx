"use client";
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

type Row = {
  id: string;
  number?: string;
  status?: string;
  pendingSince?: string;
  createdAt: string;
  updatedAt?: string;
  deliveryOption?: string;
  totalItems?: number;
  totalAmountLocal?: { currency: string; value: number };
  country?: { code: string; name: string };
  shopIds?: string[];
  isPrepayment?: boolean;
};

export default function OrdersTable({ rows, nextToken, isLastPage }: { rows: Row[]; nextToken: string | null; isLastPage: boolean }) {
  const [busy, setBusy] = useState<string | null>(null);
  const pathname = usePathname();
  const router = useRouter();
  const sp = useSearchParams();

  async function callAction(id: string, action: 'pack' | 'rts' | 'print') {
    setBusy(id + action);
    try {
      if (action === 'print') {
        const url = `/api/jumia/orders/${id}/print-labels`;
        window.open(url, '_blank');
      } else if (action === 'pack') {
        await fetch(`/api/jumia/orders/${id}/pack`, { method: 'POST' });
      } else {
        await fetch(`/api/jumia/orders/${id}/ready-to-ship`, { method: 'POST' });
      }
      router.refresh();
    } catch {
      // optional toast
    } finally {
      setBusy(null);
    }
  }

  function pageNext() {
    if (!nextToken) return;
    const q = new URLSearchParams(sp.toString());
    q.set('nextToken', nextToken);
    router.push(`${pathname}?${q.toString()}`);
  }

  function pagePrev() {
    const q = new URLSearchParams(sp.toString());
    q.delete('nextToken');
    router.push(`${pathname}?${q.toString()}`);
  }

  return (
    <div className="rounded-xl border border-white/10 bg-[var(--panel,#121723)] overflow-auto">
      <table className="w-full text-sm">
        <thead className="text-left bg-black/10">
          <tr>
            <th className="px-3 py-2">Order #</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Created</th>
            <th className="px-3 py-2">Delivery</th>
            <th className="px-3 py-2">Items</th>
            <th className="px-3 py-2">Total</th>
            <th className="px-3 py-2">Country</th>
            <th className="px-3 py-2">Shop</th>
            <th className="px-3 py-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr><td colSpan={9} className="px-3 py-6 text-center text-slate-400">No orders found.</td></tr>
          )}
          {rows.map(r => (
            <tr key={r.id} className="border-t border-white/5">
              <td className="px-3 py-2 font-medium">{r.number ?? r.id}</td>
              <td className="px-3 py-2">
                <span className="px-2 py-0.5 rounded-md border border-white/10 bg-white/5">{r.status}</span>
                {r.pendingSince && <span className="ml-2 text-xs opacity-70">• {r.pendingSince}</span>}
              </td>
              <td className="px-3 py-2">{new Date(r.createdAt).toLocaleString()}</td>
              <td className="px-3 py-2">{r.deliveryOption || '-'}</td>
              <td className="px-3 py-2">{r.totalItems ?? '-'}</td>
              <td className="px-3 py-2">{r.totalAmountLocal ? `${r.totalAmountLocal.currency} ${r.totalAmountLocal.value.toLocaleString()}` : '-'}</td>
              <td className="px-3 py-2">{r.country?.code ?? '-'}</td>
              <td className="px-3 py-2">{r.shopIds?.[0] ?? '-'}</td>
              <td className="px-3 py-2">
                <div className="flex gap-2">
                  <button className="px-2 py-1 rounded border border-white/10 hover:bg-white/10"
                          onClick={()=>callAction(r.id,'pack')} disabled={busy!==null}>{busy===r.id+"pack"?"…":"Pack"}</button>
                  <button className="px-2 py-1 rounded border border-white/10 hover:bg-white/10"
                          onClick={()=>callAction(r.id,'rts')} disabled={busy!==null}>{busy===r.id+"rts"?"…":"RTS"}</button>
                  <button className="px-2 py-1 rounded border border-white/10 hover:bg-white/10"
                          onClick={()=>callAction(r.id,'print')} disabled={busy!==null}>Print</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex items-center justify-between px-3 py-3 border-t border-white/10">
        <button onClick={pagePrev} className="px-3 py-1 rounded border border-white/10 hover:bg-white/10">First page</button>
        <div className="text-xs opacity-70">{isLastPage ? 'Last page' : nextToken ? 'More results available' : ''}</div>
        <button onClick={pageNext} disabled={!nextToken} className="px-3 py-1 rounded border border-white/10 hover:bg-white/10 disabled:opacity-40">Next</button>
      </div>
    </div>
  );
}
