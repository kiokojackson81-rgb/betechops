"use client";

import { ArrowRightLeft, ExternalLink, History, Package2, PhoneCall, PhoneForwarded, PhoneOff, ShoppingBag, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSoftphone } from "@/components/voice/SoftphoneProvider";
import type { VoiceLiveSnapshot } from "@/lib/voiceOperations";

type PopupSnapshot = VoiceLiveSnapshot | null;

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

function isRecipientCallActive(status: string | null | undefined) {
  return ["RINGING", "DIALING", "ANSWERED", "CONNECTED", "TRANSFERRED"].includes(String(status || "").trim().toUpperCase());
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

export default function FallbackCallPopup() {
  const softphone = useSoftphone();
  const streamRef = useRef<EventSource | null>(null);
  const [snapshot, setSnapshot] = useState<PopupSnapshot>(null);
  const [streamError, setStreamError] = useState(false);
  const [streamNonce, setStreamNonce] = useState(0);
  const [dismissedCallId, setDismissedCallId] = useState<string | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferPending, setTransferPending] = useState(false);
  const [transferAssigneeId, setTransferAssigneeId] = useState("");
  const [transferPhone, setTransferPhone] = useState("");
  const [transferError, setTransferError] = useState<string | null>(null);

  useEffect(() => {
    const eventSource = new EventSource("/api/voice/live?stream=1&scope=mine");
    streamRef.current = eventSource;
    let restartScheduled = false;

    eventSource.addEventListener("snapshot", (event) => {
      setStreamError(false);
      try {
        const payload = JSON.parse((event as MessageEvent).data) as { snapshot?: VoiceLiveSnapshot };
        setSnapshot(payload.snapshot ?? null);
      } catch {
        setSnapshot(null);
      }
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
    if (!activeRecipientCall || dismissedCallId !== activeRecipientCall.id) return;
    if (!isRecipientCallActive(activeRecipientCall.status)) {
      setDismissedCallId(null);
    }
  }, [activeRecipientCall, dismissedCallId]);

  useEffect(() => {
    if (!activeRecipientCall) {
      setTransferOpen(false);
      setTransferAssigneeId("");
      setTransferPhone("");
      setTransferError(null);
    }
  }, [activeRecipientCall]);

  const canShowPopup =
    Boolean(snapshot) &&
    Boolean(myPresence) &&
    myPresence?.status === "AVAILABLE" &&
    Boolean(activeRecipientCall) &&
    dismissedCallId !== activeRecipientCall?.id;

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

  const handleDismiss = () => {
    if (activeRecipientCall?.id) {
      setDismissedCallId(activeRecipientCall.id);
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
      setTransferAssigneeId("");
      setTransferPhone("");
      setDismissedCallId(activeRecipientCall.id);
    } catch (error) {
      setTransferError(error instanceof Error ? error.message : "Could not transfer the call.");
    } finally {
      setTransferPending(false);
    }
  };

  if (!canShowPopup || !snapshot || !activeRecipientCall) {
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

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[95] flex justify-center px-3 sm:justify-end sm:px-5">
      <aside className="pointer-events-auto w-full max-w-[28rem] overflow-hidden rounded-[28px] border border-cyan-400/20 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.14),transparent_38%),linear-gradient(180deg,rgba(7,12,25,0.98),rgba(2,6,18,1))] shadow-[0_32px_120px_rgba(2,8,20,0.6)] backdrop-blur-xl">
        <div className="border-b border-white/10 px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.26em] text-cyan-300">
                <PhoneForwarded className="h-3.5 w-3.5" />
                Live Mobile Call
              </div>
              <h2 className="mt-2 truncate text-2xl font-semibold text-white">{customerName}</h2>
              <div className="mt-1 truncate text-sm text-slate-300">{activeRecipientCall.callerNumber}</div>
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
              <div className="mt-1 text-sm font-semibold text-emerald-200">{activeRecipientCall.statusLabel}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3">
              <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Spent</div>
              <div className="mt-1 text-sm font-semibold text-white">{formatCurrency(purchaseTotal)}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3">
              <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Updated</div>
              <div className="mt-1 text-sm font-semibold text-white">{formatDateTime(snapshot.generatedAt)}</div>
            </div>
          </div>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                <ShoppingBag className="h-3.5 w-3.5" />
                Purchase Snapshot
              </div>
              <div className="mt-3 space-y-2 text-sm text-slate-200">
                <div>Receipts: {linkedRecords?.receipts ?? 0}</div>
                <div>Quotes: {linkedRecords?.quotations ?? 0}</div>
                <div>Web Orders: {linkedRecords?.webOrders ?? 0}</div>
                <div>POD / Pending: {(snapshot.selectedContext?.pendingPod ?? 0) + (snapshot.selectedContext?.pendingWebOrders ?? 0)}</div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                <Package2 className="h-3.5 w-3.5" />
                Customer Context
              </div>
              <div className="mt-3 space-y-2 text-sm text-slate-200">
                <div>Location: {snapshot.selectedContext?.location || "Unknown"}</div>
                <div>Open Quotes: {snapshot.selectedContext?.openQuotations ?? 0}</div>
                <div>Matched CRM: {snapshot.selectedContext?.matchedCustomerId ? "Yes" : "No"}</div>
                <div>Assigned Agent: {snapshot.selectedContext?.assignedAgent?.name || activeRecipientCall.assignedToName || "Unassigned"}</div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                <History className="h-3.5 w-3.5" />
                Recent Activity
              </div>
              {streamError ? <div className="text-[10px] uppercase tracking-[0.18em] text-amber-300">Reconnecting feed</div> : null}
            </div>
            <div className="mt-3 space-y-2">
              {recentTimeline.length ? (
                recentTimeline.map((item) => (
                  <div key={item.id} className="rounded-xl border border-white/6 bg-white/[0.02] px-3 py-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 truncate text-sm font-medium text-white">{item.title}</div>
                      <div className="shrink-0 text-[11px] text-slate-500">{formatDateTime(item.at)}</div>
                    </div>
                    <div className="mt-1 line-clamp-2 text-xs text-slate-400">{item.detail || "No extra detail"}</div>
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-white/10 px-3 py-4 text-sm text-slate-400">
                  No recent customer timeline found yet.
                </div>
              )}
            </div>
            {recentNotes.length ? (
              <div className="mt-3 rounded-xl border border-cyan-500/15 bg-cyan-500/5 px-3 py-3 text-sm text-cyan-50">
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-300">Latest Note</div>
                <div className="mt-1 line-clamp-2">{recentNotes[0]?.note}</div>
              </div>
            ) : null}
          </div>

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
              onClick={() => setTransferOpen((value) => !value)}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-slate-100 transition hover:border-white/20"
            >
              <ArrowRightLeft className="h-4 w-4" />
              {transferOpen ? "Hide Transfer" : "Transfer"}
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
          </div>

          {transferOpen ? (
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
                      {agent.displayName}
                    </option>
                  ))}
                </select>
                <input
                  value={transferPhone}
                  onChange={(event) => setTransferPhone(event.target.value)}
                  placeholder="Or enter external phone number"
                  className="rounded-2xl border border-slate-800 bg-slate-950/80 px-3 py-3 text-sm text-white outline-none placeholder:text-slate-500"
                />
                {transferError ? <div className="text-sm text-rose-300">{transferError}</div> : null}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleTransfer}
                    disabled={transferPending || (!transferAssigneeId && !transferPhone.trim())}
                    className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-2.5 text-sm font-semibold text-cyan-100 transition hover:border-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {transferPending ? "Transferring..." : "Confirm Transfer"}
                  </button>
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
      </aside>
    </div>
  );
}
