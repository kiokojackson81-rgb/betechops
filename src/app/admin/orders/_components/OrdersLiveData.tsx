"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import OrdersTable from "./OrdersTable";
import type { OrdersRow } from "../_lib/types";

type Props = {
  initialRows: OrdersRow[];
  initialNextToken: string | null;
  initialIsLastPage: boolean;
  params: {
    status?: string;
    country?: string;
    shopId?: string;
    dateFrom?: string;
    dateTo?: string;
    q?: string;
    size?: string;
  };
  // When true, prefer cached data pulled from the synced DB instead of vendor API.
  disableClientFetch?: boolean;
};

export default function OrdersLiveData({
  initialRows,
  initialNextToken,
  initialIsLastPage,
  params,
  disableClientFetch = false,
}: Props) {
  const [rows, setRows] = useState<OrdersRow[]>(initialRows ?? []);
  const [nextToken, setNextToken] = useState<string | null>(initialNextToken ?? null);
  const [isLastPage, setIsLastPage] = useState<boolean>(initialIsLastPage ?? true);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number>(() => Date.now());
  const [lastUpdatedLabel, setLastUpdatedLabel] = useState<string>('—');
  const busyRef = useRef<Promise<void> | null>(null);
  const lastFetchTsRef = useRef<number>(0);
  const MIN_INTERVAL_MS = 2500;
  const freshOnceRef = useRef<boolean>(false);

  const query = useMemo(() => {
    const qs = new URLSearchParams();
    if (params.status && params.status !== "ALL") qs.set("status", params.status);
    if (params.country) qs.set("country", params.country);
    if (params.shopId) qs.set("shopId", params.shopId);
    if (params.dateFrom) qs.set("dateFrom", params.dateFrom);
    if (params.dateTo) qs.set("dateTo", params.dateTo);
    if (params.q) qs.set("q", params.q);
    if (params.size) qs.set("size", params.size);
    return qs.toString();
  }, [params.status, params.country, params.shopId, params.dateFrom, params.dateTo, params.q, params.size]);

  const storageKey = useMemo(() => {
    const base = disableClientFetch ? "orders:synced" : "orders:last";
    const path = typeof window !== "undefined" ? window.location.pathname : "";
    return `${base}:${path}?${query}`;
  }, [query, disableClientFetch]);

  const fetchLatest = useCallback(async () => {
    const now = Date.now();
    if (now - lastFetchTsRef.current < MIN_INTERVAL_MS) {
      return busyRef.current || Promise.resolve();
    }
    if (busyRef.current) return busyRef.current;

    const promise = (async () => {
      try {
        lastFetchTsRef.current = Date.now();
        const endpoint = disableClientFetch ? "/api/orders/synced" : "/api/orders";
        // If a manual refresh was requested (e.g., after actions), bypass in-memory cache once using fresh=1
        const freshParam = (!disableClientFetch && freshOnceRef.current) ? (query ? `${query}&fresh=1` : `fresh=1`) : query;
        const res = await fetch(`${endpoint}?${freshParam}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        const incoming = Array.isArray(data?.orders) ? (data.orders as OrdersRow[]) : [];

        const shouldReplaceOnEmpty = disableClientFetch;
        if (incoming.length > 0 || shouldReplaceOnEmpty) {
          setRows(incoming);
          try {
            if (typeof window !== "undefined") {
              sessionStorage.setItem(
                storageKey,
                JSON.stringify({
                  rows: incoming,
                  ts: Date.now(),
                  nextToken: disableClientFetch ? null : data?.nextToken ?? null,
                  isLastPage: disableClientFetch ? true : Boolean(data?.isLastPage),
                }),
              );
            }
          } catch {
            // ignore storage errors
          }
        }

        if (disableClientFetch) {
          setNextToken(null);
          setIsLastPage(true);
        } else {
          if (typeof data?.nextToken === "string" || data?.nextToken === null) {
            setNextToken(data.nextToken ?? null);
          }
          if (typeof data?.isLastPage === "boolean") {
            setIsLastPage(Boolean(data.isLastPage));
          }
        }
        setLastUpdatedAt(Date.now());
      } catch {
        // keep prior snapshot on failure
      }
    })();

    busyRef.current = promise.finally(() => {
      busyRef.current = null;
    });
    return busyRef.current;
  }, [disableClientFetch, query, storageKey]);

  useEffect(() => {
    setLastUpdatedLabel(
      new Date(lastUpdatedAt).toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
    );
  }, [lastUpdatedAt]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = () => {
      // mark next fetch as fresh to bypass short-lived cache
      freshOnceRef.current = true;
      fetchLatest().finally(() => {
        freshOnceRef.current = false;
      });
    };
    window.addEventListener("orders:refresh", handler as EventListener);
    return () => {
      window.removeEventListener("orders:refresh", handler as EventListener);
    };
  }, [fetchLatest]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const raw = sessionStorage.getItem(storageKey);
        if (rows.length === 0 && raw) {
          const parsed = JSON.parse(raw) as {
            rows?: OrdersRow[];
            ts?: number;
            nextToken?: string | null;
            isLastPage?: boolean;
          };
          if (Array.isArray(parsed?.rows)) {
            setRows(parsed.rows);
            if (typeof parsed.nextToken === "string" || parsed.nextToken === null) {
              setNextToken(parsed.nextToken ?? null);
            }
            if (typeof parsed.isLastPage === "boolean") {
              setIsLastPage(Boolean(parsed.isLastPage));
            }
            if (typeof parsed.ts === "number") {
              setLastUpdatedAt(parsed.ts);
            }
          }
        }
      } catch {
        // ignore storage errors
      }
    }
    fetchLatest();
  }, [query, disableClientFetch, storageKey, fetchLatest]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (rows.length === 0 && !disableClientFetch) return;
    try {
      sessionStorage.setItem(
        storageKey,
        JSON.stringify({ rows, ts: Date.now(), nextToken, isLastPage }),
      );
    } catch {
      // ignore storage errors
    }
  }, [rows, nextToken, isLastPage, storageKey, disableClientFetch]);

  return (
    <div className="space-y-2">
      <div className="text-xs text-slate-500">Updated: {lastUpdatedLabel}</div>
      <OrdersTable rows={rows} nextToken={nextToken} isLastPage={isLastPage} />
    </div>
  );
}
