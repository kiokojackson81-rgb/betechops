"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import OrdersTable from "./OrdersTable";

export type Row = {
  id: string;
  number?: string;
  status?: string;
  pendingSince?: string;
  createdAt: string;
  updatedAt?: string;
  totalItems?: number;
  packedItems?: number;
  totalAmountLocal?: { currency: string; value: number };
  shopName?: string;
  shopIds?: string[];
  isPrepayment?: boolean;
};

type Props = {
  initialRows: Row[];
  initialNextToken: string | null;
  initialIsLastPage: boolean;
  // Minimal params needed to refetch same dataset from /api/orders
  params: {
    status?: string;
    country?: string;
    shopId?: string;
    dateFrom?: string;
    dateTo?: string;
    q?: string;
    size?: string;
  };
  // When true, never call the live /api/orders endpoint; keep SSR rows only.
  // Useful for DB-only PENDING view to avoid flicker and vendor calls.
  disableClientFetch?: boolean;
};

export default function OrdersLiveData({ initialRows, initialNextToken, initialIsLastPage, params, disableClientFetch = false }: Props) {
  const [rows, setRows] = useState<Row[]>(initialRows ?? []);
  const [nextToken, setNextToken] = useState<string | null>(initialNextToken ?? null);
  const [isLastPage, setIsLastPage] = useState<boolean>(initialIsLastPage ?? true);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number>(Date.now());
  const busyRef = useRef<Promise<void> | null>(null);
  const lastFetchTsRef = useRef<number>(0);
  const MIN_INTERVAL_MS = 2500; // throttle refreshes to at most ~1 every 2.5s

  const query = useMemo(() => {
    const q = new URLSearchParams();
    if (params.status && params.status !== "ALL") q.set("status", params.status);
    if (params.country) q.set("country", params.country);
    if (params.shopId) q.set("shopId", params.shopId);
    if (params.dateFrom) q.set("dateFrom", params.dateFrom);
    if (params.dateTo) q.set("dateTo", params.dateTo);
    if (params.q) q.set("q", params.q);
    if (params.size) q.set("size", params.size);
    return q.toString();
  }, [params.status, params.country, params.shopId, params.dateFrom, params.dateTo, params.q, params.size]);

  const fetchLatest = useCallback(async () => {
    if (disableClientFetch) return Promise.resolve();
    // Throttle: if a fetch ran very recently, skip
    const now = Date.now();
    if (now - lastFetchTsRef.current < MIN_INTERVAL_MS) {
      return busyRef.current || Promise.resolve();
    }
    if (busyRef.current) return busyRef.current;
    const p = (async () => {
      try {
        lastFetchTsRef.current = Date.now();
        const res = await fetch(`/api/orders?${query}`, { cache: "no-store" });
        if (!res.ok) return; // keep existing data on error
        const data = await res.json();
        const incoming = Array.isArray(data?.orders) ? (data.orders as Row[]) : [];
        // Only replace if we actually have data; otherwise keep last non-empty snapshot to avoid flicker
        if (incoming.length > 0) {
          setRows(incoming);
          // persist snapshot for this query
          try {
            if (typeof window !== 'undefined') {
              const key = `orders:last:${location.pathname}?${query}`;
              sessionStorage.setItem(key, JSON.stringify({ rows: incoming, ts: Date.now(), nextToken: data?.nextToken ?? null, isLastPage: Boolean(data?.isLastPage) }));
            }
          } catch {}
        }
        if (typeof data?.nextToken === "string" || data?.nextToken === null) setNextToken(data.nextToken ?? null);
        if (typeof data?.isLastPage === "boolean") setIsLastPage(!!data.isLastPage);
        setLastUpdatedAt(Date.now());
      } catch {
        // ignore; keep previous
      }
    })();
    busyRef.current = p.finally(() => { busyRef.current = null; });
    return busyRef.current;
  }, [query, disableClientFetch]);

  useEffect(() => {
    const handler = () => { fetchLatest(); };
    if (!disableClientFetch) {
      window.addEventListener("orders:refresh", handler as EventListener);
      return () => window.removeEventListener("orders:refresh", handler as EventListener);
    }
    return () => {};
  }, [fetchLatest, disableClientFetch]);

  // Also fetch once on params change
  // On mount or query change, seed from sessionStorage if SSR provided nothing
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        const raw = sessionStorage.getItem(`orders:last:${location.pathname}?${query}`);
        if (rows.length === 0 && raw) {
          const parsed = JSON.parse(raw) as { rows?: Row[]; ts?: number; nextToken?: string | null; isLastPage?: boolean };
          if (Array.isArray(parsed?.rows) && parsed.rows.length > 0) {
            setRows(parsed.rows);
            if (typeof parsed.nextToken === 'string' || parsed.nextToken === null) setNextToken(parsed.nextToken ?? null);
            if (typeof parsed.isLastPage === 'boolean') setIsLastPage(Boolean(parsed.isLastPage));
            if (typeof parsed.ts === 'number') setLastUpdatedAt(parsed.ts);
          }
        }
        // If we have SSR-provided rows (non-empty) and no cache yet, persist them immediately
        if (rows.length > 0) {
          const key = `orders:last:${location.pathname}?${query}`;
          const existing = sessionStorage.getItem(key);
          if (!existing) {
            try {
              sessionStorage.setItem(key, JSON.stringify({ rows, ts: Date.now(), nextToken, isLastPage }));
            } catch {}
          }
        }
      }
    } catch {}
    if (!disableClientFetch) fetchLatest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, fetchLatest, disableClientFetch]);

  // Whenever rows update to a non-empty list, persist snapshot for this query
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (rows.length === 0) return;
    try {
      const key = `orders:last:${location.pathname}?${query}`;
      sessionStorage.setItem(key, JSON.stringify({ rows, ts: Date.now(), nextToken, isLastPage }));
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, nextToken, isLastPage, query]);

  return (
    <div className="space-y-2">
      {/* Optional: last update timestamp for debugging */}
      <div className="text-xs text-slate-500">Updated: {new Date(lastUpdatedAt).toLocaleTimeString()}</div>
      <OrdersTable rows={rows} nextToken={nextToken} isLastPage={isLastPage} />
    </div>
  );
}
