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
};

export default function OrdersLiveData({ initialRows, initialNextToken, initialIsLastPage, params }: Props) {
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
  }, [query]);

  useEffect(() => {
    const handler = () => { fetchLatest(); };
    window.addEventListener("orders:refresh", handler as EventListener);
    return () => window.removeEventListener("orders:refresh", handler as EventListener);
  }, [fetchLatest]);

  // Also fetch once on params change
  useEffect(() => { fetchLatest(); }, [query, fetchLatest]);

  return (
    <div className="space-y-2">
      {/* Optional: last update timestamp for debugging */}
      <div className="text-xs text-slate-500">Updated: {new Date(lastUpdatedAt).toLocaleTimeString()}</div>
      <OrdersTable rows={rows} nextToken={nextToken} isLastPage={isLastPage} />
    </div>
  );
}
