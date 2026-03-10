"use client";

import { useEffect, useMemo, useState } from "react";

type DailyReportReceiptRow = {
  id: string;
  source?: "pos" | "marketing" | "support";
  orderRef?: string | null;
  docType?: string | null;
  customerName?: string | null;
  attendantName?: string | null;
  total?: number | null;
  createdAt: string;
  status?: string | null;
  paymentStatus?: string | null;
  isPodDelivery?: boolean;
  podDeliveryStatus?: string | null;
  podDeliveryNote?: string | null;
  detailUrl?: string | null;
};

type Props = {
  // start and end should be date strings (YYYY-MM-DD) or ISO date strings
  start?: string | null;
  end?: string | null;
  q?: string | null;
  attendantId: string | null | undefined;
  hideHeader?: boolean;
  onSummary?: (s: { totalSales: number; count: number }) => void;
  podFilter?: "all" | "pod" | "pod_pending";
  onPodFilterChange?: (next: "all" | "pod" | "pod_pending") => void;
  hidePodMenu?: boolean;
};

const formatKES = (value?: number | null) =>
  `KES ${Number(value ?? 0).toLocaleString("en-KE", {
    maximumFractionDigits: 0,
  })}`;

const locale = "en-KE";
const kenyaTimeZone = "Africa/Nairobi";

const formatDateTime = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: kenyaTimeZone,
  });
};

const NAIROBI_OFFSET_MS = 3 * 60 * 60 * 1000; // UTC+03:00

const toNairobiDayBoundaryIso = (value: string, boundary: "start" | "end") => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;

  // Build Nairobi-local day boundaries, then convert to UTC ISO.
  const h = boundary === "start" ? 0 : 23;
  const min = boundary === "start" ? 0 : 59;
  const s = boundary === "start" ? 0 : 59;
  const ms = boundary === "start" ? 0 : 999;
  const utcMillis = Date.UTC(year, month - 1, day, h, min, s, ms) - NAIROBI_OFFSET_MS;
  return new Date(utcMillis).toISOString();
};

const toStartOfDayIso = (value?: string) => {
  if (!value) return null;
  const nrb = toNairobiDayBoundaryIso(value, "start");
  if (nrb) return nrb;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setUTCHours(0, 0, 0, 0);
  return date.toISOString();
};

const toEndOfDayIso = (value?: string) => {
  if (!value) return null;
  const nrb = toNairobiDayBoundaryIso(value, "end");
  if (nrb) return nrb;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setUTCHours(23, 59, 59, 999);
  return date.toISOString();
};

