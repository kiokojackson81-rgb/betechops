"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Loader2, RefreshCcw } from "lucide-react";
import {
  QUOTE_REQUEST_STATUSES,
  type QuoteRequestStatus,
  type SerializedQuoteRequest,
} from "@/lib/quoteRequests";

type QuoteRequestStatusFilter = "ALL" | QuoteRequestStatus;

type Props = {
  apiBasePath: string;
  apiQueryParams?: Record<string, string | null | undefined>;
  defaultStatusFilter?: QuoteRequestStatusFilter;
  filterStorageKey?: string;
  deskTitle?: string;
  deskDescription?: string;
  emptyMessage?: string;
};

const STATUS_OPTIONS: QuoteRequestStatusFilter[] = ["ALL", ...QUOTE_REQUEST_STATUSES];

function buildApiUrl(
  apiBasePath: string,
  apiQueryParams: Props["apiQueryParams"],
  pathSuffix = "",
  extraParams?: Record<string, string>,
) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(apiQueryParams ?? {})) {
    if (value) params.set(key, value);
  }
  for (const [key, value] of Object.entries(extraParams ?? {})) {
    if (value) params.set(key, value);
  }
  const suffix = pathSuffix ? `/${pathSuffix.replace(/^\/+/, "")}` : "";
  const queryString = params.toString();
  return `${apiBasePath}${suffix}${queryString ? `?${queryString}` : ""}`;
}

function formatDateTime(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("en-KE");
}

function formatStatus(value: string) {
  return value.replace(/_/g, " ");
}

function normalizeRecommendedProducts(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
}

