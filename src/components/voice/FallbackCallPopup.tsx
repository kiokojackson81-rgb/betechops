"use client";

import { ArrowRightLeft, ExternalLink, History, Package2, PhoneCall, PhoneForwarded, PhoneOff, ShoppingBag, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSoftphone } from "@/components/voice/SoftphoneProvider";
import type { VoiceLiveSnapshot } from "@/lib/voiceOperations";

type PopupSnapshot = VoiceLiveSnapshot | null;
type PopupTab = "overview" | "history" | "transfer";
const STREAM_STALE_AFTER_MS = 45_000;

function formatCurrency(value: number | null | undefined) {
  return `KES ${Number(value || 0).toLocaleString("en-KE")}`;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Just now";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Just now";
  return new Intl.DateTimeFormat("en-KE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatDurationFromSeconds(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;
  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function isRecipientCallActive(status: string | null | undefined) {
  return ["RINGING", "DIALING", "ANSWERED", "CONNECTED", "TRANSFERRED"].includes(String(status || "").trim().toUpperCase());
}

function getCallerInitials(name: string) {
  const normalized = String(name || "").trim();
  if (!normalized) return "VC";
  const parts = normalized.split(/\s+/).filter(Boolean).slice(0, 2);
  if (!parts.length) return normalized.slice(0, 2).toUpperCase();
  return parts.map((part) => part.slice(0, 1).toUpperCase()).join("").slice(0, 2);
}

function getStatusTheme(status: string | null | undefined) {
  const normalized = String(status || "").trim().toUpperCase();
  if (normalized === "RINGING" || normalized === "DIALING") {
    return {
      badge: "border-amber-400/30 bg-amber-500/12 text-amber-100",
      text: "text-amber-200",
      avatar: "border-amber-400/30 bg-amber-500/12 text-amber-100 shadow-[0_0_0_6px_rgba(245,158,11,0.08)]",
      pulse: "bg-amber-400",
    };
  }
  if (normalized === "ANSWERED" || normalized === "CONNECTED" || normalized === "TRANSFERRED") {
    return {
      badge: "border-emerald-400/30 bg-emerald-500/12 text-emerald-100",
      text: "text-emerald-200",
      avatar: "border-emerald-400/30 bg-emerald-500/12 text-emerald-100 shadow-[0_0_0_6px_rgba(16,185,129,0.08)]",
      pulse: "bg-emerald-400",
    };
  }
  return {
    badge: "border-cyan-400/30 bg-cyan-500/12 text-cyan-100",
    text: "text-cyan-200",
    avatar: "border-cyan-400/30 bg-cyan-500/12 text-cyan-100 shadow-[0_0_0_6px_rgba(34,211,238,0.08)]",
    pulse: "bg-cyan-400",
  };
}

function buildVoiceDeskHref(snapshot: NonNullable<PopupSnapshot>) {
  const params = new URLSearchParams();
  if (snapshot.selectedCallId) params.set("selectedCallId", snapshot.selectedCallId);
  if (snapshot.selectedPhone) params.set("selectedPhone", snapshot.selectedPhone);
  if (snapshot.viewer.impersonateId) params.set("impersonateId", snapshot.viewer.impersonateId);

  const base =
    snapshot.viewer.isAdmin
      ? "/admin/communications/voice"
      : "/attendant/voice";

  return `${base}${params.toString() ? `?${params.toString()}` : ""}`;
}

function getSnapshotTimestamp(snapshot: PopupSnapshot) {
  if (!snapshot?.generatedAt) return 0;
  const timestamp = new Date(snapshot.generatedAt).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export default function FallbackCallPopup() {
  const softphone = useSoftphone();
  const streamRef = useRef<EventSource | null>(null);
  const [snapshot, setSnapshot] = useState<PopupSnapshot>(null);
  const [streamError, setStreamError] = useState(false);
  const [feedDelayed, setFeedDelayed] = useState(false);
  const [streamNonce, setStreamNonce] = useState(0);
  const [lastStreamActivityAt, setLastStreamActivityAt] = useState<number>(Date.now());
  const [dismissedCallId, setDismissedCallId] = useState<string | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<PopupTab>("overview");
  const [transferPending, setTransferPending] = useState(false);
  const [transferAssigneeId, setTransferAssigneeId] = useState("");
  const [transferPhone, setTransferPhone] = useState("");
  const [transferError, setTransferError] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [notePending, setNotePending] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [callTimerLabel, setCallTimerLabel] = useState("00:00");

  useEffect(() => {
    const eventSource = new EventSource("/api/voice/live?stream=1&scope=mine");
    streamRef.current = eventSource;
    let restartScheduled = false;

    eventSource.addEventListener("snapshot", (event) => {
      setStreamError(false);
      setFeedDelayed(false);
      setLastStreamActivityAt(Date.now());
      try {
        const payload = JSON.parse((event as MessageEvent).data) as { snapshot?: VoiceLiveSnapshot };
        if (!payload.snapshot) return;
        setSnapshot((previous) => {
          const previousTime = getSnapshotTimestamp(previous);
          const nextTime = getSnapshotTimestamp(payload.snapshot ?? null);
          return nextTime >= previousTime ? payload.snapshot ?? null : previous;
        });
      } catch {
        // Keep the last good snapshot instead of blanking the popup during transient parse errors.
      }
    });

    eventSource.addEventListener("heartbeat", () => {
      setStreamError(false);
      setFeedDelayed(false);
      setLastStreamActivityAt(Date.now());
    });

    eventSource.addEventListener("reconnect", () => {
      eventSource.close();
      streamRef.current = null;
      if (!restartScheduled) {
        restartScheduled = true;
        setStreamNonce((value) => value + 1);
      }
    });

    eventSource.onerror = () => {
      setStreamError(true);
      eventSource.close();
      streamRef.current = null;
      if (!restartScheduled) {
        restartScheduled = true;
        window.setTimeout(() => {
          setStreamNonce((value) => value + 1);
        }, 1500);
      }
    };

    return () => {
      eventSource.close();
      streamRef.current = null;
    };
  }, [streamNonce]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setFeedDelayed(Date.now() - lastStreamActivityAt > STREAM_STALE_AFTER_MS);
    }, 5000);
    return () => window.clearInterval(interval);
  }, [lastStreamActivityAt]);

  const myPresence = useMemo(() => {
    return snapshot?.agents.find((agent) => agent.id === snapshot.viewer.targetUserId) ?? null;
  }, [snapshot]);

  const activeRecipientCall = useMemo(() => {
    if (!snapshot) return null;
    return (
      snapshot.activeCalls.find(
        (call) => call.assignedToId === snapshot.viewer.targetUserId && isRecipientCallActive(call.status),
      ) ?? null
    );
  }, [snapshot]);

  useEffect(() => {
    setDismissedCallId(snapshot?.viewer.popupDismissedCallId ?? null);
  }, [snapshot?.viewer.popupDismissedCallId]);

  useEffect(() => {
    if (!activeRecipientCall || dismissedCallId !== activeRecipientCall.id) return;
    if (!isRecipientCallActive(activeRecipientCall.status)) {
      setDismissedCallId(null);
    }
  }, [activeRecipientCall, dismissedCallId]);

  useEffect(() => {
    if (!activeRecipientCall) {
      setTransferOpen(false);
      setActiveTab("overview");
      setTransferAssigneeId("");
      setTransferPhone("");
      setTransferError(null);
      setNoteDraft("");
      setNoteError(null);
    }
  }, [activeRecipientCall]);

  const canShowPopup =
    Boolean(snapshot) &&
    Boolean(myPresence) &&
    myPresence?.status === "AVAILABLE" &&
    Boolean(activeRecipientCall) &&
    dismissedCallId !== activeRecipientCall?.id;
  const canShowMiniStrip =
    Boolean(snapshot) &&
    Boolean(activeRecipientCall) &&
    dismissedCallId === activeRecipientCall?.id;

  const recentTimeline = snapshot?.selectedContext?.recentTimeline?.slice(0, 4) ?? [];
  const recentNotes = snapshot?.selectedContext?.recentNotes?.slice(0, 2) ?? [];
  const visibleAgents = useMemo(
    () => (snapshot?.agents || []).filter((agent) => agent.id !== snapshot?.viewer.targetUserId),
    [snapshot],
  );
  const deskHref = snapshot ? buildVoiceDeskHref(snapshot) : "/admin/communications/voice";
  const latestReceiptHref = snapshot?.selectedContext?.latestReceiptId
    ? `/marketing/receipts?tab=pos&receiptId=${encodeURIComponent(snapshot.selectedContext.latestReceiptId)}`
    : null;
  const latestQuoteHref = snapshot?.selectedContext?.latestQuotationId
    ? `/marketing/receipts?tab=quotations&quoteId=${encodeURIComponent(snapshot.selectedContext.latestQuotationId)}`
    : null;

  const persistPopupDismissal = (nextDismissedPopupCallId: string | null) => {
    return fetch("/api/voice/popup-state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dismissedPopupCallId: nextDismissedPopupCallId,
      }),
    });
  };

  const handleDismiss = () => {
    if (activeRecipientCall?.id) {
      setDismissedCallId(activeRecipientCall.id);
      void persistPopupDismissal(activeRecipientCall.id);
    }
  };

  const handleTransfer = async () => {
    if (!activeRecipientCall?.id) return;
    if (!transferAssigneeId && !transferPhone.trim()) {
      setTransferError("Choose an agent or enter a phone number.");
      return;
    }

    setTransferPending(true);
    setTransferError(null);
    try {
      const response = await fetch("/api/voice/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          callId: activeRecipientCall.id,
          targetUserId: transferAssigneeId || null,
          targetPhone: transferPhone.trim() || null,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(String(payload.error || "transfer_failed"));
      }
      setTransferOpen(false);
      setActiveTab("overview");
      setTransferAssigneeId("");
      setTransferPhone("");
      setDismissedCallId(activeRecipientCall.id);
      void persistPopupDismissal(activeRecipientCall.id);
    } catch (error) {
      setTransferError(error instanceof Error ? error.message : "Could not transfer the call.");
    } finally {
      setTransferPending(false);
    }
  };

  const handleAddNote = async () => {
    if (!activeRecipientCall?.id || !noteDraft.trim()) return;
    setNotePending(true);
    setNoteError(null);
    try {
      const response = await fetch("/api/voice/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          voiceCallId: activeRecipientCall.id,
          note: noteDraft.trim(),
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(String(payload.error || "voice_note_failed"));
      }
      setNoteDraft("");
      setStreamNonce((value) => value + 1);
    } catch (error) {
      setNoteError(error instanceof Error ? error.message : "Could not save the note.");
    } finally {
      setNotePending(false);
    }
  };

  useEffect(() => {
    if (!snapshot || !activeRecipientCall) {
      setCallTimerLabel("00:00");
      return;
    }

    const calculateTimer = () => {
      const anchor = new Date(activeRecipientCall.startedAt || activeRecipientCall.createdAt || snapshot.generatedAt).getTime();
      if (Number.isNaN(anchor)) {
        setCallTimerLabel("00:00");
        return;
      }
      const elapsedSeconds = Math.max(0, Math.floor((Date.now() - anchor) / 1000));
      setCallTimerLabel(formatDurationFromSeconds(elapsedSeconds));
    };

    calculateTimer();
    const interval = window.setInterval(calculateTimer, 1000);
    return () => window.clearInterval(interval);
  }, [activeRecipientCall, snapshot]);

  if (!snapshot || !activeRecipientCall) {
    return null;
  }

  const customerName =
    activeRecipientCall.customer.customerName ||
    snapshot.selectedContext?.customerName ||
    activeRecipientCall.callerNumber ||
    "Incoming caller";
  const purchaseTotal = snapshot.selectedContext?.totalPurchasesValue || activeRecipientCall.customer.totalPurchasesValue || 0;
  const linkedRecords = snapshot.selectedContext?.linkedRecords || activeRecipientCall.customer.linkedRecords;
  const hasBrowserLeg =
    Boolean(softphone.currentCall) &&
    String(softphone.currentCall?.remoteIdentity || "").trim() === String(activeRecipientCall.callerNumber || "").trim();
  const tabs: Array<{ key: PopupTab; label: string }> = [
    { key: "overview", label: "Overview" },
    { key: "history", label: "History" },
    { key: "transfer", label: "Transfer" },
  ];
  const callerInitials = getCallerInitials(customerName);
  const statusTheme = getStatusTheme(activeRecipientCall.statusLabel || activeRecipientCall.status);
  const routeLabel = activeRecipientCall.queueReasonLabel || activeRecipientCall.routedToDisplay || "Live queue";
  const lastUpdatedAt = activeRecipientCall.startedAt || activeRecipientCall.createdAt || snapshot.generatedAt;

  if (!canShowPopup && canShowMiniStrip) {
    return (
      <div className="pointer-events-none fixed inset-x-0 bottom-3 z-[95] flex justify-center px-3 sm:justify-end sm:px-5">
        <aside className="pointer-events-auto w-full max-w-[32rem] rounded-[24px] border border-cyan-400/20 bg-[linear-gradient(180deg,rgba(7,12,25,0.96),rgba(2,6,18,0.98))] shadow-[0_24px_80px_rgba(2,8,20,0.55)] backdrop-blur-xl">
          <div className="flex flex-wrap items-center gap-3 px-4 py-3">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <div className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full border text-sm font-semibold ${statusTheme.avatar}`}>
                <span className={`absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border border-slate-950 ${statusTheme.pulse}`} />
                {callerInitials}
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-white">{customerName}</div>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-400">
                  <span className={`inline-flex rounded-full border px-2 py-0.5 font-semibold uppercase tracking-[0.16em] ${statusTheme.badge}`}>
                    {activeRecipientCall.statusLabel}
                  </span>
                  <span className="truncate">{activeRecipientCall.callerNumber}</span>
                  <span className="shrink-0 text-slate-500">{callTimerLabel}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setDismissedCallId(null);
                  void persistPopupDismissal(null);
                }}
                className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:border-cyan-400"
              >
                Open Call
              </button>
              <Link
                href={deskHref}
                className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-white/20"
              >
                Live Desk
              </Link>
              {hasBrowserLeg ? (
                <button
                  type="button"
                  onClick={softphone.hangUp}
                  className="rounded-full border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-sm font-semibold text-rose-100 transition hover:border-rose-400"
                >
                  End
                </button>
              ) : null}
            </div>
          </div>
        </aside>
      </div>
    );
  }

  if (!canShowPopup) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 bottom-3 z-[95] flex justify-center px-3 sm:justify-end sm:px-5">
      <aside className="pointer-events-auto flex h-full w-full max-w-[42rem] flex-col overflow-hidden rounded-[28px] border border-cyan-400/20 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.14),transparent_38%),linear-gradient(180deg,rgba(7,12,25,0.98),rgba(2,6,18,1))] shadow-[0_32px_120px_rgba(2,8,20,0.6)] backdrop-blur-xl sm:max-h-[calc(100vh-1.5rem)]">
        <div className="shrink-0 border-b border-white/10 px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-4">
              <div className={`relative mt-1 flex h-16 w-16 shrink-0 items-center justify-center rounded-full border text-lg font-semibold ${statusTheme.avatar}`}>
                <span className={`absolute -right-0.5 top-0.5 h-3.5 w-3.5 rounded-full border border-slate-950 ${statusTheme.pulse}`} />
                {callerInitials}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.26em] text-cyan-300">
                <PhoneForwarded className="h-3.5 w-3.5" />
                Live Mobile Call
                </div>
                <h2 className="mt-2 truncate text-[2rem] font-semibold leading-none text-white">{customerName}</h2>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${statusTheme.badge}`}>
                    {activeRecipientCall.statusLabel}
                  </span>
                  <span className="truncate text-sm text-slate-300">{activeRecipientCall.callerNumber}</span>
                  <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[11px] font-semibold tracking-[0.14em] text-white">
                    {callTimerLabel}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-slate-300">
                    {snapshot.selectedContext?.location || "Location unknown"}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-slate-300">
                    Assigned: {snapshot.selectedContext?.assignedAgent?.name || activeRecipientCall.assignedToName || "Unassigned"}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-slate-300">
                    Route: {routeLabel}
                  </span>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={handleDismiss}
              className="rounded-full border border-white/10 bg-white/[0.04] p-2 text-slate-300 transition hover:border-white/20 hover:text-white"
              aria-label="Dismiss call popup"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3">
              <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Status</div>
              <div className={`mt-1 text-sm font-semibold ${statusTheme.text}`}>{activeRecipientCall.statusLabel}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3">
              <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Spent</div>
              <div className="mt-1 text-sm font-semibold text-white">{formatCurrency(purchaseTotal)}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3">
              <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Updated</div>
              <div className="mt-1 text-sm font-semibold text-white">{formatDateTime(lastUpdatedAt)}</div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => {
                  setActiveTab(tab.key);
                  setTransferOpen(tab.key === "transfer");
                }}
                className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                  activeTab === tab.key
                    ? "border-cyan-400/40 bg-cyan-500/12 text-cyan-100"
                    : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/20 hover:text-white"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {activeTab === "overview" ? (
            <div className="space-y-4">
              <div className="grid gap-3 lg:grid-cols-[1.08fr_0.92fr]">
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    <ShoppingBag className="h-3.5 w-3.5" />
                    Purchase Snapshot
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {[
                      ["Receipts", linkedRecords?.receipts ?? 0],
                      ["Quotes", linkedRecords?.quotations ?? 0],
                      ["Web Orders", linkedRecords?.webOrders ?? 0],
                      ["POD / Pending", (snapshot.selectedContext?.pendingPod ?? 0) + (snapshot.selectedContext?.pendingWebOrders ?? 0)],
                    ].map(([label, value]) => (
                      <div key={String(label)} className="rounded-xl border border-white/8 bg-slate-950/40 px-3 py-3">
                        <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">{label}</div>
                        <div className="mt-1 text-lg font-semibold text-white">{value}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    <Package2 className="h-3.5 w-3.5" />
                    Customer Context
                  </div>
                  <div className="mt-4 space-y-3">
                    {[
                      ["Location", snapshot.selectedContext?.location || "Unknown"],
                      ["Open Quotes", snapshot.selectedContext?.openQuotations ?? 0],
                      ["Matched CRM", snapshot.selectedContext?.matchedCustomerId ? "Yes" : "No"],
                      ["Assigned Agent", snapshot.selectedContext?.assignedAgent?.name || activeRecipientCall.assignedToName || "Unassigned"],
                    ].map(([label, value]) => (
                      <div key={String(label)} className="flex items-start justify-between gap-3 rounded-xl border border-white/8 bg-slate-950/40 px-3 py-3">
                        <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">{label}</div>
                        <div className="text-right text-sm font-medium text-white">{String(value)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {recentNotes.length ? (
                <div className="rounded-2xl border border-cyan-500/15 bg-cyan-500/5 px-4 py-4 text-sm text-cyan-50">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-300">Latest Note</div>
                  <div className="mt-2">{recentNotes[0]?.note}</div>
                </div>
              ) : null}

              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Quick Note</div>
                <div className="mt-1 text-sm text-slate-300">Capture context without leaving the popup.</div>
                <div className="mt-3 grid gap-3">
                  <textarea
                    value={noteDraft}
                    onChange={(event) => setNoteDraft(event.target.value)}
                    placeholder="Add a short note about this call"
                    rows={3}
                    className="rounded-2xl border border-slate-800 bg-slate-950/80 px-3 py-3 text-sm text-white outline-none placeholder:text-slate-500"
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleAddNote}
                      disabled={notePending || !noteDraft.trim()}
                      className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-2.5 text-sm font-semibold text-cyan-100 transition hover:border-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {notePending ? "Saving..." : "Save Note"}
                    </button>
                    {noteError ? <div className="text-sm text-rose-300">{noteError}</div> : null}
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {activeTab === "history" ? (
            <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  <History className="h-3.5 w-3.5" />
                  Recent Activity
                </div>
                {streamError || feedDelayed ? (
                  <div className="text-[10px] uppercase tracking-[0.18em] text-amber-300">
                    {streamError ? "Reconnecting feed" : "Feed delayed"}
                  </div>
                ) : null}
              </div>
              <div className="mt-4 space-y-3">
                {recentTimeline.length ? (
                  recentTimeline.map((item) => (
                    <div key={item.id} className="rounded-xl border border-white/6 bg-white/[0.02] px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 truncate text-sm font-medium text-white">{item.title}</div>
                        <div className="shrink-0 text-[11px] text-slate-500">{formatDateTime(item.at)}</div>
                      </div>
                      <div className="mt-1 text-sm text-slate-300">{item.detail || "No extra detail"}</div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-xl border border-dashed border-white/10 px-3 py-4 text-sm text-slate-400">
                    No recent customer timeline found yet.
                  </div>
                )}
              </div>
            </div>
          ) : null}

          {activeTab === "transfer" || transferOpen ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Transfer This Call</div>
              <div className="mt-1 text-sm text-slate-300">
                Reassign the live call to another routing agent or log an external transfer number.
              </div>
              <div className="mt-3 grid gap-3">
                <select
                  value={transferAssigneeId}
                  onChange={(event) => setTransferAssigneeId(event.target.value)}
                  className="rounded-2xl border border-slate-800 bg-slate-950/80 px-3 py-3 text-sm text-white outline-none"
                >
                  <option value="">Select routing agent</option>
                  {visibleAgents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.displayName} · {agent.isAvailableForRouting ? "Available" : agent.status === "AVAILABLE" ? "Stale" : "Busy"}
                    </option>
                  ))}
                </select>
                <div className="grid gap-2">
                  {visibleAgents.map((agent) => (
                    <button
                      key={agent.id}
                      type="button"
                      onClick={() => setTransferAssigneeId(agent.id)}
                      className={`flex items-center justify-between rounded-2xl border px-3 py-3 text-left transition ${
                        transferAssigneeId === agent.id
                          ? "border-cyan-400/40 bg-cyan-500/10"
                          : "border-white/10 bg-slate-950/40 hover:border-white/20"
                      }`}
                    >
                      <div>
                        <div className="text-sm font-semibold text-white">{agent.displayName}</div>
                        <div className="mt-1 text-xs text-slate-400">{agent.phone || agent.email || "No direct number"}</div>
                      </div>
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${
                          agent.isAvailableForRouting
                            ? "border-emerald-400/30 bg-emerald-500/12 text-emerald-100"
                            : agent.status === "AVAILABLE"
                              ? "border-amber-400/30 bg-amber-500/12 text-amber-100"
                              : "border-rose-400/30 bg-rose-500/12 text-rose-100"
                        }`}
                      >
                        {agent.isAvailableForRouting ? "Available" : agent.status === "AVAILABLE" ? "Stale" : "Busy"}
                      </span>
                    </button>
                  ))}
                </div>
                <input
                  value={transferPhone}
                  onChange={(event) => setTransferPhone(event.target.value)}
                  placeholder="Or enter external phone number"
                  className="rounded-2xl border border-slate-800 bg-slate-950/80 px-3 py-3 text-sm text-white outline-none placeholder:text-slate-500"
                />
                {transferError ? <div className="text-sm text-rose-300">{transferError}</div> : null}
                <div className="flex flex-wrap gap-2">
                  {latestReceiptHref ? (
                    <Link
                      href={latestReceiptHref}
                      className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-slate-100 transition hover:border-white/20"
                    >
                      Latest Receipt
                    </Link>
                  ) : null}
                  {latestQuoteHref ? (
                    <Link
                      href={latestQuoteHref}
                      className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-slate-100 transition hover:border-white/20"
                    >
                      Latest Quote
                    </Link>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="shrink-0 border-t border-white/10 bg-slate-950/80 px-5 py-4 backdrop-blur-xl">
          <div className="flex flex-wrap gap-2">
            <Link
              href={deskHref}
              className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-2.5 text-sm font-semibold text-cyan-100 transition hover:border-cyan-400"
            >
              <ExternalLink className="h-4 w-4" />
              Open Live Desk
            </Link>
            <button
              type="button"
              onClick={() => {
                setActiveTab("transfer");
                setTransferOpen(true);
              }}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-slate-100 transition hover:border-white/20"
            >
              <ArrowRightLeft className="h-4 w-4" />
              Transfer
            </button>
            <a
              href={`tel:${encodeURIComponent(activeRecipientCall.callerNumber)}`}
              className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm font-semibold text-emerald-100 transition hover:border-emerald-400"
            >
              <PhoneCall className="h-4 w-4" />
              Call Back
            </a>
            {hasBrowserLeg ? (
              <button
                type="button"
                onClick={softphone.hangUp}
                className="inline-flex items-center gap-2 rounded-full border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-sm font-semibold text-rose-100 transition hover:border-rose-400"
              >
                <PhoneOff className="h-4 w-4" />
                End Browser Leg
              </button>
            ) : null}
            {activeTab === "transfer" || transferOpen ? (
              <button
                type="button"
                onClick={handleTransfer}
                disabled={transferPending || (!transferAssigneeId && !transferPhone.trim())}
                className="ml-auto rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-2.5 text-sm font-semibold text-cyan-100 transition hover:border-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {transferPending ? "Transferring..." : "Confirm Transfer"}
              </button>
            ) : null}
          </div>
        </div>
      </aside>
    </div>
  );
}
