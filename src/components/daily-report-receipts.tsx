"use client";

import { useEffect, useMemo, useState } from "react";

type DailyReportReceiptRow = {
  id: string;
  orderRef?: string | null;
  docType?: string | null;
  customerName?: string | null;
  attendantName?: string | null;
  total?: number | null;
  createdAt: string;
};

type Props = {
  date: string;
  attendantId: string | null | undefined;
};

const formatKES = (value?: number | null) =>
  `KES ${Number(value ?? 0).toLocaleString("en-KE", {
    maximumFractionDigits: 0,
  })}`;

const formatDateTime = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("en-KE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const toStartOfDayIso = (value?: string) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setUTCHours(0, 0, 0, 0);
  return date.toISOString();
};

const toEndOfDayIso = (value?: string) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setUTCHours(23, 59, 59, 999);
  return date.toISOString();
};

export default function DailyReportReceiptsPanel({ date, attendantId }: Props) {
  const [receipts, setReceipts] = useState<DailyReportReceiptRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    if (!attendantId) {
      setReceipts([]);
      setLoading(false);
      setError(null);
      return () => controller.abort();
    }

    const fetchReceipts = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        params.set("includeItems", "false");
        params.set("size", "80");
        const startIso = toStartOfDayIso(date);
        const endIso = toEndOfDayIso(date);
        if (startIso) params.set("start", startIso);
        if (endIso) params.set("end", endIso);
        if (attendantId) params.set("attendantId", attendantId);
        const res = await fetch(`/api/receipts?${params.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || "Failed to load receipts");
        if (!cancelled) {
          setReceipts(Array.isArray(data?.receipts) ? data.receipts : []);
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
  }, [date, attendantId]);

  const summary = useMemo(() => {
    const totalSales = receipts.reduce((sum, receipt) => sum + Number(receipt.total ?? 0), 0);
    return { totalSales, count: receipts.length };
  }, [receipts]);

  const displayDate = (() => {
    const parsed = new Date(date);
    if (date && !Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString("en-KE", { day: "2-digit", month: "short", year: "numeric" });
    }
    return "Selected date";
  })();

  return (
    <section id="my-receipts" className="rounded-3xl border border-slate-800 bg-slate-950/70 px-6 py-6 md:px-8">
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

      <div className="mt-5 space-y-3">
        {loading && <p className="text-xs text-slate-400">Loading receipts…</p>}
        {error && <div className="rounded-xl border border-rose-600/60 bg-rose-900/30 px-4 py-2 text-sm text-rose-200">{error}</div>}

        {!loading && !error && receipts.length === 0 && (
          <p className="text-sm text-slate-400">No receipts found for this date.</p>
        )}

        {!!receipts.length && (
          <div className="space-y-2">
            {receipts.map((receipt) => (
              <div
                key={receipt.id}
                className="flex items-center justify-between rounded-2xl border border-white/5 bg-slate-950/60 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-semibold text-white">{receipt.orderRef ?? receipt.docType ?? receipt.id}</p>
                  <p className="text-[11px] text-slate-400">{receipt.attendantName ?? "Attendant unknown"} · {formatDateTime(receipt.createdAt)}</p>
                  <p className="text-[11px] text-slate-500">{receipt.customerName ?? "-"} · {receipt.docType ?? "Receipt"}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-emerald-300">{formatKES(receipt.total)}</p>
                  {receipt.id ? (
                    <a href={`/receipts/${receipt.id}`} className="text-xs text-emerald-300 hover:text-emerald-200">View details</a>
                  ) : (
                    <span className="text-xs text-slate-500">Unavailable</span>
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
