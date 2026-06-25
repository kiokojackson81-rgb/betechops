"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { VoiceLiveSnapshot } from "@/lib/voiceOperations";

type VoiceConsoleClientProps = {
  mode: "admin" | "staff";
  initialData: VoiceLiveSnapshot;
  backHref: string;
  pollBaseHref: string;
  title: string;
  badge: string;
  subtitle: string;
};

const PRESENCE_STATUSES = ["AVAILABLE", "BUSY", "BREAK", "OFFLINE"] as const;

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

function formatMoney(value: number | null | undefined, currencyCode = "KES") {
  const amount = Number(value ?? 0);
  return `${currencyCode} ${amount.toLocaleString("en-KE", { maximumFractionDigits: 2 })}`;
}

function formatRelative(seconds: number | null | undefined) {
  if (!seconds || seconds <= 0) return "now";
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return mins ? `${hours}h ${mins}m` : `${hours}h`;
}

function formatStatus(value: string | null | undefined) {
  return String(value || "unknown").replace(/_/g, " ");
}

function statusTone(status: string | null | undefined) {
  const normalized = String(status || "").toLowerCase();
  if (["available", "answered", "completed", "resolved", "contacted"].includes(normalized)) {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-100";
  }
  if (["busy", "ringing", "queued", "pending", "in_progress", "pending_follow_up"].includes(normalized)) {
    return "border-amber-500/30 bg-amber-500/10 text-amber-100";
  }
  if (["offline", "break", "missed", "aborted", "failed", "closed"].includes(normalized)) {
    return "border-rose-500/30 bg-rose-500/10 text-rose-100";
  }
  return "border-white/10 bg-white/[0.04] text-slate-200";
}

function cardShell(extra = "") {
  return `rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.94),rgba(4,8,20,0.98))] ${extra}`.trim();
}

