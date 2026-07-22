"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { buildAdminCustomerProfileHref } from "@/lib/adminCustomerProfileLinks";

type DailyReportReceiptRow = {
  id: string;
  source?: "pos" | "marketing" | "support";
  orderRef?: string | null;
  receiptNumber?: string | null;
  docType?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
  attendantName?: string | null;
  total?: number | null;
  createdAt: string;
  status?: string | null;
  paymentStatus?: string | null;
  isPodDelivery?: boolean;
  podDeliveryStatus?: string | null;
  podDeliveryNote?: string | null;
  podEvidenceUrl?: string | null;
  podDeliveryFee?: number | null;
  detailUrl?: string | null;
  isProjectReceipt?: boolean;
  projectStage?: string | null;
  projectPaymentStatus?: string | null;
};

type PodFilterValue = "all" | "normal_only" | "settled" | "pod_pending" | "pod_delivered" | "pod_failed";

type ExtraFilterAction = {
  key: string;
  label: string;
  active?: boolean;
  onClick: () => void;
};

type Props = {
  // start and end should be date strings (YYYY-MM-DD) or ISO date strings
  start?: string | null;
  end?: string | null;
  q?: string | null;
  attendantId: string | null | undefined;
  hideHeader?: boolean;
  onlyPos?: boolean;
  paidOnly?: boolean;
  includeLedger?: boolean;
  title?: string;
  subtitle?: string;
  emptyMessage?: string;
  showPodFilters?: boolean;
  initialPodFilter?: PodFilterValue;
  extraFilterActions?: ExtraFilterAction[];
  onSummary?: (s: { totalSales: number; count: number }) => void;
  carryForwardPending?: boolean;
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

const formatProjectStageLabel = (value?: string | null) => {
  switch (String(value ?? "").trim().toUpperCase()) {
    case "RECEIPT_CREATED":
      return "Receipt created";
    case "PROJECT_IN_PROGRESS":
      return "Project in progress";
    case "COMPLETED_POSTED":
      return "Completed and posted";
    default:
      return null;
  }
};

function buildCustomerProfileHref(receipt: Pick<DailyReportReceiptRow, "customerName" | "customerPhone" | "customerEmail">) {
  return buildAdminCustomerProfileHref({
    phone: receipt.customerPhone,
    email: receipt.customerEmail,
    displayName: receipt.customerName,
  });
}

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
  onlyPos = false,
  paidOnly = false,
  includeLedger,
  title,
  subtitle,
  emptyMessage,
  showPodFilters = false,
  initialPodFilter = "all",
  extraFilterActions = [],
  onSummary,
  carryForwardPending = false,
}: Props) {
  const [receipts, setReceipts] = useState<DailyReportReceiptRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchUrl, setLastFetchUrl] = useState<string | null>(null);
  const [lastFetchStatus, setLastFetchStatus] = useState<number | null>(null);
  const [lastFetchCount, setLastFetchCount] = useState<number | null>(null);
  const [sessionAttendantId, setSessionAttendantId] = useState<string | null>(null);
  const [debouncedQuery, setDebouncedQuery] = useState(() => q?.trim() ?? "");
  const [podFilter, setPodFilter] = useState<PodFilterValue>(initialPodFilter);
  const [podActionReceipt, setPodActionReceipt] = useState<DailyReportReceiptRow | null>(null);
  const [podActionStatus, setPodActionStatus] = useState<"delivered" | "delivery_failed">("delivered");
  const [podActionReason, setPodActionReason] = useState("");
  const [podEvidenceUrl, setPodEvidenceUrl] = useState("");
  const [podEvidenceFileName, setPodEvidenceFileName] = useState("");
  const [podDeliveryFee, setPodDeliveryFee] = useState("");
  const [podUploading, setPodUploading] = useState(false);
  const [podSaving, setPodSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [feeReceipt, setFeeReceipt] = useState<DailyReportReceiptRow | null>(null);
  const [feeAmount, setFeeAmount] = useState("");
  const [feeNote, setFeeNote] = useState("");
  const [feeSaving, setFeeSaving] = useState(false);
  const [feeError, setFeeError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const onSummaryRef = useRef(onSummary);
  const lastRequestKeyRef = useRef<string | null>(null);
  const lastRequestAtRef = useRef(0);

  useEffect(() => {
    onSummaryRef.current = onSummary;
  }, [onSummary]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(q?.trim() ?? "");
    }, 300);
    return () => window.clearTimeout(timer);
  }, [q]);

  useEffect(() => {
    setPodFilter(initialPodFilter);
  }, [initialPodFilter]);

  const resolvedAttendantId = attendantId ?? sessionAttendantId ?? null;

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    if (!resolvedAttendantId) {
      // no attendantId yet — abort early. Ensure parent summary is reset so
      // the summary cards reflect zero until we resolve the session.
      setReceipts([]);
      setLoading(false);
      setError(null);
      setLastFetchUrl(null);
      setLastFetchStatus(null);
      setLastFetchCount(0);
      onSummaryRef.current?.({ totalSales: 0, count: 0 });
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
        if (startIso && !carryForwardPending) params.set("start", startIso);
        if (endIso && !carryForwardPending) params.set("end", endIso);
        if (debouncedQuery) params.set("q", debouncedQuery);
        params.set("scope", "mine");
        if (carryForwardPending) params.set("carryForwardPending", "1");
        const settledOnly = podFilter === "settled";
        if (onlyPos) params.set("onlyPos", "1");
        if (paidOnly || settledOnly) params.set("paidOnly", "1");
        if (podFilter === "normal_only") {
          params.set("customerType", "normal");
        } else if (podFilter === "pod_pending") {
          params.set("customerType", "pod");
          params.set("status", "pending");
        } else if (podFilter === "pod_delivered") {
          params.set("customerType", "pod");
          params.set("status", "delivered");
        } else if (podFilter === "pod_failed") {
          params.set("customerType", "pod");
          params.set("status", "delivery_failed");
        }
        if (typeof includeLedger === "boolean") params.set("includeLedger", includeLedger ? "true" : "false");
        params.set("attendantId", resolvedAttendantId);
        let url = `/api/receipts?${params.toString()}`;
        // If the developer adds `?useMockReceipts=1` to the URL, use a
        // local mock endpoint to verify UI/summary behavior without needing
        // a real database or session. This is intended for QA only.
        if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("useMockReceipts") === "1") {
          url = "/api/debug/receipts-mock";
        }
        const requestKey = `${reloadKey}:${url}`;
        const now = Date.now();
        if (lastRequestKeyRef.current === requestKey && now - lastRequestAtRef.current < 1500) {
          return;
        }
        lastRequestKeyRef.current = requestKey;
        lastRequestAtRef.current = now;
        // include credentials to ensure session cookie is sent
        const res = await fetch(url, {
          cache: "no-store",
          signal: controller.signal,
          credentials: "same-origin",
        });
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
          onSummaryRef.current?.({ totalSales, count: arr.length });
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
  }, [attendantId, carryForwardPending, debouncedQuery, includeLedger, onlyPos, paidOnly, podFilter, reloadKey, resolvedAttendantId, start, end]);

  // If we don't have an attendantId prop, try fetching the session to determine the logged-in user id
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    if (attendantId || sessionAttendantId) return () => controller.abort();
    const fetchSession = async () => {
      try {
        const res = await fetch(`/api/debug/session`, { cache: "no-store", credentials: "same-origin", signal: controller.signal });
        if (!res.ok) return;
        const data = await res.json().catch(() => null);
        if (!cancelled && data?.user?.id) setSessionAttendantId(data.user.id);
      } catch {
        // ignore
      }
    };
    fetchSession();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [attendantId, sessionAttendantId]);

  const summary = useMemo(() => {
    const totalSales = receipts.reduce((sum, receipt) => sum + Number(receipt.total ?? 0), 0);
    return { totalSales, count: receipts.length };
  }, [receipts]);

  const openPodAction = (receipt: DailyReportReceiptRow) => {
    setPodActionReceipt(receipt);
    setPodActionStatus("delivered");
    setPodActionReason("");
    setPodEvidenceUrl(receipt.podEvidenceUrl ?? "");
    setPodEvidenceFileName("");
    setPodDeliveryFee(receipt.podDeliveryFee != null ? String(receipt.podDeliveryFee) : "");
    setActionError(null);
  };

  const closePodAction = () => {
    if (podUploading || podSaving) return;
    setPodActionReceipt(null);
    setActionError(null);
  };

  const uploadEvidence = async (file: File) => {
    setPodUploading(true);
    setActionError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/receipts/pod-evidence-upload", {
        method: "POST",
        body: form,
        credentials: "same-origin",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to upload evidence");
      }
      setPodEvidenceUrl(typeof payload?.url === "string" ? payload.url : "");
      setPodEvidenceFileName(file.name);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to upload evidence");
    } finally {
      setPodUploading(false);
    }
  };

  const submitPodAction = async () => {
    if (!podActionReceipt) return;
    setPodSaving(true);
    setActionError(null);
    try {
      const response = await fetch(`/api/receipts/${podActionReceipt.id}/pod-delivered`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          status: podActionStatus,
          reason: podActionReason.trim() || undefined,
          evidenceUrl: podEvidenceUrl.trim() || undefined,
          evidenceFileName: podEvidenceFileName.trim() || undefined,
          deliveryFee: podDeliveryFee.trim() === "" ? undefined : Number(podDeliveryFee),
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to update POD delivery");
      }
      setPodActionReceipt(null);
      setReloadKey((current) => current + 1);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to update POD delivery");
    } finally {
      setPodSaving(false);
    }
  };

  const openFeeAction = (receipt: DailyReportReceiptRow) => {
    setFeeReceipt(receipt);
    setFeeAmount(receipt.podDeliveryFee != null ? String(receipt.podDeliveryFee) : "");
    setFeeNote("");
    setFeeError(null);
  };

  const closeFeeAction = () => {
    if (feeSaving) return;
    setFeeReceipt(null);
    setFeeError(null);
  };

  const submitDeliveryFee = async () => {
    if (!feeReceipt) return;
    const parsed = Number(feeAmount);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setFeeError("Enter a valid delivery fee amount.");
      return;
    }
    setFeeSaving(true);
    setFeeError(null);
    try {
      const response = await fetch(`/api/receipts/${feeReceipt.id}/pod-delivery-fee`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          amount: parsed,
          note: feeNote.trim() || undefined,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to save delivery fee");
      }
      setFeeReceipt(null);
      setReloadKey((current) => current + 1);
    } catch (err) {
      setFeeError(err instanceof Error ? err.message : "Failed to save delivery fee");
    } finally {
      setFeeSaving(false);
    }
  };

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
      } catch {
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
              <h2 className="text-lg font-semibold text-white">{title ?? displayDate}</h2>
              <p className="text-sm text-slate-400">
                {subtitle ?? "Showing receipts captured by you for this date."}
              </p>
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
              <div>AttendantId (resolved): <span className="font-mono">{String(resolvedAttendantId ?? "-")}</span></div>
              <div>Last status: <span className="font-mono">{String(lastFetchStatus ?? "-")}</span></div>
              <div>Last count: <span className="font-mono">{String(lastFetchCount ?? "-")}</span></div>
              <div className="truncate">Last URL: <span className="font-mono">{String(lastFetchUrl ?? "-")}</span></div>
            </div>
          )}
        </>
      )}

      <div className="mt-5 space-y-3">
        {showPodFilters && (
          <div className="flex flex-wrap gap-2">
            {extraFilterActions.map((action) => (
              <button
                key={action.key}
                type="button"
                onClick={action.onClick}
                className={`rounded-full border px-4 py-1 text-[11px] font-semibold uppercase tracking-wide transition ${
                  action.active
                    ? "border-emerald-500 bg-emerald-500/20 text-emerald-200"
                    : "border-white/15 text-slate-200 hover:border-emerald-500 hover:text-white"
                }`}
              >
                {action.label}
              </button>
            ))}
            {[
              { key: "all", label: onlyPos ? "All POS receipts" : "All receipts" },
              { key: "normal_only", label: "Normal only" },
              { key: "settled", label: "Settled receipts" },
              { key: "pod_pending", label: "POD pending" },
              { key: "pod_delivered", label: "POD delivered" },
              { key: "pod_failed", label: "POD failed" },
            ].map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setPodFilter(option.key as PodFilterValue)}
                className={`rounded-full border px-4 py-1 text-[11px] font-semibold uppercase tracking-wide transition ${
                  podFilter === option.key
                    ? "border-emerald-500 bg-emerald-500/20 text-emerald-200"
                    : "border-white/15 text-slate-200 hover:border-emerald-500 hover:text-white"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
        {loading && <p className="text-xs text-slate-400">Loading receipts…</p>}
        {error && <div className="rounded-xl border border-rose-600/60 bg-rose-900/30 px-4 py-2 text-sm text-rose-200">{error}</div>}

        {!loading && !error && receipts.length === 0 && (
          <p className="text-sm text-slate-400">{emptyMessage ?? "No receipts found for this date."}</p>
        )}

        {!!receipts.length && (
          <div className="space-y-2">
            {receipts.map((receipt) => {
              const customerProfileHref = buildCustomerProfileHref(receipt);
              const projectStageLabel = receipt.isProjectReceipt ? formatProjectStageLabel(receipt.projectStage) : null;
              const projectPaymentLabel = receipt.isProjectReceipt
                ? String(receipt.projectPaymentStatus ?? "").replace(/_/g, " ").trim()
                : "";
              return (
              <div
                key={receipt.id}
                className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4"
              >
                <div className="grid gap-3 lg:grid-cols-[140px_1.3fr_1fr_160px_140px_150px] lg:items-center">
                  <div>
                    <span
                      className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${
                        receipt.isPodDelivery
                          ? "border-yellow-400/30 bg-yellow-500/10 text-yellow-200"
                          : "border-sky-400/25 bg-sky-400/10 text-sky-100"
                      }`}
                    >
                      {receipt.isPodDelivery ? "POD" : "POS"}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <Link href={customerProfileHref} className="font-semibold text-white transition hover:text-cyan-200">
                      {receipt.customerName ?? "-"}
                    </Link>
                    <div className="mt-1 text-xs text-slate-400">{receipt.customerPhone || "-"}</div>
                    <div className="mt-1 text-xs text-slate-500">{receipt.orderRef ?? receipt.receiptNumber ?? receipt.docType ?? receipt.id}</div>
                  </div>
                  <div className="text-sm text-slate-300">
                    <div>{receipt.docType ?? "Receipt"}</div>
                    <div className="mt-1 text-xs text-slate-500">{receipt.attendantName ?? "Attendant unknown"}</div>
                  </div>
                  <div>
                    <div className="font-semibold text-emerald-300">{formatKES(receipt.total)}</div>
                    {receipt.isPodDelivery && receipt.podDeliveryFee != null ? (
                      <div className="mt-1 text-xs text-emerald-200">Fee {formatKES(receipt.podDeliveryFee)}</div>
                    ) : (
                      <div className="mt-1 text-xs text-slate-500">{receipt.customerEmail || "No email"}</div>
                    )}
                  </div>
                  <div>
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] ${
                        projectStageLabel
                          ? "border border-amber-400/30 bg-amber-500/10 text-amber-100"
                          : "border border-white/10 bg-white/[0.03] text-slate-200"
                      }`}
                    >
                      {receipt.isPodDelivery
                        ? `POD ${String(receipt.podDeliveryStatus ?? "pending").replace(/_/g, " ")}`
                        : projectStageLabel ?? String(receipt.paymentStatus ?? receipt.status ?? "open").replace(/_/g, " ")}
                    </span>
                    {projectStageLabel && projectPaymentLabel ? (
                      <div className="mt-2 text-[11px] uppercase tracking-[0.12em] text-slate-500">
                        Payment {projectPaymentLabel}
                      </div>
                    ) : null}
                    <div className="mt-2 text-xs text-slate-500">{formatDateTime(receipt.createdAt)}</div>
                  </div>
                  <div className="flex flex-wrap gap-2 lg:justify-end">
                    {receipt.isPodDelivery && String(receipt.podDeliveryStatus ?? "").toLowerCase() === "pending" && receipt.source === "pos" ? (
                      <button
                        type="button"
                        onClick={() => openPodAction(receipt)}
                        className="rounded-full border border-yellow-400/30 bg-yellow-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-yellow-100 hover:bg-yellow-500/20"
                      >
                        Mark POD delivered
                      </button>
                    ) : null}
                    {receipt.isPodDelivery && receipt.source === "pos" ? (
                      <button
                        type="button"
                        onClick={() => openFeeAction(receipt)}
                        className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-100 hover:bg-emerald-500/20"
                      >
                        {receipt.podDeliveryFee != null ? "Edit delivery fee" : "Add delivery fee"}
                      </button>
                    ) : null}
                    {receipt.detailUrl ? (
                      <a href={receipt.detailUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-100 transition hover:border-white/25 hover:bg-white/[0.06]">Open receipt</a>
                    ) : receipt.source === "pos" && receipt.id ? (
                      <a href={`/receipts/${receipt.id}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-100 transition hover:border-white/25 hover:bg-white/[0.06]">Open receipt</a>
                    ) : (
                      <span className="text-xs text-slate-500">Unavailable</span>
                    )}
                    <Link href={customerProfileHref} className="inline-flex items-center rounded-full border border-cyan-400/30 bg-cyan-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-cyan-100 transition hover:border-cyan-300/30 hover:bg-cyan-500/20">
                      Open customer
                    </Link>
                  </div>
                </div>
                {receipt.podDeliveryNote ? (
                  <p className="mt-3 text-xs text-yellow-200">{receipt.podDeliveryNote}</p>
                ) : null}
                {receipt.podEvidenceUrl ? (
                  <a href={receipt.podEvidenceUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs text-emerald-300 underline">
                    View POD evidence
                  </a>
                ) : null}
              </div>
            );
            })}
          </div>
        )}
      </div>
      {podActionReceipt ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-slate-950 p-6 shadow-2xl shadow-black/60">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">POD update</p>
                <h3 className="mt-1 text-xl font-semibold text-white">{podActionReceipt.orderRef ?? podActionReceipt.receiptNumber ?? podActionReceipt.id}</h3>
                <p className="mt-2 text-sm text-slate-400">Record the delivery outcome and attach proof if available.</p>
              </div>
              <button type="button" onClick={closePodAction} className="rounded-full border border-white/10 px-3 py-1 text-sm text-slate-300 hover:bg-white/10">
                Close
              </button>
            </div>
            <div className="mt-5 space-y-4">
              <label className="block text-xs uppercase tracking-wide text-slate-400">
                Outcome
                <select
                  value={podActionStatus}
                  onChange={(event) => setPodActionStatus(event.target.value as "delivered" | "delivery_failed")}
                  className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="delivered">Delivered</option>
                  <option value="delivery_failed">Delivery failed</option>
                </select>
              </label>
              <label className="block text-xs uppercase tracking-wide text-slate-400">
                Reason or note
                <textarea
                  value={podActionReason}
                  onChange={(event) => setPodActionReason(event.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  placeholder="Optional delivery note"
                />
              </label>
              <label className="block text-xs uppercase tracking-wide text-slate-400">
                Attach evidence
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void uploadEvidence(file);
                  }}
                  className="mt-1 block w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100"
                />
              </label>
              <label className="block text-xs uppercase tracking-wide text-slate-400">
                Delivery fee
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={podDeliveryFee}
                  onChange={(event) => setPodDeliveryFee(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  placeholder="Optional delivery fee in KES"
                />
              </label>
              {podUploading ? <p className="text-xs text-slate-400">Uploading evidence...</p> : null}
              {podEvidenceUrl ? (
                <a href={podEvidenceUrl} target="_blank" rel="noreferrer" className="inline-block text-sm text-emerald-300 underline">
                  {podEvidenceFileName || "View uploaded evidence"}
                </a>
              ) : null}
              {actionError ? <div className="rounded-xl border border-rose-600/60 bg-rose-900/30 px-4 py-2 text-sm text-rose-200">{actionError}</div> : null}
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={closePodAction}
                disabled={podUploading || podSaving}
                className="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-200 hover:bg-white/5 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void submitPodAction()}
                disabled={podUploading || podSaving}
                className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-black hover:brightness-95 disabled:opacity-60"
              >
                {podSaving ? "Saving..." : "Save POD update"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {feeReceipt ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-950 p-6 shadow-2xl shadow-black/60">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">POD delivery fee</p>
                <h3 className="mt-1 text-xl font-semibold text-white">{feeReceipt.orderRef ?? feeReceipt.receiptNumber ?? feeReceipt.id}</h3>
                <p className="mt-2 text-sm text-slate-400">Save the delivery charge so POD profit is reduced by the correct amount.</p>
              </div>
              <button type="button" onClick={closeFeeAction} className="rounded-full border border-white/10 px-3 py-1 text-sm text-slate-300 hover:bg-white/10">
                Close
              </button>
            </div>
            <div className="mt-5 space-y-4">
              <label className="block text-xs uppercase tracking-wide text-slate-400">
                Delivery fee amount
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={feeAmount}
                  onChange={(event) => setFeeAmount(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  placeholder="KES 0"
                />
              </label>
              <label className="block text-xs uppercase tracking-wide text-slate-400">
                Note
                <textarea
                  value={feeNote}
                  onChange={(event) => setFeeNote(event.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  placeholder="Optional fee note"
                />
              </label>
              {feeError ? <div className="rounded-xl border border-rose-600/60 bg-rose-900/30 px-4 py-2 text-sm text-rose-200">{feeError}</div> : null}
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeFeeAction}
                disabled={feeSaving}
                className="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-200 hover:bg-white/5 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void submitDeliveryFee()}
                disabled={feeSaving}
                className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-black hover:brightness-95 disabled:opacity-60"
              >
                {feeSaving ? "Saving..." : "Save delivery fee"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
