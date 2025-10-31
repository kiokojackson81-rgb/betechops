"use client";
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

type Props = {
  status?: string;
  country?: string;
  shopId?: string;
  dateFrom?: string;
  dateTo?: string;
  intervalMs?: number;
};

export default function OrdersSSE({ status, country, shopId, dateFrom, dateTo, intervalMs = 4000 }: Props) {
  const router = useRouter();
  const esRef = useRef<EventSource | null>(null);
  const [live, setLive] = useState<'connecting' | 'on' | 'off'>('connecting');

  useEffect(() => {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (country) params.set('country', country);
    if (shopId) params.set('shopId', shopId);
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    params.set('intervalMs', String(intervalMs));

    const url = `/api/orders/events?${params.toString()}`;
    const es = new EventSource(url, { withCredentials: false });
    esRef.current = es;

    es.onopen = () => setLive('on');
    es.onerror = () => setLive('off');
    es.addEventListener('orders', (ev) => {
      try {
        // Broadcast a lightweight client event instead of full router.refresh to avoid flicker
        const detail = { source: 'sse', ts: Date.now() } as const;
        window.dispatchEvent(new CustomEvent('orders:refresh', { detail }));
      } catch {}
      // Avoid full page refresh here; OrdersLiveData listens for orders:refresh and fetches incrementally
    });

    return () => {
      try { es.close(); } catch {}
      esRef.current = null;
      setLive('off');
    };
  }, [status, country, shopId, dateFrom, dateTo, intervalMs, router]);

  return (
    <div className="text-xs text-slate-400 flex items-center gap-2" title="Live updates via SSE">
      <span>Live</span>
      <span className={
        live === 'on' ? 'inline-block w-2 h-2 rounded-full bg-green-500' : live === 'connecting' ? 'inline-block w-2 h-2 rounded-full bg-yellow-500' : 'inline-block w-2 h-2 rounded-full bg-slate-500'
      }/>
      <span className="opacity-60">SSE</span>
    </div>
  );
}
