"use client";

import { ChevronDown, ChevronUp, ExternalLink, MessageSquareText, PhoneCall, Star } from "lucide-react";
import Link from "next/link";
import { Fragment, useEffect, useState } from "react";

type FeedbackListItem = {
  id: string;
  token: string;
  phone: string | null;
  normalizedPhone: string | null;
  rating: number | null;
  contactReason: string | null;
  staffHelpful: string | null;
  questionsAnswered: string | null;
  recommend: string | null;
  wantsContact: boolean;
  reviewed: boolean;
  createdAt: string;
  submittedAt: string | null;
  smsSent: boolean;
  smsSentAt: string | null;
  openedCount: number;
  openedAt: string | null;
  lastOpenedAt: string | null;
  submitted: boolean;
  followUpCreated: boolean;
  statusLabel: string;
  latestCall: {
    id: string;
    startedAt: string | null;
    createdAt: string;
    direction: string;
    status: string;
    durationInSeconds: number | null;
    recordingUrl: string | null;
    callerNumber: string;
    assignedTo: {
      id: string;
      name: string | null;
      email: string | null;
    } | null;
  } | null;
  agent: {
    id: string;
    name: string | null;
    email: string | null;
  } | null;
};

type FeedbackStats = {
  smsSentCount: number;
  clickedCount: number;
  respondedCount: number;
  clickRate: number;
  responseRate: number;
  averageRating: number;
  lowRatingsCount: number;
  pendingFollowUpsCount: number;
  totalClicks: number;
};

type FeedbackDetail = {
  feedback: FeedbackListItem & {
    comments: string | null;
    name: string | null;
    email: string | null;
    callId: string | null;
    followUpTaskId: string | null;
  };
  linkedCall: any | null;
  recentCalls: any[];
  previousFeedback: Array<{
    id: string;
    rating: number | null;
    serviceType: string | null;
    comment: string | null;
    submittedAt: string | null;
    token: string;
  }>;
};

