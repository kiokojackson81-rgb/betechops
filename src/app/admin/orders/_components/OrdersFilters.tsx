"use client";
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo } from 'react';

const STATUSES = ["PENDING","PACKED","READY_TO_SHIP","DELIVERED","CANCELLED","RETURNED","DISPUTED"];

export default function OrdersFilters() {
  const pathname = usePathname();
  const router = useRouter();
  const sp = useSearchParams();

  const set = useCallback((k: string, v?: string) => {
    const q = new URLSearchParams(sp.toString());
    if (v) q.set(k, v); else q.delete(k);
    q.delete('nextToken');
    router.push(`${pathname}?${q.toString()}`);
  }, [pathname, router, sp]);

  const values = useMemo(() => ({
    status: sp.get('status') || '',
    country: sp.get('country') || '',
    shopId: sp.get('shopId') || '',
    dateFrom: sp.get('dateFrom') || '',
    dateTo: sp.get('dateTo') || '',
    q: sp.get('q') || '',
    size: sp.get('size') || '50',
  }), [sp]);

  return (
    <div className="rounded-xl border border-white/10 bg-[var(--panel,#121723)] p-4">
      <div className="grid md:grid-cols-6 gap-3">
        <select value={values.status} onChange={e=>set('status', e.target.value || undefined)} className="border border-white/10 bg-white/5 rounded-lg px-2 py-2">
          <option value="">All Status</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        <input value={values.country} onChange={e=>set('country', e.target.value || undefined)} placeholder="Country (e.g. KE)" className="border border-white/10 bg-white/5 rounded-lg px-2 py-2" />

        <input value={values.shopId} onChange={e=>set('shopId', e.target.value || undefined)} placeholder="Shop ID (optional)" className="border border-white/10 bg-white/5 rounded-lg px-2 py-2" />

        <input type="date" value={values.dateFrom} onChange={e=>set('dateFrom', e.target.value || undefined)} className="border border-white/10 bg-white/5 rounded-lg px-2 py-2" />
        <input type="date" value={values.dateTo} onChange={e=>set('dateTo', e.target.value || undefined)} className="border border-white/10 bg-white/5 rounded-lg px-2 py-2" />

        <input value={values.q} onChange={e=>set('q', e.target.value || undefined)} placeholder="Search number or name…" className="border border-white/10 bg-white/5 rounded-lg px-2 py-2" />
      </div>

      <div className="flex items-center gap-3 mt-3">
        <select value={values.size} onChange={e=>set('size', e.target.value)} className="border border-white/10 bg-white/5 rounded-lg px-2 py-2">
          {[25,50,100].map(n => <option key={n} value={n}>{n} / page</option>)}
        </select>
        <button onClick={()=>{['status','country','shopId','dateFrom','dateTo','q','size','nextToken'].forEach(k=>set(k, undefined));}}
                className="px-3 py-2 rounded-lg border border-white/10 hover:bg-white/10">
          Reset
        </button>
      </div>
    </div>
  );
}