export default function DailyReportReceiptsPanel({
  start,
  end,
  q,
  attendantId,
  hideHeader,
  onSummary,
  podFilter,
  onPodFilterChange,
  hidePodMenu,
}: Props) {
  const [receipts, setReceipts] = useState<DailyReportReceiptRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [localPodFilter, setLocalPodFilter] = useState<"all" | "pod" | "pod_pending">("all");
  const [lastFetchUrl, setLastFetchUrl] = useState<string | null>(null);
  const [lastFetchStatus, setLastFetchStatus] = useState<number | null>(null);
  const [lastFetchCount, setLastFetchCount] = useState<number | null>(null);
  const [localAttendantId, setLocalAttendantId] = useState<string | null | undefined>(attendantId);

  // sync localAttendantId when the prop changes
  useEffect(() => {
    setLocalAttendantId(attendantId);
  }, [attendantId]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    if (!localAttendantId) {
      // no attendantId yet — abort early. Ensure parent summary is reset so
      // the summary cards reflect zero until we resolve the session.
      setReceipts([]);
      setLoading(false);
      setError(null);
      setLastFetchUrl(null);
      setLastFetchStatus(null);
      setLastFetchCount(0);
      if (onSummary) onSummary({ totalSales: 0, count: 0 });
      return () => controller.abort();
    }

    const fetchReceipts = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        params.set("includeItems", "false");
        params.set("size", "80");
          const startIso = toStartOfDayIso(start ?? undefined);
          const endIso = toEndOfDayIso(end ?? undefined);
          if (startIso) params.set("start", startIso);
          if (endIso) params.set("end", endIso);
          if (q) params.set("q", q);
        const aid = localAttendantId ?? attendantId;
        if (aid) params.set("attendantId", aid);
        let url = `/api/receipts?${params.toString()}`;
        // If the developer adds `?useMockReceipts=1` to the URL, use a
        // local mock endpoint to verify UI/summary behavior without needing
        // a real database or session. This is intended for QA only.
        if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("useMockReceipts") === "1") {
          url = "/api/debug/receipts-mock";
        }
        // include credentials to ensure session cookie is sent
        const res = await fetch(url, {
          cache: "no-store",
          signal: controller.signal,
          credentials: "same-origin",
        });
        // debug info to help trace why an attendant may not see receipts
        // (will appear in the browser console)
        // eslint-disable-next-line no-console
        console.debug("[DailyReportReceipts] fetch", { attendantId, url, status: res.status });
        setLastFetchUrl(url);
        setLastFetchStatus(res.status);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || "Failed to load receipts");
        if (!cancelled) {
          const arr = Array.isArray(data?.receipts) ? data.receipts : [];
          setReceipts(arr);
          setLastFetchCount(arr.length);
          const totalSales = arr.reduce((s: number, r: DailyReportReceiptRow) => s + Number(r.total ?? 0), 0);
          if (onSummary) onSummary({ totalSales, count: arr.length });
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unable to load receipts");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchReceipts();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [start, end, q, localAttendantId, refreshTick]);

  const markPodDelivered = async (receipt: DailyReportReceiptRow) => {
    if (!receipt?.id || receipt.source !== "pos") return;
    setActionLoadingId(receipt.id);
    setError(null);
    try {
      const res = await fetch(`/api/receipts/${encodeURIComponent(receipt.id)}/pod-delivered`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ status: "delivered" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to mark POD as delivered");
      setRefreshTick((x) => x + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to mark POD as delivered");
    } finally {
      setActionLoadingId(null);
    }
  };

  // If we don't have an attendantId prop, try fetching the session to determine the logged-in user id
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    if (localAttendantId) return () => controller.abort();
    const fetchSession = async () => {
      try {
        const res = await fetch(`/api/debug/session`, { cache: "no-store", credentials: "same-origin", signal: controller.signal });
        if (!res.ok) return;
        const data = await res.json().catch(() => null);
        if (!cancelled && data?.user?.id) setLocalAttendantId(data.user.id);
      } catch (e) {
        // ignore
      }
    };
    fetchSession();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [localAttendantId]);

  const summary = useMemo(() => {
    const totalSales = receipts.reduce((sum, receipt) => sum + Number(receipt.total ?? 0), 0);
    return { totalSales, count: receipts.length };
  }, [receipts]);

  const effectivePodFilter = podFilter ?? localPodFilter;
  const setEffectivePodFilter = (next: "all" | "pod" | "pod_pending") => {
    if (onPodFilterChange) {
      onPodFilterChange(next);
      return;
    }
    setLocalPodFilter(next);
  };

  const filteredReceipts = useMemo(() => {
    if (effectivePodFilter === "all") return receipts;
    if (effectivePodFilter === "pod") return receipts.filter((r) => Boolean(r.isPodDelivery));
    return receipts.filter(
      (r) =>
        Boolean(r.isPodDelivery) &&
        (String(r.podDeliveryStatus || "pending").toLowerCase() === "pending"),
    );
  }, [effectivePodFilter, receipts]);

  const displayDate = (() => {
    if (start && end) {
      try {
        const s = new Date(start);
        const e = new Date(end);
        if (!Number.isNaN(s.getTime()) && s.toDateString() === e.toDateString()) {
          return s.toLocaleDateString(locale, {
            day: "2-digit",
            month: "short",
            year: "numeric",
            timeZone: kenyaTimeZone,
          });
        }
        return `${s.toLocaleDateString(locale, { timeZone: kenyaTimeZone })} - ${e.toLocaleDateString(locale, {
          timeZone: kenyaTimeZone,
        })}`;
      } catch (e) {
        return "Selected range";
      }
    }
    if (start) {
      const s = new Date(start);
      if (!Number.isNaN(s.getTime()))
        return s.toLocaleDateString(locale, {
          day: "2-digit",
          month: "short",
          year: "numeric",
          timeZone: kenyaTimeZone,
        });
    }
    return "Selected date";
  })();

  return (
    <section id="my-receipts" className="rounded-3xl border border-slate-800 bg-slate-950/70 px-6 py-6 md:px-8">
      {!hideHeader && (
        <>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] text-slate-400">My receipts</p>
              <h2 className="text-lg font-semibold text-white">{displayDate}</h2>
              <p className="text-sm text-slate-400">Showing receipts captured by you for this date.</p>
            </div>
            <div className="flex flex-col items-start gap-1 text-sm sm:items-end">
              <span className="text-[10px] uppercase tracking-[0.3em] text-slate-400">Count</span>
              <span className="text-xl font-semibold text-emerald-300">{summary.count}</span>
              <span className="text-[10px] uppercase tracking-[0.3em] text-slate-400">Sales</span>
              <span className="text-xl font-semibold text-white">{formatKES(summary.totalSales)}</span>
            </div>
          </div>

          {/* Debug panel visible when ?debugReceipts=1 is present in the URL */}
          {typeof window !== "undefined" && new URLSearchParams(window.location.search).get("debugReceipts") === "1" && (
            <div className="mt-4 rounded-lg border border-yellow-500/40 bg-yellow-900/10 p-3 text-sm text-yellow-200">
              <div className="mb-1 text-xs text-yellow-300">Debug: Receipts fetch</div>
              <div>AttendantId (prop): <span className="font-mono">{String(attendantId)}</span></div>
              <div>AttendantId (resolved): <span className="font-mono">{String(localAttendantId ?? "-")}</span></div>
              <div>Last status: <span className="font-mono">{String(lastFetchStatus ?? "-")}</span></div>
              <div>Last count: <span className="font-mono">{String(lastFetchCount ?? "-")}</span></div>
              <div className="truncate">Last URL: <span className="font-mono">{String(lastFetchUrl ?? "-")}</span></div>
            </div>
          )}
        </>
      )}

      <div className="mt-5 space-y-3">
        {!hidePodMenu && (
          <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setEffectivePodFilter("all")}
            className={`rounded-full border px-3 py-1 text-xs uppercase tracking-wide transition ${
              effectivePodFilter === "all"
                ? "border-emerald-500 bg-emerald-500/20 text-emerald-200"
                : "border-white/15 text-slate-200 hover:border-emerald-500 hover:text-white"
            }`}
          >
            All receipts
          </button>
          <button
            type="button"
            onClick={() => setEffectivePodFilter("pod")}
            className={`rounded-full border px-3 py-1 text-xs uppercase tracking-wide transition ${
              effectivePodFilter === "pod"
                ? "border-emerald-500 bg-emerald-500/20 text-emerald-200"
                : "border-white/15 text-slate-200 hover:border-emerald-500 hover:text-white"
            }`}
          >
            POD receipts
          </button>
          <button
            type="button"
            onClick={() => setEffectivePodFilter("pod_pending")}
            className={`rounded-full border px-3 py-1 text-xs uppercase tracking-wide transition ${
              effectivePodFilter === "pod_pending"
                ? "border-emerald-500 bg-emerald-500/20 text-emerald-200"
                : "border-white/15 text-slate-200 hover:border-emerald-500 hover:text-white"
            }`}
          >
            POD pending
          </button>
          </div>
        )}

        {loading && <p className="text-xs text-slate-400">Loading receipts…</p>}
        {error && <div className="rounded-xl border border-rose-600/60 bg-rose-900/30 px-4 py-2 text-sm text-rose-200">{error}</div>}

        {!loading && !error && filteredReceipts.length === 0 && (
          <p className="text-sm text-slate-400">No receipts found for this date.</p>
        )}

        {!!filteredReceipts.length && (
          <div className="space-y-2">
            {filteredReceipts.map((receipt) => (
              <div
                key={receipt.id}
                className="flex items-center justify-between rounded-3xl border border-white/5 bg-slate-900/60 px-6 py-4 shadow-md"
              >
                <div>
                      <p className="text-lg font-semibold text-white">{receipt.orderRef ?? receipt.docType ?? receipt.id}</p>
                      <p className="mt-1 text-[12px] text-slate-400">{receipt.attendantName ?? "Attendant unknown"} · {formatDateTime(receipt.createdAt)}</p>
                      <p className="mt-1 text-[12px] text-slate-500">{receipt.customerName ?? "-"} · {receipt.docType ?? "Receipt"}</p>
                      {receipt.isPodDelivery && (
                        <p className="mt-1 text-[12px] text-amber-300">
                          POD: {(receipt.podDeliveryStatus || "pending").toString().toUpperCase()}
                          {receipt.podDeliveryNote ? ` · ${receipt.podDeliveryNote}` : ""}
                        </p>
                      )}
                </div>
                <div className="text-right">
                  <p className="text-lg font-semibold text-emerald-300">{formatKES(receipt.total)}</p>
                  {receipt.detailUrl ? (
                    <a href={receipt.detailUrl} target="_blank" rel="noopener noreferrer" className="inline-block mt-2 text-xs uppercase text-emerald-300 hover:text-emerald-200">View details</a>
                  ) : receipt.source === "pos" && receipt.id ? (
                    <a href={`/receipts/print/${receipt.id}`} target="_blank" rel="noopener noreferrer" className="inline-block mt-2 text-xs uppercase text-emerald-300 hover:text-emerald-200">View details</a>
                  ) : (
                    <span className="text-xs text-slate-500">Unavailable</span>
                  )}
                  {receipt.source === "pos" && receipt.isPodDelivery && (receipt.podDeliveryStatus || "pending").toLowerCase() === "pending" && (
                    <button
                      type="button"
                      disabled={actionLoadingId === receipt.id}
                      onClick={() => markPodDelivered(receipt)}
                      className="mt-2 block w-full rounded-lg border border-amber-500/60 px-3 py-1 text-xs font-semibold uppercase text-amber-200 hover:bg-amber-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {actionLoadingId === receipt.id ? "Marking..." : "Mark delivered"}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