function badgeClass(label: string) {
  const normalized = label.toLowerCase();
  if (normalized.includes("pending")) return "border-slate-700 bg-slate-900/80 text-slate-200";
  if (normalized.includes("contact")) return "border-amber-500/30 bg-amber-500/10 text-amber-100";
  if (normalized.includes("low")) return "border-rose-500/30 bg-rose-500/10 text-rose-100";
  if (normalized.includes("follow")) return "border-cyan-500/30 bg-cyan-500/10 text-cyan-100";
  if (normalized.includes("submitted")) return "border-emerald-500/30 bg-emerald-500/10 text-emerald-100";
  return "border-white/10 bg-white/[0.04] text-slate-200";
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleString("en-KE", {
    timeZone: "Africa/Nairobi",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(seconds: number | null | undefined) {
  if (!seconds || seconds <= 0) return "-";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (!mins) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

function getEffectiveCallStatus(call: { status?: string | null; followUps?: Array<{ status?: string | null }> }) {
  const baseStatus = String(call.status || "").trim().toLowerCase();
  const followUpStatus = String(call.followUps?.[0]?.status || "").trim().toLowerCase();
  if (!["missed", "busy", "failed", "cancelled", "disconnected", "unanswered", "no_answer"].includes(baseStatus)) {
    return baseStatus || "unknown";
  }
  if (followUpStatus === "contacted") return "contacted";
  if (["resolved", "closed"].includes(followUpStatus)) return "resolved";
  return baseStatus || "unknown";
}

export default function VoiceFeedbackPanel({ mode = "admin" }: { mode?: "admin" | "staff" }) {
  const [items, setItems] = useState<FeedbackListItem[]>([]);
  const [stats, setStats] = useState<FeedbackStats>({
    smsSentCount: 0,
    clickedCount: 0,
    respondedCount: 0,
    clickRate: 0,
    responseRate: 0,
    averageRating: 0,
    lowRatingsCount: 0,
    pendingFollowUpsCount: 0,
    totalClicks: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detailById, setDetailById] = useState<Record<string, FeedbackDetail | undefined>>({});
  const [filters, setFilters] = useState({
    rating: "all",
    contactReason: "all",
    wantsContact: "all",
    lowRatingOnly: false,
    submitted: "all",
  });

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        params.set("pageSize", "50");
        if (filters.rating !== "all") params.set("rating", filters.rating);
        if (filters.contactReason !== "all") params.set("contactReason", filters.contactReason);
        if (filters.wantsContact !== "all") params.set("wantsContact", filters.wantsContact);
        if (filters.lowRatingOnly) params.set("lowRatingOnly", "true");
        if (filters.submitted !== "all") params.set("submitted", filters.submitted);
        const response = await fetch(`/api/admin/feedback?${params.toString()}`, { cache: "no-store" });
        const payload = await response.json().catch(() => null);
        if (!response.ok) throw new Error(String(payload?.error || "Unable to load feedback."));
        if (!cancelled) {
          setItems(Array.isArray(payload?.items) ? payload.items : []);
          setStats({
            smsSentCount: Number(payload?.stats?.smsSentCount || 0),
            clickedCount: Number(payload?.stats?.clickedCount || 0),
            respondedCount: Number(payload?.stats?.respondedCount || 0),
            clickRate: Number(payload?.stats?.clickRate || 0),
            responseRate: Number(payload?.stats?.responseRate || 0),
            averageRating: Number(payload?.stats?.averageRating || 0),
            lowRatingsCount: Number(payload?.stats?.lowRatingsCount || 0),
            pendingFollowUpsCount: Number(payload?.stats?.pendingFollowUpsCount || 0),
            totalClicks: Number(payload?.stats?.totalClicks || 0),
          });
        }
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Unable to load feedback.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [filters]);

  const loadDetail = async (id: string) => {
    if (detailById[id]) return;
    const response = await fetch(`/api/admin/feedback/${id}`, { cache: "no-store" });
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new Error(String(payload?.error || "Unable to load feedback detail."));
    setDetailById((current) => ({ ...current, [id]: payload }));
  };

  const toggleExpand = (id: string) => {
    const next = expandedId === id ? null : id;
    setExpandedId(next);
    if (next) {
      void loadDetail(next).catch((detailError) => {
        setError(detailError instanceof Error ? detailError.message : "Unable to load feedback detail.");
      });
    }
  };

  const hasActiveFilters =
    filters.rating !== "all" ||
    filters.contactReason !== "all" ||
    filters.wantsContact !== "all" ||
    filters.lowRatingOnly ||
    filters.submitted !== "all";

  const summaryCards = [
    { label: "Average Rating", value: stats.averageRating ? stats.averageRating.toFixed(1) : "0.0" },
    { label: "SMS Sent", value: String(stats.smsSentCount) },
    { label: "Links Clicked", value: String(stats.clickedCount) },
    {
      label: "Responses",
      value: String(stats.respondedCount),
      onClick: () =>
        setFilters((current) => ({
          ...current,
          submitted: current.submitted === "true" ? "all" : "true",
        })),
      active: filters.submitted === "true",
      helper: filters.submitted === "true" ? "Showing submitted feedback" : "Click to view submitted feedback",
    },
    { label: "Click Rate", value: `${stats.clickRate}%` },
    { label: "Response Rate", value: `${stats.responseRate}%` },
  ];

  return (
    <section className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
        {summaryCards.map((card) =>
          card.onClick ? (
            <button
              key={card.label}
              type="button"
              onClick={card.onClick}
              className={`rounded-xl border px-3 py-3 text-left transition ${
                card.active
                  ? "border-cyan-400/40 bg-cyan-500/10 shadow-[0_0_0_1px_rgba(34,211,238,0.18)_inset]"
                  : "border-slate-800/90 bg-slate-950/85 hover:border-cyan-500/30 hover:bg-cyan-500/5"
              }`}
            >
              <div className="text-xs text-slate-500">{card.label}</div>
              <div className="mt-1 text-2xl font-semibold text-white">{card.value}</div>
              <div className="mt-1 text-[11px] text-slate-400">{card.helper}</div>
            </button>
          ) : (
            <div key={card.label} className="rounded-xl border border-slate-800/90 bg-slate-950/85 px-3 py-3">
              <div className="text-xs text-slate-500">{card.label}</div>
              <div className="mt-1 text-2xl font-semibold text-white">{card.value}</div>
            </div>
          ),
        )}
      </div>

      <div className="rounded-[24px] border border-slate-800/90 bg-slate-950/96 p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Feedback Center</div>
            <h2 className="mt-2 text-2xl font-semibold text-white">
              {mode === "admin" ? "Secure customer call feedback" : "Your customer call feedback"}
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              {mode === "admin"
                ? "Review secure-link delivery, link opens, completed surveys, linked calls, and service recovery follow-ups."
                : "Review only the feedback linked to your handled calls, including ratings, comments, and contact requests."}
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <select
              value={filters.rating}
              onChange={(event) => setFilters((current) => ({ ...current, rating: event.target.value }))}
              className="rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none"
            >
              <option value="all">All ratings</option>
              {[5, 4, 3, 2, 1].map((rating) => (
                <option key={rating} value={String(rating)}>
                  {rating} star{rating === 1 ? "" : "s"}
                </option>
              ))}
            </select>
            <input
              value={filters.contactReason === "all" ? "" : filters.contactReason}
              onChange={(event) => setFilters((current) => ({ ...current, contactReason: event.target.value || "all" }))}
              placeholder="Service filter"
              className="rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-500"
            />
            <select
              value={filters.wantsContact}
              onChange={(event) => setFilters((current) => ({ ...current, wantsContact: event.target.value }))}
              className="rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none"
            >
              <option value="all">All contact options</option>
              <option value="true">Contact requested</option>
              <option value="false">No contact request</option>
            </select>
            <label className="inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2 text-sm text-slate-200">
              <input
                type="checkbox"
                checked={filters.lowRatingOnly}
                onChange={(event) => setFilters((current) => ({ ...current, lowRatingOnly: event.target.checked }))}
              />
              Low ratings only
            </label>
          </div>
        </div>

        {hasActiveFilters ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {filters.submitted === "true" ? (
              <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-100">
                Responses only
              </span>
            ) : null}
            <button
              type="button"
              onClick={() =>
                setFilters({
                  rating: "all",
                  contactReason: "all",
                  wantsContact: "all",
                  lowRatingOnly: false,
                  submitted: "all",
                })
              }
              className="rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1 text-xs font-semibold text-slate-200 transition hover:border-slate-500 hover:text-white"
            >
              Clear filters
            </button>
          </div>
        ) : null}

        {error ? <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">{error}</div> : null}

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-0">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-[0.18em] text-slate-500">
                <th className="px-4 py-3">View</th>
                <th className="px-4 py-3">Call Date</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Rating</th>
                <th className="px-4 py-3">Agent</th>
                <th className="px-4 py-3">Duration</th>
                <th className="px-4 py-3">Recommendation</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-sm text-slate-400">
                    Loading feedback...
                  </td>
                </tr>
              ) : !items.length ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-sm text-slate-400">
                    No feedback sessions found yet.
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const isExpanded = expandedId === item.id;
                  const detail = detailById[item.id];
                  return (
                    <Fragment key={item.id}>
                      <tr className="border-t border-slate-800/90 text-sm text-slate-200">
                        <td className="px-4 py-4 align-top">
                          <button
                            type="button"
                            onClick={() => toggleExpand(item.id)}
                            className="inline-flex h-12 w-12 items-center justify-center rounded-xl border border-slate-800 bg-slate-900/70 text-slate-100"
                          >
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </button>
                        </td>
                        <td className="px-4 py-4 align-top text-white">{formatDateTime(item.latestCall?.startedAt || item.createdAt)}</td>
                        <td className="px-4 py-4 align-top">
                          <div className="font-semibold text-white">{item.phone || "No phone"}</div>
                          <div className="mt-1 text-sm text-slate-400">{item.contactReason || "Feedback session only"}</div>
                        </td>
                        <td className="px-4 py-4 align-top">
                          {item.rating != null ? (
                            <div className="inline-flex items-center gap-1 rounded-full border border-[#f2b20f]/30 bg-[#f2b20f]/10 px-3 py-1 text-sm font-semibold text-[#ffe08a]">
                              <Star className="h-3.5 w-3.5 fill-current" />
                              {item.rating}/5
                            </div>
                          ) : (
                            <span className="text-slate-500">Pending</span>
                          )}
                        </td>
                        <td className="px-4 py-4 align-top text-slate-300">
                          {item.agent?.name || item.latestCall?.assignedTo?.name || item.agent?.email || "Unassigned"}
                        </td>
                        <td className="px-4 py-4 align-top text-slate-300">{formatDuration(item.latestCall?.durationInSeconds)}</td>
                        <td className="px-4 py-4 align-top text-slate-300">{item.recommend || "-"}</td>
                        <td className="px-4 py-4 align-top">
                          <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${badgeClass(item.statusLabel)}`}>
                            {item.statusLabel}
                          </span>
                        </td>
                      </tr>
                      {isExpanded ? (
                        <tr>
                          <td colSpan={8} className="px-4 pb-5">
                            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                              <div className="grid gap-3 lg:grid-cols-3">
                                <InfoCard label="Token" value={detail?.feedback.token || item.token} />
                                <InfoCard label="SMS Sent" value={detail?.feedback.smsSentAt ? formatDateTime(detail.feedback.smsSentAt) : item.smsSent ? "Yes" : "No"} />
                                <InfoCard label="First Click" value={detail?.feedback.openedAt ? formatDateTime(detail.feedback.openedAt) : item.openedAt ? formatDateTime(item.openedAt) : "Not opened"} />
                                <InfoCard label="Clicks" value={String(detail?.feedback.openedCount ?? item.openedCount)} />
                                <InfoCard label="Submitted" value={detail?.feedback.submittedAt ? formatDateTime(detail.feedback.submittedAt) : item.submitted ? "Yes" : "No"} />
                                <InfoCard label="Rating" value={detail?.feedback.rating != null ? `${detail.feedback.rating}/5` : "Pending"} />
                                <InfoCard label="Reason" value={detail?.feedback.contactReason || item.contactReason || "-"} />
                                <InfoCard label="Recommend" value={detail?.feedback.recommend || item.recommend || "-"} />
                                <InfoCard label="Staff Helpful" value={detail?.feedback.staffHelpful || item.staffHelpful || "-"} />
                                <InfoCard label="Questions Answered" value={detail?.feedback.questionsAnswered || item.questionsAnswered || "-"} />
                                <InfoCard label="Contact Request" value={detail?.feedback.wantsContact ? `${detail.feedback.name || "No name"} · ${detail.feedback.phone || "No phone"} · ${detail.feedback.email || "No email"}` : "No follow-up requested"} />
                              </div>

                              <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
                                <div className="space-y-4">
                                  <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Comments</div>
                                    <div className="mt-2 text-sm text-slate-200">{detail?.feedback.comments || "No comments shared."}</div>
                                  </div>

                                  <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Linked Call History</div>
                                    <div className="mt-3 space-y-3">
                                      {(detail?.recentCalls || []).length ? (
                                        detail?.recentCalls.map((call) => (
                                          <div key={call.id} className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-3">
                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                              <div className="text-sm font-semibold text-white">{call.callerNumber}</div>
                                              <span className={`rounded-full border px-2.5 py-1 text-[11px] ${badgeClass(getEffectiveCallStatus(call))}`}>
                                                {getEffectiveCallStatus(call).replace(/_/g, " ")}
                                              </span>
                                            </div>
                                            <div className="mt-2 text-sm text-slate-400">
                                              {formatDateTime(call.startedAt || call.createdAt)} · {call.direction} · {call.assignedTo?.name || call.assignedTo?.email || "Unassigned"}
                                            </div>
                                            <div className="mt-1 text-sm text-slate-500">Duration {formatDuration(call.durationInSeconds)}</div>
                                          </div>
                                        ))
                                      ) : (
                                        <div className="text-sm text-slate-500">No linked call history available yet.</div>
                                      )}
                                    </div>
                                  </div>

                                  <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Previous Feedback</div>
                                    <div className="mt-3 space-y-2">
                                      {(detail?.previousFeedback || []).length ? (
                                        detail?.previousFeedback.map((entry) => (
                                          <div key={entry.id} className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-3 text-sm text-slate-200">
                                            <div className="font-semibold text-white">
                                              {entry.rating != null ? `${entry.rating}/5` : "Pending"} · {entry.serviceType || "No service type"}
                                            </div>
                                            <div className="mt-1 text-xs text-slate-400">{formatDateTime(entry.submittedAt)}</div>
                                            <div className="mt-2 text-slate-300">{entry.comment || "No comment"}</div>
                                          </div>
                                        ))
                                      ) : (
                                        <div className="text-sm text-slate-500">No previous submitted feedback for this customer.</div>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Quick Actions</div>
                                  <div className="mt-3 space-y-2">
                                    {detail?.linkedCall ? (
                                      <Link
                                        href={`${mode === "admin" ? "/admin/communications/voice" : "/attendant/voice"}?tab=recent&selectedCallId=${encodeURIComponent(detail.linkedCall.id)}&selectedPhone=${encodeURIComponent(detail.linkedCall.callerNumber || "")}`}
                                        className="inline-flex w-full items-center justify-between rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm font-semibold text-white transition hover:border-cyan-500/30 hover:bg-cyan-500/10"
                                      >
                                        Open call history
                                        <PhoneCall className="h-4 w-4" />
                                      </Link>
                                    ) : null}
                                    {detail?.linkedCall?.recordingUrl ? (
                                      <Link
                                        href={detail.linkedCall.recordingUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex w-full items-center justify-between rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm font-semibold text-white transition hover:border-cyan-500/30 hover:bg-cyan-500/10"
                                      >
                                        Open recording
                                        <ExternalLink className="h-4 w-4" />
                                      </Link>
                                    ) : null}
                                    <Link
                                      href={`${mode === "admin" ? "/admin/communications/voice" : "/attendant/voice"}?tab=followups${item.phone ? `&selectedPhone=${encodeURIComponent(item.phone)}` : ""}`}
                                      className="inline-flex w-full items-center justify-between rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm font-semibold text-white transition hover:border-cyan-500/30 hover:bg-cyan-500/10"
                                    >
                                      Create follow-up
                                      <MessageSquareText className="h-4 w-4" />
                                    </Link>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</div>
      <div className="mt-2 text-sm text-white">{value}</div>
    </div>
  );
}