export default function QuotationRequestsDeskClient({
  apiBasePath,
  apiQueryParams,
  defaultStatusFilter = "NEW",
  filterStorageKey,
  deskTitle = "Assigned quotation requests",
  deskDescription = "Review customer quote requests, recommend products, and notify customers by email or SMS.",
  emptyMessage = "No quotation requests assigned right now.",
}: Props) {
  const [requests, setRequests] = useState<SerializedQuoteRequest[]>([]);
  const [statusFilter, setStatusFilter] = useState<QuoteRequestStatusFilter>(defaultStatusFilter);
  const [query, setQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const expandedRequest = useMemo(
    () => requests.find((request) => request.id === expandedId) ?? null,
    [requests, expandedId],
  );

  const [formState, setFormState] = useState({
    status: defaultStatusFilter === "ALL" ? "CONTACTED" : defaultStatusFilter,
    quoteTitle: "",
    quoteMessage: "",
    batterySize: "",
    inverterSize: "",
    panelSetup: "",
    accessories: "",
    estimatedAmount: "",
    recommendedProducts: "",
    followUpNotes: "",
    sendEmail: true,
    sendSms: true,
  });

  async function refreshRequests(nextStatus = statusFilter, nextQuery = query) {
    setLoading(true);
    setLoadError(null);
    try {
      const response = await fetch(
        buildApiUrl(apiBasePath, apiQueryParams, "", {
          status: nextStatus,
          ...(nextQuery.trim() ? { q: nextQuery.trim() } : {}),
        }),
        { cache: "no-store" },
      );
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || "Failed to load quotation requests.");
      }
      setRequests(data.requests);
      setExpandedId((current) => current && data.requests.some((request: SerializedQuoteRequest) => request.id === current)
        ? current
        : data.requests[0]?.id ?? null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Failed to load quotation requests.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (filterStorageKey && typeof window !== "undefined") {
      const stored = window.localStorage.getItem(filterStorageKey);
      if (stored && STATUS_OPTIONS.includes(stored as QuoteRequestStatusFilter)) {
        setStatusFilter(stored as QuoteRequestStatusFilter);
      }
    }
  }, [filterStorageKey]);

  useEffect(() => {
    if (filterStorageKey && typeof window !== "undefined") {
      window.localStorage.setItem(filterStorageKey, statusFilter);
    }
  }, [filterStorageKey, statusFilter]);

  useEffect(() => {
    refreshRequests().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!expandedRequest) return;
    setFormState({
      status: expandedRequest.status,
      quoteTitle: expandedRequest.quoteTitle || "",
      quoteMessage: expandedRequest.quoteMessage || "",
      batterySize:
        typeof expandedRequest.quotationData?.batterySize === "string"
          ? expandedRequest.quotationData.batterySize
          : "",
      inverterSize:
        typeof expandedRequest.quotationData?.inverterSize === "string"
          ? expandedRequest.quotationData.inverterSize
          : "",
      panelSetup:
        typeof expandedRequest.quotationData?.panelSetup === "string"
          ? expandedRequest.quotationData.panelSetup
          : "",
      accessories:
        typeof expandedRequest.quotationData?.accessories === "string"
          ? expandedRequest.quotationData.accessories
          : "",
      estimatedAmount:
        typeof expandedRequest.quotationData?.estimatedAmount === "string"
          ? expandedRequest.quotationData.estimatedAmount
          : "",
      recommendedProducts:
        typeof expandedRequest.quotationData?.recommendedProducts === "string"
          ? expandedRequest.quotationData.recommendedProducts
          : "",
      followUpNotes:
        typeof expandedRequest.responseMetadata?.followUpNotes === "string"
          ? expandedRequest.responseMetadata.followUpNotes
          : "",
      sendEmail: expandedRequest.customerEmail ? true : false,
      sendSms: expandedRequest.customerPhone ? true : false,
    });
  }, [expandedRequest]);

  async function handleRespond() {
    if (!expandedRequest) return;
    setSaving(expandedRequest.id);
    setMessage(null);
    try {
      const response = await fetch(
        buildApiUrl(apiBasePath, apiQueryParams, `${expandedRequest.id}/respond`),
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...formState,
            recommendedProducts: normalizeRecommendedProducts(formState.recommendedProducts),
          }),
        },
      );
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || "Failed to save quotation response.");
      }

      setRequests((current) =>
        current.map((request) => (request.id === expandedRequest.id ? data.request : request)),
      );
      const delivered = (data.notifications || [])
        .filter((entry: { ok: boolean }) => entry.ok)
        .map((entry: { channel: string }) => entry.channel.toUpperCase())
        .join(" + ");
      setMessage(
        delivered
          ? `Quotation saved and customer notified via ${delivered}.`
          : "Quotation saved successfully.",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to save quotation response.");
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-[var(--panel,#121723)] p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
              Quotation requests
            </div>
            <h2 className="mt-2 text-xl font-semibold text-white">{deskTitle}</h2>
            <p className="mt-1 text-sm text-slate-300">{deskDescription}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search customer, phone, quote ref..."
              className="min-w-[260px] rounded-full border border-white/10 bg-slate-950/70 px-4 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => refreshRequests()}
              className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-100 transition hover:border-emerald-500 hover:text-white"
            >
              <RefreshCcw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-wide">
          {STATUS_OPTIONS.map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => {
                setStatusFilter(status);
                refreshRequests(status, query).catch(() => undefined);
              }}
              className={`rounded-full border px-4 py-1 transition ${
                statusFilter === status
                  ? "border-emerald-500 bg-emerald-500/20 text-emerald-200"
                  : "border-white/15 text-slate-200 hover:border-emerald-500 hover:text-white"
              }`}
            >
              {status === "ALL" ? "All quotation requests" : formatStatus(status)}
            </button>
          ))}
        </div>

        {loadError ? (
          <div className="mt-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {loadError}
          </div>
        ) : null}
        {message ? (
          <div className="mt-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
            {message}
          </div>
        ) : null}

        <div className="mt-5 space-y-4">
          {requests.length ? (
            requests.map((request) => {
              const expanded = request.id === expandedId;
              return (
                <div
                  key={request.id}
                  className="rounded-[28px] border border-white/10 bg-slate-950/60 p-5"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <button
                      type="button"
                      onClick={() => setExpandedId(expanded ? null : request.id)}
                      className="flex min-w-0 flex-1 items-start gap-3 text-left"
                    >
                      <span className="mt-1 rounded-full border border-white/10 bg-white/5 p-2 text-slate-300">
                        {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </span>
                      <div className="min-w-0">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                          Open quotation request
                        </div>
                        <div className="mt-2 text-2xl font-semibold text-white">{request.customerName}</div>
                        <div className="mt-1 text-sm text-slate-400">{request.quoteRef}</div>
                        <div className="mt-2 grid gap-1 text-sm text-slate-300 md:grid-cols-2 xl:grid-cols-3">
                          <div>{request.customerPhone}</div>
                          <div>{request.customerEmail || "No email saved yet"}</div>
                          <div>{request.customerLocation || [request.town, request.county].filter(Boolean).join(" - ") || "Location pending"}</div>
                        </div>
                      </div>
                    </button>
                    <div className="flex flex-col items-start gap-3 lg:items-end">
                      <div className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-4 py-2 text-sm font-semibold uppercase tracking-[0.16em] text-emerald-300">
                        {formatStatus(request.status)}
                      </div>
                      <div className="text-sm text-slate-400">{formatDateTime(request.createdAt)}</div>
                    </div>
                  </div>

                  {expanded ? (
                    <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_430px]">
                      <div className="space-y-4">
                        <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                            Customer request
                          </div>
                          <div className="mt-3 grid gap-3 text-sm text-slate-200 sm:grid-cols-2">
                            <div>
                              <div className="font-semibold text-white">Property type</div>
                              <div className="mt-1 text-slate-300">{request.propertyType || "-"}</div>
                            </div>
                            <div>
                              <div className="font-semibold text-white">Budget range</div>
                              <div className="mt-1 text-slate-300">{request.budgetRange || "-"}</div>
                            </div>
                            <div className="sm:col-span-2">
                              <div className="font-semibold text-white">Power/load description</div>
                              <div className="mt-1 whitespace-pre-wrap text-slate-300">{request.loadDescription || "-"}</div>
                            </div>
                            <div className="sm:col-span-2">
                              <div className="font-semibold text-white">Preferred products</div>
                              <div className="mt-1 whitespace-pre-wrap text-slate-300">{request.preferredProducts || "-"}</div>
                            </div>
                            <div className="sm:col-span-2">
                              <div className="font-semibold text-white">Customer notes</div>
                              <div className="mt-1 whitespace-pre-wrap text-slate-300">{request.notes || "-"}</div>
                            </div>
                          </div>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                            Quotation response
                          </div>
                          <div className="mt-4 grid gap-3 md:grid-cols-2">
                            <label className="text-xs uppercase tracking-wide text-slate-400">
                              Status
                              <select
                                value={formState.status}
                                onChange={(event) =>
                                  setFormState((current) => ({
                                    ...current,
                                    status: event.target.value as QuoteRequestStatus,
                                  }))
                                }
                                className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
                              >
                                {QUOTE_REQUEST_STATUSES.map((status) => (
                                  <option key={status} value={status}>
                                    {formatStatus(status)}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="text-xs uppercase tracking-wide text-slate-400">
                              Quote title
                              <input
                                value={formState.quoteTitle}
                                onChange={(event) =>
                                  setFormState((current) => ({ ...current, quoteTitle: event.target.value }))
                                }
                                className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
                              />
                            </label>
                            <label className="text-xs uppercase tracking-wide text-slate-400">
                              Battery size
                              <input
                                value={formState.batterySize}
                                onChange={(event) =>
                                  setFormState((current) => ({ ...current, batterySize: event.target.value }))
                                }
                                className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
                              />
                            </label>
                            <label className="text-xs uppercase tracking-wide text-slate-400">
                              Inverter size
                              <input
                                value={formState.inverterSize}
                                onChange={(event) =>
                                  setFormState((current) => ({ ...current, inverterSize: event.target.value }))
                                }
                                className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
                              />
                            </label>
                            <label className="text-xs uppercase tracking-wide text-slate-400 md:col-span-2">
                              Solar panel setup
                              <input
                                value={formState.panelSetup}
                                onChange={(event) =>
                                  setFormState((current) => ({ ...current, panelSetup: event.target.value }))
                                }
                                className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
                              />
                            </label>
                            <label className="text-xs uppercase tracking-wide text-slate-400 md:col-span-2">
                              Accessories
                              <textarea
                                rows={3}
                                value={formState.accessories}
                                onChange={(event) =>
                                  setFormState((current) => ({ ...current, accessories: event.target.value }))
                                }
                                className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
                              />
                            </label>
                            <label className="text-xs uppercase tracking-wide text-slate-400">
                              Estimated amount
                              <input
                                value={formState.estimatedAmount}
                                onChange={(event) =>
                                  setFormState((current) => ({ ...current, estimatedAmount: event.target.value }))
                                }
                                className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
                              />
                            </label>
                            <label className="text-xs uppercase tracking-wide text-slate-400 md:col-span-2">
                              Recommended catalogue products
                              <textarea
                                rows={4}
                                value={formState.recommendedProducts}
                                onChange={(event) =>
                                  setFormState((current) => ({ ...current, recommendedProducts: event.target.value }))
                                }
                                placeholder="Paste product names, URLs, or short recommended bundle notes."
                                className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
                              />
                            </label>
                            <label className="text-xs uppercase tracking-wide text-slate-400 md:col-span-2">
                              Customer message
                              <textarea
                                rows={5}
                                value={formState.quoteMessage}
                                onChange={(event) =>
                                  setFormState((current) => ({ ...current, quoteMessage: event.target.value }))
                                }
                                placeholder="Explain the recommended setup, delivery plan, and next step for the customer."
                                className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
                              />
                            </label>
                            <label className="text-xs uppercase tracking-wide text-slate-400 md:col-span-2">
                              Follow-up notes
                              <textarea
                                rows={3}
                                value={formState.followUpNotes}
                                onChange={(event) =>
                                  setFormState((current) => ({ ...current, followUpNotes: event.target.value }))
                                }
                                placeholder="Internal follow-up notes for the next call or message."
                                className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
                              />
                            </label>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                            Notification delivery
                          </div>
                          <div className="mt-3 space-y-3 text-sm text-slate-200">
                            <label className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                checked={formState.sendEmail}
                                disabled={!request.customerEmail}
                                onChange={(event) =>
                                  setFormState((current) => ({ ...current, sendEmail: event.target.checked }))
                                }
                              />
                              <span>Email customer {request.customerEmail ? `(${request.customerEmail})` : "(no email saved)"}</span>
                            </label>
                            <label className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                checked={formState.sendSms}
                                disabled={!request.customerPhone}
                                onChange={(event) =>
                                  setFormState((current) => ({ ...current, sendSms: event.target.checked }))
                                }
                              />
                              <span>SMS customer ({request.customerPhone || "no phone"})</span>
                            </label>
                          </div>
                          <button
                            type="button"
                            onClick={handleRespond}
                            disabled={saving === request.id}
                            className="mt-5 inline-flex items-center gap-2 rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-70"
                          >
                            {saving === request.id ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                            Save quotation response
                          </button>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4 text-sm text-slate-300">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                            Assignment
                          </div>
                          <div className="mt-3">
                            {request.assignedAttendant?.name || request.assignedAttendant?.email || "Unassigned"}
                          </div>
                          {request.respondedAt ? (
                            <div className="mt-3 text-xs text-slate-400">
                              Last responded: {formatDateTime(request.respondedAt)}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })
          ) : (
            <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/40 px-5 py-8 text-center text-sm text-slate-400">
              {loading ? "Loading quotation requests..." : emptyMessage}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