export default function VoiceConsoleClient({
  mode,
  initialData,
  backHref,
  pollBaseHref,
  title,
  badge,
  subtitle,
}: VoiceConsoleClientProps) {
  const [data, setData] = useState(initialData);
  const [selectedCallId, setSelectedCallId] = useState(initialData.selectedCallId);
  const [selectedPhone, setSelectedPhone] = useState(initialData.selectedPhone);
  const [noteDraft, setNoteDraft] = useState("");
  const [followUpTitle, setFollowUpTitle] = useState("");
  const [followUpDueAt, setFollowUpDueAt] = useState("");
  const [followUpNotes, setFollowUpNotes] = useState("");
  const [submittingNote, setSubmittingNote] = useState(false);
  const [submittingFollowUp, setSubmittingFollowUp] = useState(false);
  const [presencePending, setPresencePending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshSnapshot = async (nextCallId?: string | null, nextPhone?: string | null) => {
    const params = new URLSearchParams();
    if (nextCallId) params.set("selectedCallId", nextCallId);
    if (nextPhone) params.set("selectedPhone", nextPhone);
    const separator = pollBaseHref.includes("?") ? "&" : "?";
    const response = await fetch(`${pollBaseHref}${params.toString() ? `${separator}${params.toString()}` : ""}`, {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`snapshot_${response.status}`);
    }

    const nextData = (await response.json()) as VoiceLiveSnapshot;
    setData(nextData);
    setSelectedCallId(nextData.selectedCallId);
    setSelectedPhone(nextData.selectedPhone);
    return nextData;
  };

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      refreshSnapshot(selectedCallId, selectedPhone).catch((pollError) => {
        console.error("[voice.console.poll_failed]", pollError);
      });
    }, 15_000);

    return () => window.clearInterval(intervalId);
  }, [pollBaseHref, selectedCallId, selectedPhone]);

  const selectedCall = useMemo(() => {
    return (
      data.activeCalls.find((call) => call.id === selectedCallId) ||
      data.recentCalls.find((call) => call.id === selectedCallId) ||
      data.activeCalls[0] ||
      data.recentCalls[0] ||
      null
    );
  }, [data.activeCalls, data.recentCalls, selectedCallId]);

  const myPresence = useMemo(() => {
    return data.agents.find((agent) => agent.id === data.viewer.targetUserId) || null;
  }, [data.agents, data.viewer.targetUserId]);

  const selectedCustomerLinks = useMemo(() => {
    const phone = data.selectedContext?.normalizedPhone || selectedPhone || selectedCall?.callerNumber || "";
    const params = new URLSearchParams();
    if (phone) params.set("q", phone);
    if (data.viewer.impersonateId) params.set("impersonateId", data.viewer.impersonateId);
    const customerHref = `/admin/customers${params.toString() ? `?${params.toString()}` : ""}`;

    const receiptParams = new URLSearchParams();
    receiptParams.set("tab", "pos");
    if (data.selectedContext?.latestReceiptId) receiptParams.set("receiptId", data.selectedContext.latestReceiptId);
    if (data.viewer.impersonateId) receiptParams.set("impersonateId", data.viewer.impersonateId);

    const quoteParams = new URLSearchParams();
    quoteParams.set("tab", "quotations");
    if (data.selectedContext?.latestQuotationId) quoteParams.set("quoteId", data.selectedContext.latestQuotationId);
    if (data.viewer.impersonateId) quoteParams.set("impersonateId", data.viewer.impersonateId);

    return {
      customer: selectedCall?.links.customer || customerHref,
      receipt: selectedCall?.links.receipt || `/marketing/receipts?${receiptParams.toString()}`,
      quote: selectedCall?.links.quote || `/marketing/receipts?${quoteParams.toString()}`,
      callBack: selectedCall?.links.callBack || (phone ? `tel:${phone}` : "#"),
    };
  }, [data.selectedContext, data.viewer.impersonateId, selectedCall, selectedPhone]);

  const handleSelectCall = (callId: string, phone: string) => {
    setSelectedCallId(callId);
    setSelectedPhone(phone);
    setError(null);
    refreshSnapshot(callId, phone).catch((selectionError) => {
      console.error("[voice.console.select_failed]", selectionError);
      setError("Failed to load the selected customer context.");
    });
  };

  const handlePresenceUpdate = async (status: (typeof PRESENCE_STATUSES)[number]) => {
    setPresencePending(true);
    setError(null);
    try {
      const response = await fetch(`${pollBaseHref.replace("/live", "/presence")}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status,
          currentCallId: selectedCall?.id ?? null,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(String(payload.error || "presence_failed"));
      }

      await refreshSnapshot(selectedCallId, selectedPhone);
    } catch (presenceError) {
      console.error("[voice.console.presence_failed]", presenceError);
      setError("Could not update availability status.");
    } finally {
      setPresencePending(false);
    }
  };

  const handleAddNote = async () => {
    if (!selectedCall?.id || !noteDraft.trim()) return;
    setSubmittingNote(true);
    setError(null);
    try {
      const response = await fetch(`${pollBaseHref.replace("/live", "/notes")}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          voiceCallId: selectedCall.id,
          note: noteDraft,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(String(payload.error || "note_failed"));
      }
      setNoteDraft("");
      await refreshSnapshot(selectedCallId, selectedPhone);
    } catch (noteError) {
      console.error("[voice.console.note_failed]", noteError);
      setError("Could not save the call note.");
    } finally {
      setSubmittingNote(false);
    }
  };

  const handleCreateFollowUp = async () => {
    if (!followUpTitle.trim()) return;
    setSubmittingFollowUp(true);
    setError(null);
    try {
      const response = await fetch(`${pollBaseHref.replace("/live", "/follow-ups")}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          voiceCallId: selectedCall?.id ?? null,
          phone: selectedPhone,
          title: followUpTitle,
          dueAt: followUpDueAt || null,
          notes: followUpNotes || null,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(String(payload.error || "follow_up_failed"));
      }
      setFollowUpTitle("");
      setFollowUpDueAt("");
      setFollowUpNotes("");
      await refreshSnapshot(selectedCallId, selectedPhone);
    } catch (followUpError) {
      console.error("[voice.console.follow_up_failed]", followUpError);
      setError("Could not create the follow-up task.");
    } finally {
      setSubmittingFollowUp(false);
    }
  };

  const handleResolveTask = async (taskId: string) => {
    setError(null);
    try {
      const response = await fetch(`${pollBaseHref.replace("/live", "/follow-ups")}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: taskId,
          status: "resolved",
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(String(payload.error || "resolve_failed"));
      }
      await refreshSnapshot(selectedCallId, selectedPhone);
    } catch (resolveError) {
      console.error("[voice.console.resolve_failed]", resolveError);
      setError("Could not mark the follow-up as resolved.");
    }
  };

  const summaryCards =
    mode === "admin"
      ? [
          { label: "Calls Today", value: String((data.summary as any).callsToday), sub: "All recorded calls today" },
          { label: "Active Calls", value: String((data.summary as any).activeCalls), sub: "Live or still in progress" },
          { label: "Waiting Calls", value: String((data.summary as any).waitingCalls), sub: "Queued or still ringing" },
          { label: "Answered Calls", value: String((data.summary as any).answeredCalls), sub: "Answered or completed today" },
          { label: "Missed Calls", value: String((data.summary as any).missedCalls), sub: "Needs a callback or task" },
          { label: "Average Talk Time", value: formatDuration((data.summary as any).averageTalkTimeSeconds), sub: "Current day average" },
          { label: "Call Cost Today", value: formatMoney((data.summary as any).callCostToday), sub: "Africa's Talking cost estimate" },
          { label: "New Voice Leads", value: String((data.summary as any).newVoiceLeads), sub: "Unlinked callers created today" },
        ]
      : [
          { label: "My Calls Today", value: String((data.summary as any).myCallsToday), sub: "Calls routed to you today" },
          { label: "My Active Calls", value: String((data.summary as any).myActiveCalls), sub: "Currently active or ringing" },
          { label: "My Missed Calls", value: String((data.summary as any).myMissedCalls), sub: "Needs action or callback" },
          { label: "My Follow-ups", value: String((data.summary as any).myFollowUps), sub: "Open tasks and missed leads" },
          { label: "My Answered Calls", value: String((data.summary as any).myAnsweredCalls), sub: "Answered / completed today" },
        ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <main className="mx-auto max-w-7xl space-y-5 p-5">
        <header className={cardShell("p-5 shadow-[0_24px_70px_rgba(0,0,0,0.35)]")}>
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-3">
              <div className="inline-flex rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100">
                {badge}
              </div>
              <div>
                <h1 className="text-3xl font-semibold text-white">{title}</h1>
                <p className="mt-2 max-w-3xl text-sm text-slate-300">{subtitle}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1">Updated {formatDateTime(data.generatedAt)}</span>
                {selectedPhone ? (
                  <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1">
                    Context phone {selectedPhone}
                  </span>
                ) : null}
                {mode === "staff" && myPresence ? (
                  <span className={`rounded-full border px-3 py-1 ${statusTone(myPresence.status)}`}>
                    {myPresence.status}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap justify-end gap-2">
                <Link
                  href={backHref}
                  className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-100 transition hover:border-white/30 hover:bg-white/[0.06]"
                >
                  Back
                </Link>
                <button
                  type="button"
                  onClick={() => refreshSnapshot(selectedCallId, selectedPhone).catch(() => setError("Refresh failed."))}
                  className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-emerald-100 transition hover:border-emerald-400 hover:bg-emerald-500/15"
                >
                  Refresh
                </button>
              </div>
              {mode === "staff" ? (
                <div className="flex flex-wrap justify-end gap-2">
                  {PRESENCE_STATUSES.map((status) => (
                    <button
                      key={status}
                      type="button"
                      disabled={presencePending}
                      onClick={() => handlePresenceUpdate(status)}
                      className={`rounded-full border px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] transition ${
                        myPresence?.status === status
                          ? "border-emerald-400 bg-emerald-500/15 text-emerald-100"
                          : "border-white/10 bg-white/[0.03] text-slate-200 hover:border-white/20"
                      }`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </header>

        {error ? (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {error}
          </div>
        ) : null}

        <section className={`grid gap-3 ${mode === "admin" ? "md:grid-cols-2 xl:grid-cols-4" : "md:grid-cols-2 xl:grid-cols-5"}`}>
          {summaryCards.map((card) => (
            <div key={card.label} className={cardShell("p-4")}>
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">{card.label}</div>
              <div className="mt-3 text-2xl font-semibold text-white">{card.value}</div>
              <div className="mt-2 text-sm text-slate-400">{card.sub}</div>
            </div>
          ))}
        </section>

        <section className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
          <div className={cardShell("p-5")}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-300">Live Incoming Calls</div>
                <h2 className="mt-2 text-2xl font-semibold text-white">Active voice work</h2>
              </div>
              <div className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-slate-300">
                {data.activeCalls.length} live
              </div>
            </div>

            <div className="mt-4 grid gap-3">
              {data.activeCalls.length ? data.activeCalls.map((call) => (
                <button
                  key={call.id}
                  type="button"
                  onClick={() => handleSelectCall(call.id, call.callerNumber)}
                  className={`grid gap-3 rounded-[22px] border p-4 text-left transition lg:grid-cols-[1.1fr_170px_150px] ${
                    selectedCall?.id === call.id
                      ? "border-emerald-400/50 bg-emerald-500/10"
                      : "border-white/10 bg-white/[0.03] hover:border-white/20"
                  }`}
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${statusTone(call.direction)}`}>
                        {call.direction}
                      </span>
                      <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${statusTone(call.status)}`}>
                        {call.statusLabel}
                      </span>
                    </div>
                    <div className="mt-3 text-lg font-semibold text-white">
                      {call.customer.customerName || call.callerNumber}
                    </div>
                    <div className="mt-1 text-sm text-slate-400">
                      {call.callerNumber} · {call.customer.matchedCustomerId ? "Existing customer" : "New caller / unlinked lead"}
                    </div>
                    <div className="mt-3 text-xs text-slate-400">
                      {call.linkedSummaryText}
                    </div>
                  </div>
                  <div className="space-y-2 text-sm text-slate-300">
                    <div>Assigned: {call.assignedToName || call.assignedToEmail || call.routedTo || "-"}</div>
                    <div>Route: {call.routedTo || "-"}</div>
                    <div>Waiting: {formatRelative(call.waitingSeconds)}</div>
                  </div>
                  <div className="space-y-2 text-sm text-slate-300">
                    <div>Started: {formatDateTime(call.startedAt || call.createdAt)}</div>
                    <div>Duration: {formatDuration(call.durationInSeconds)}</div>
                    <div>Last activity: {call.lastActivityTitle || "-"}</div>
                  </div>
                </button>
              )) : (
                <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-5 text-sm text-slate-400">
                  No active voice calls right now.
                </div>
              )}
            </div>
          </div>

          <div className={cardShell("p-5")}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-300">Customer Context</div>
                <h2 className="mt-2 text-2xl font-semibold text-white">Live CRM panel</h2>
              </div>
              {selectedPhone ? (
                <a
                  href={selectedCustomerLinks.callBack}
                  className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-cyan-100 transition hover:border-cyan-400 hover:bg-cyan-500/15"
                >
                  Call back
                </a>
              ) : null}
            </div>

            {data.selectedContext ? (
              <div className="mt-4 space-y-4">
                <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
                  <div className="text-xl font-semibold text-white">
                    {data.selectedContext.customerName || data.selectedPhone || "Unknown caller"}
                  </div>
                  <div className="mt-1 text-sm text-slate-400">
                    {data.selectedPhone || "-"} · {data.selectedContext.email || "No email"} · {data.selectedContext.location || "No saved location"}
                  </div>
                  <div className="mt-3 grid gap-2 text-xs text-slate-400 sm:grid-cols-2">
                    <div>Assigned agent: {data.selectedContext.assignedAgent?.name || data.selectedContext.assignedAgent?.email || "-"}</div>
                    <div>Last purchase: {formatDateTime(data.selectedContext.lastPurchaseAt)}</div>
                    <div>Total sales: {formatMoney(data.selectedContext.totalPurchasesValue)}</div>
                    <div>Total receipts: {data.selectedContext.linkedRecords.receipts}</div>
                    <div>Open quotations: {data.selectedContext.openQuotations}</div>
                    <div>Pending web orders: {data.selectedContext.pendingWebOrders}</div>
                    <div>Pending POD: {data.selectedContext.pendingPod}</div>
                    <div>Recent notes: {data.selectedContext.recentNotes.length}</div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Link href={selectedCustomerLinks.customer} className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-100 transition hover:border-white/30">
                    Open customer
                  </Link>
                  <Link href={selectedCustomerLinks.quote} className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-emerald-100 transition hover:border-emerald-400">
                    Create / open quote
                  </Link>
                  <Link href={selectedCustomerLinks.receipt} className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-cyan-100 transition hover:border-cyan-400">
                    Create / open receipt
                  </Link>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
                    <div className="text-sm font-semibold text-white">Add note</div>
                    <textarea
                      value={noteDraft}
                      onChange={(event) => setNoteDraft(event.target.value)}
                      rows={4}
                      placeholder="Add a call note, issue summary, or customer promise."
                      className="mt-3 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-3 text-sm text-white outline-none placeholder:text-slate-500"
                    />
                    <button
                      type="button"
                      disabled={!selectedCall?.id || submittingNote || !noteDraft.trim()}
                      onClick={handleAddNote}
                      className="mt-3 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-emerald-100 transition hover:border-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {submittingNote ? "Saving..." : "Add note"}
                    </button>
                  </div>

                  <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
                    <div className="text-sm font-semibold text-white">Create follow-up</div>
                    <input
                      value={followUpTitle}
                      onChange={(event) => setFollowUpTitle(event.target.value)}
                      placeholder="Callback customer about quotation"
                      className="mt-3 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-3 text-sm text-white outline-none placeholder:text-slate-500"
                    />
                    <input
                      value={followUpDueAt}
                      onChange={(event) => setFollowUpDueAt(event.target.value)}
                      type="datetime-local"
                      className="mt-3 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-3 text-sm text-white outline-none"
                    />
                    <textarea
                      value={followUpNotes}
                      onChange={(event) => setFollowUpNotes(event.target.value)}
                      rows={3}
                      placeholder="Optional follow-up notes"
                      className="mt-3 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-3 text-sm text-white outline-none placeholder:text-slate-500"
                    />
                    <button
                      type="button"
                      disabled={submittingFollowUp || !followUpTitle.trim()}
                      onClick={handleCreateFollowUp}
                      className="mt-3 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-cyan-100 transition hover:border-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {submittingFollowUp ? "Saving..." : "Create follow-up"}
                    </button>
                  </div>
                </div>

                <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
                  <div className="text-sm font-semibold text-white">Recent timeline</div>
                  <div className="mt-3 grid gap-2">
                    {data.selectedContext.recentTimeline.length ? data.selectedContext.recentTimeline.map((item) => (
                      <div key={item.id} className="rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-3">
                        <div className="text-sm font-medium text-white">{item.title}</div>
                        <div className="mt-1 text-xs text-slate-400">
                          {item.detail} · {formatDateTime(item.at)}
                        </div>
                      </div>
                    )) : (
                      <div className="rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-3 text-sm text-slate-400">
                        No customer activity linked yet.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-[22px] border border-white/10 bg-white/[0.03] p-5 text-sm text-slate-400">
                Select a call to load the CRM context panel.
              </div>
            )}
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
          <div className={cardShell("p-5")}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                  {mode === "admin" ? "Agent Availability" : "My Queue"}
                </div>
                <h2 className="mt-2 text-2xl font-semibold text-white">
                  {mode === "admin" ? "Presence and routing visibility" : "Open follow-ups and missed calls"}
                </h2>
              </div>
              <div className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-slate-300">
                {mode === "admin" ? `${data.agents.length} agents` : `${data.callQueue.length} open`}
              </div>
            </div>

            <div className="mt-4 grid gap-3">
              {mode === "admin"
                ? data.agents.map((agent) => (
                    <div key={agent.id} className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-semibold text-white">{agent.name || agent.email || "Unnamed agent"}</div>
                          <div className="mt-1 text-sm text-slate-400">
                            {agent.email || agent.role} · {agent.attendantCategory || agent.role}
                          </div>
                        </div>
                        <span className={`rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${statusTone(agent.status)}`}>
                          {agent.status}
                        </span>
                      </div>
                      <div className="mt-3 grid gap-2 text-xs text-slate-400 sm:grid-cols-3">
                        <div>Active calls: {agent.activeCallCount}</div>
                        <div>Waiting calls: {agent.waitingCallCount}</div>
                        <div>Last seen: {formatDateTime(agent.lastSeenAt)}</div>
                      </div>
                    </div>
                  ))
                : data.callQueue.map((item) => (
                    <div key={item.id} className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="font-semibold text-white">{item.customer.customerName || item.phone}</div>
                          <div className="mt-1 text-sm text-slate-400">
                            {item.title} · {item.phone}
                          </div>
                          <div className="mt-2 text-xs text-slate-500">
                            {item.customer.linkedRecords.receipts} receipts · {item.customer.linkedRecords.quotations} quotes · {item.customer.linkedRecords.taskFollowUps} open tasks
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <span className={`rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${statusTone(item.status)}`}>
                            {item.statusLabel}
                          </span>
                          {item.type === "task" ? (
                            <button
                              type="button"
                              onClick={() => handleResolveTask(item.id)}
                              className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-100 transition hover:border-emerald-400"
                            >
                              Mark resolved
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ))}
              {!data.agents.length && mode === "admin" ? (
                <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-5 text-sm text-slate-400">
                  No agent presence records yet.
                </div>
              ) : null}
              {!data.callQueue.length && mode === "staff" ? (
                <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-5 text-sm text-slate-400">
                  No open call queue items assigned to you.
                </div>
              ) : null}
            </div>
          </div>

          <div className={cardShell("p-5")}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Recent Calls</div>
                <h2 className="mt-2 text-2xl font-semibold text-white">Compact CRM call history</h2>
              </div>
              <div className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-slate-300">
                {data.recentCalls.length} rows
              </div>
            </div>

            <div className="mt-4 grid gap-3">
              {data.recentCalls.length ? data.recentCalls.map((call) => (
                <button
                  key={call.id}
                  type="button"
                  onClick={() => handleSelectCall(call.id, call.callerNumber)}
                  className={`grid gap-3 rounded-[22px] border p-4 text-left transition lg:grid-cols-[110px_1.2fr_1fr_180px] ${
                    selectedCall?.id === call.id
                      ? "border-cyan-400/50 bg-cyan-500/10"
                      : "border-white/10 bg-white/[0.03] hover:border-white/20"
                  }`}
                >
                  <div className="flex items-start">
                    <span className={`rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${statusTone(call.direction)}`}>
                      {call.direction}
                    </span>
                  </div>
                  <div>
                    <div className="font-semibold text-white">{call.customer.customerName || call.callerNumber}</div>
                    <div className="mt-1 text-sm text-slate-400">
                      {call.callerNumber} · {call.statusLabel}
                    </div>
                    <div className="mt-2 text-xs text-slate-500">{call.linkedSummaryText}</div>
                  </div>
                  <div className="text-sm text-slate-300">
                    <div>Assigned: {call.customer.assignedAgent?.name || call.assignedToName || call.routedTo || "-"}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      Last activity: {call.lastActivityTitle || "-"}
                    </div>
                  </div>
                  <div className="flex flex-wrap content-start gap-2">
                    <span className={`rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${statusTone(call.status)}`}>
                      {call.statusLabel}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-300">
                      {formatDuration(call.durationInSeconds)}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-300">
                      {formatMoney(call.amount, call.currencyCode)}
                    </span>
                    {call.recordingUrl ? (
                      <a
                        href={call.recordingUrl}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(event) => event.stopPropagation()}
                        className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-100 transition hover:border-emerald-400"
                      >
                        Recording
                      </a>
                    ) : null}
                  </div>
                </button>
              )) : (
                <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-5 text-sm text-slate-400">
                  No recent calls yet.
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-[1fr_0.9fr]">
          <div className={cardShell("p-5")}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Call Queue</div>
                <h2 className="mt-2 text-2xl font-semibold text-white">Missed calls and follow-up tasks</h2>
              </div>
              <div className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-slate-300">
                {data.callQueue.length} open
              </div>
            </div>

            <div className="mt-4 grid gap-3">
              {data.callQueue.length ? data.callQueue.map((item) => (
                <div key={item.id} className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="font-semibold text-white">{item.customer.customerName || item.phone}</div>
                      <div className="mt-1 text-sm text-slate-400">
                        {item.title} · {item.phone}
                      </div>
                      <div className="mt-2 text-xs text-slate-500">
                        Due {formatDateTime(item.dueAt)} · Updated {formatDateTime(item.updatedAt)}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className={`rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${statusTone(item.status)}`}>
                        {item.statusLabel}
                      </span>
                      <Link href={item.links.customer} className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-100 transition hover:border-white/20">
                        Open customer
                      </Link>
                      <a href={item.links.callBack} className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-100 transition hover:border-cyan-400">
                        Call back
                      </a>
                      {item.type === "task" ? (
                        <button
                          type="button"
                          onClick={() => handleResolveTask(item.id)}
                          className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-100 transition hover:border-emerald-400"
                        >
                          Resolve
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              )) : (
                <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-5 text-sm text-slate-400">
                  No pending queue items right now.
                </div>
              )}
            </div>
          </div>

          <div className={cardShell("p-5")}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Recordings</div>
                <h2 className="mt-2 text-2xl font-semibold text-white">Recent call recordings</h2>
              </div>
              <div className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-slate-300">
                {data.recentRecordings.length} saved
              </div>
            </div>

            <div className="mt-4 grid gap-3">
              {data.recentRecordings.length ? data.recentRecordings.map((call) => (
                <div key={call.id} className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-white">{call.customer.customerName || call.callerNumber}</div>
                      <div className="mt-1 text-sm text-slate-400">
                        {call.callerNumber} · {formatDateTime(call.startedAt || call.createdAt)}
                      </div>
                      <div className="mt-2 text-xs text-slate-500">
                        {formatDuration(call.durationInSeconds)} · {formatMoney(call.amount, call.currencyCode)}
                      </div>
                    </div>
                    {call.recordingUrl ? (
                      <a
                        href={call.recordingUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-emerald-100 transition hover:border-emerald-400"
                      >
                        Open
                      </a>
                    ) : null}
                  </div>
                </div>
              )) : (
                <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-5 text-sm text-slate-400">
                  No recordings available yet.
                </div>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
