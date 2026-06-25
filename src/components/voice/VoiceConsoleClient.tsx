"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import CallStatusBar from "@/components/voice/CallStatusBar";
import RegistrationBadge from "@/components/voice/RegistrationBadge";
import { useSoftphone } from "@/components/voice/SoftphoneProvider";
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

const PRESENCE_STATUSES = ["AVAILABLE", "AWAY", "BUSY", "BREAK", "OFFLINE"] as const;
const VOICE_CONSOLE_TABS = ["operations", "recent", "recordings", "followups", "agents"] as const;
type VoiceConsoleTab = (typeof VOICE_CONSOLE_TABS)[number];

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

function formatTimeOnly(value: string | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleString("en-KE", {
    timeZone: "Africa/Nairobi",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatRefreshStamp(value: string | null | undefined) {
  if (!value) return "Not refreshed yet";
  return `Last refreshed ${new Date(value).toLocaleString("en-KE", {
    timeZone: "Africa/Nairobi",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

function getRecentCallBucket(value: string | null | undefined) {
  if (!value) return "Earlier";
  const callDate = new Date(value);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfWeek.getDate() - 7);
  if (callDate >= startOfToday) return "Today";
  if (callDate >= startOfYesterday) return "Yesterday";
  if (callDate >= startOfWeek) return "This Week";
  return "Earlier";
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
  return `rounded-[24px] border border-slate-800/80 bg-slate-950/92 backdrop-blur-md ${extra}`.trim();
}

function getInitials(value: string | null | undefined) {
  const text = String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
  return text || "VC";
}

function normalizeVoiceTab(value: string | null): VoiceConsoleTab {
  return VOICE_CONSOLE_TABS.includes(value as VoiceConsoleTab) ? (value as VoiceConsoleTab) : "operations";
}

function isFreshIncomingCall(value: string | null | undefined, maxAgeMs = 5 * 60 * 1000) {
  if (!value) return false;
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return false;
  return Date.now() - timestamp <= maxAgeMs;
}

function isDeveloperPlaceholderPhone(phone: string | null | undefined) {
  const normalized = String(phone || "").replace(/\s+/g, "");
  if (!normalized) return false;
  if (["+254711111111", "0711111111", "+254700000001", "0700000001"].includes(normalized)) return true;
  return /^(\+254|0)7(\d)\2{7,}$/.test(normalized);
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
  const softphone = useSoftphone();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [data, setData] = useState(initialData);
  const [selectedCallId, setSelectedCallId] = useState(initialData.selectedCallId);
  const [selectedPhone, setSelectedPhone] = useState(initialData.selectedPhone);
  const [lastRefreshAt, setLastRefreshAt] = useState(initialData.generatedAt);
  const [noteDraft, setNoteDraft] = useState("");
  const [followUpTitle, setFollowUpTitle] = useState("");
  const [followUpDueAt, setFollowUpDueAt] = useState("");
  const [followUpNotes, setFollowUpNotes] = useState("");
  const [submittingNote, setSubmittingNote] = useState(false);
  const [submittingFollowUp, setSubmittingFollowUp] = useState(false);
  const [presencePending, setPresencePending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [liveStatus, setLiveStatus] = useState<"connecting" | "live" | "offline">("connecting");
  const [manualPresence, setManualPresence] = useState<string | null>(null);
  const [dismissedIncomingIds, setDismissedIncomingIds] = useState<string[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState<"overview" | "timeline" | "notes" | "followUps" | "recordings">("overview");
  const [recentSearch, setRecentSearch] = useState("");
  const [recentFilter, setRecentFilter] = useState<"all" | "INBOUND" | "OUTBOUND" | "with_recording">("all");
  const eventSourceRef = useRef<EventSource | null>(null);
  const lastInteractionAtRef = useRef(Date.now());
  const availabilityTimerRef = useRef<number | null>(null);
  const lastAnnouncedCallIdRef = useRef<string | null>(null);
  const activeTab = useMemo(() => normalizeVoiceTab(searchParams.get("tab")), [searchParams]);

  const switchTab = (tab: VoiceConsoleTab) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

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
    setLastRefreshAt(nextData.generatedAt);
    return nextData;
  };

  useEffect(() => {
    const params = new URLSearchParams();
    params.set("stream", "1");
    if (selectedCallId) params.set("selectedCallId", selectedCallId);
    if (selectedPhone) params.set("selectedPhone", selectedPhone);
    const separator = pollBaseHref.includes("?") ? "&" : "?";
    const eventSource = new EventSource(`${pollBaseHref}${separator}${params.toString()}`);
    eventSourceRef.current = eventSource;
    setLiveStatus("connecting");

    eventSource.onopen = () => {
      setLiveStatus("live");
      setError(null);
    };
    eventSource.onerror = () => {
      setLiveStatus("offline");
    };
    eventSource.addEventListener("snapshot", (event) => {
      try {
        const payload = JSON.parse((event as MessageEvent).data) as { snapshot?: VoiceLiveSnapshot };
        if (!payload.snapshot) return;
        setData(payload.snapshot);
        setSelectedCallId(payload.snapshot.selectedCallId);
        setSelectedPhone(payload.snapshot.selectedPhone);
        setLastRefreshAt(payload.snapshot.generatedAt);
      } catch (snapshotError) {
        console.error("[voice.console.sse_parse_failed]", snapshotError);
      }
    });

    return () => {
      try {
        eventSource.close();
      } catch {}
      eventSourceRef.current = null;
      setLiveStatus("offline");
    };
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

  const filteredRecentCalls = useMemo(() => {
    const query = recentSearch.trim().toLowerCase();
    return data.recentCalls.filter((call) => {
      const matchesFilter =
        recentFilter === "all" ||
        (recentFilter === "with_recording" ? Boolean(call.recordingUrl) : call.direction === recentFilter);
      if (!matchesFilter) return false;
      if (!query) return true;
      return [
        call.callerNumber,
        call.customer.customerName,
        call.routedToDisplay,
        call.statusLabel,
        call.assignedToName,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [data.recentCalls, recentFilter, recentSearch]);

  const groupedRecentCalls = useMemo(() => {
    const groups = new Map<string, typeof filteredRecentCalls>();
    for (const call of filteredRecentCalls) {
      const bucket = getRecentCallBucket(call.startedAt || call.createdAt);
      groups.set(bucket, [...(groups.get(bucket) || []), call]);
    }
    return Array.from(groups.entries());
  }, [filteredRecentCalls]);

  const myPresence = useMemo(() => {
    return data.agents.find((agent) => agent.id === data.viewer.targetUserId) || null;
  }, [data.agents, data.viewer.targetUserId]);

  const incomingCall = useMemo(() => {
    const calls = mode === "staff"
      ? data.waitingCalls.filter((call) => call.assignedToId === data.viewer.targetUserId)
      : data.waitingCalls;
    return (
      calls.find((call) => {
        if (dismissedIncomingIds.includes(call.id)) return false;
        if (isDeveloperPlaceholderPhone(call.callerNumber)) return false;
        return isFreshIncomingCall(call.startedAt || call.createdAt);
      }) || null
    );
  }, [data.viewer.targetUserId, data.waitingCalls, dismissedIncomingIds, mode]);

  useEffect(() => {
    if (!incomingCall) return;
    if (lastAnnouncedCallIdRef.current === incomingCall.id) return;
    lastAnnouncedCallIdRef.current = incomingCall.id;
    setDrawerOpen(true);
  }, [incomingCall]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent("voice-console-drawer", { detail: { open: drawerOpen } }));
    if (drawerOpen) {
      softphone.setCollapsed(true);
    }
    return () => {
      window.dispatchEvent(new CustomEvent("voice-console-drawer", { detail: { open: false } }));
    };
  }, [drawerOpen, softphone]);

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

  useEffect(() => {
    if (selectedCall?.customer) {
      softphone.seedCustomerContext({
        name: selectedCall.customer.customerName || selectedCall.callerNumber,
        phone: selectedCall.callerNumber,
        location: selectedCall.customer.location || "Unknown",
        totalSpent: selectedCall.customer.totalPurchasesValue || 0,
        recentOrders: selectedCall.customer.linkedRecords.webOrders || 0,
        recentQuotes: selectedCall.customer.linkedRecords.quotations || 0,
        recentReceipts: selectedCall.customer.linkedRecords.receipts || 0,
        notes: data.selectedContext?.recentNotes?.slice(0, 2).map((note) => note.note) || [],
      });
      return;
    }
    softphone.seedCustomerContext(null);
  }, [data.selectedContext?.recentNotes, selectedCall, softphone]);

  const handleSelectCall = (callId: string, phone: string) => {
    setSelectedCallId(callId);
    setSelectedPhone(phone);
    setDrawerOpen(true);
    setDrawerTab("overview");
    setError(null);
    refreshSnapshot(callId, phone).catch((selectionError) => {
      console.error("[voice.console.select_failed]", selectionError);
      setError("Failed to load the selected customer context.");
    });
  };

  const handleExportRecentCalls = () => {
    if (typeof window === "undefined") return;
    const rows = [
      ["Bucket", "Time", "Caller", "Direction", "Routed To", "Status", "Duration Seconds", "Cost", "Recording Url"],
      ...filteredRecentCalls.map((call) => [
        getRecentCallBucket(call.startedAt || call.createdAt),
        call.startedAt || call.createdAt,
        call.callerNumber,
        call.direction,
        call.routedToDisplay || "",
        call.statusLabel,
        String(call.durationInSeconds || 0),
        String(call.amount || 0),
        call.recordingUrl || "",
      ]),
    ];
    const csv = rows
      .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = `voice-recent-calls-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(href);
  };

  const handlePresenceUpdate = async (status: (typeof PRESENCE_STATUSES)[number]) => {
    setPresencePending(true);
    setError(null);
    setManualPresence(status === "AVAILABLE" || status === "AWAY" ? null : status);
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

  useEffect(() => {
    const markInteraction = () => {
      lastInteractionAtRef.current = Date.now();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        lastInteractionAtRef.current = Date.now();
      }
    };

    window.addEventListener("mousemove", markInteraction);
    window.addEventListener("keydown", markInteraction);
    window.addEventListener("touchstart", markInteraction, { passive: true });
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.removeEventListener("mousemove", markInteraction);
      window.removeEventListener("keydown", markInteraction);
      window.removeEventListener("touchstart", markInteraction);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (mode !== "staff") return;

    const pushAutoPresence = async () => {
      if (manualPresence && !["AVAILABLE", "AWAY"].includes(manualPresence)) return;
      const inactiveForMs = Date.now() - lastInteractionAtRef.current;
      const nextStatus = document.visibilityState === "hidden" || inactiveForMs > 60_000 ? "AWAY" : "AVAILABLE";
      if (myPresence?.status === nextStatus && inactiveForMs < 90_000) return;
      try {
        await fetch(`${pollBaseHref.replace("/live", "/presence")}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status: nextStatus,
            currentCallId: selectedCall?.id ?? null,
          }),
          keepalive: true,
        });
      } catch (presenceError) {
        console.error("[voice.console.auto_presence_failed]", presenceError);
      }
    };

    void pushAutoPresence();
    availabilityTimerRef.current = window.setInterval(() => {
      void pushAutoPresence();
    }, 45_000);

    return () => {
      if (availabilityTimerRef.current) {
        window.clearInterval(availabilityTimerRef.current);
        availabilityTimerRef.current = null;
      }
    };
  }, [manualPresence, mode, myPresence?.status, pollBaseHref, selectedCall?.id]);

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

  const handleReassign = async (input: {
    callId?: string | null;
    queueId?: string | null;
    queueType?: "task" | "lead";
    assignedToId: string;
  }) => {
    setError(null);
    try {
      const response = await fetch(`${pollBaseHref.replace("/live", "/calls")}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(input),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(String(payload.error || "reassign_failed"));
      }
      await refreshSnapshot(selectedCallId, selectedPhone);
    } catch (reassignError) {
      console.error("[voice.console.reassign_failed]", reassignError);
      setError("Could not reassign the voice work item.");
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

  const visibleAgents = useMemo(() => {
    const seen = new Set<string>();
    return data.agents.filter((agent) => {
      const displayName = String((agent as any).displayName || agent.name || "").trim().toLowerCase();
      const phone = String((agent as any).phone || "").trim().toLowerCase();
      const email = String(agent.email || "").trim().toLowerCase();
      const key = `${displayName}|${phone}|${email}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [data.agents]);

  const queuePreview = useMemo(() => data.callQueue.slice(0, 6), [data.callQueue]);
  const activeCallPreview = useMemo(() => data.activeCalls.slice(0, 6), [data.activeCalls]);

  return (
    <div className="overflow-x-hidden bg-slate-950 text-slate-100">
      <main
        className={`mx-auto max-w-7xl space-y-4 px-3 pb-10 sm:px-4 lg:px-6 ${
          mode === "admin" ? "pt-24 sm:pt-28 lg:pt-28" : "pt-4 sm:pt-5 lg:pt-6"
        }`}
      >
        <header className={cardShell("p-4 shadow-[0_20px_60px_rgba(0,0,0,0.32)] sm:p-5")}>
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-3">
              <div className="inline-flex rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100">
                {badge}
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-white sm:text-3xl">{title}</h1>
                <p className="mt-1.5 max-w-3xl text-sm text-slate-300">{subtitle}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1">
                  {formatRefreshStamp(lastRefreshAt)}
                </span>
                <span
                  className={`rounded-full border px-3 py-1 ${
                    liveStatus === "live"
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
                      : liveStatus === "connecting"
                        ? "border-amber-500/30 bg-amber-500/10 text-amber-100"
                        : "border-rose-500/30 bg-rose-500/10 text-rose-100"
                  }`}
                >
                  {liveStatus === "live" ? "Live updates" : liveStatus === "connecting" ? "Connecting live feed" : "Live feed offline"}
                </span>
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
                <RegistrationBadge />
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
                {mode === "admin" ? (
                  <Link
                    href="/admin/communications/voice/settings"
                    className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-cyan-100 transition hover:border-cyan-400 hover:bg-cyan-500/15"
                  >
                    Softphone settings
                  </Link>
                ) : null}
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

        <div className="overflow-x-auto pb-1">
          <div className="flex min-w-max items-center gap-2">
            {[
              ["operations", "Operations Center"],
              ["recent", "Recent Calls"],
              ["recordings", "Recordings"],
              ["followups", "Follow-ups"],
              ["agents", "Agents"],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => switchTab(key as VoiceConsoleTab)}
                className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] transition ${
                  activeTab === key
                    ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-100"
                    : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/20"
                }`}
              >
                {label}
              </button>
            ))}
            {mode === "admin" ? (
              <Link
                href="/admin/communications/voice/settings"
                className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-300 transition hover:border-white/20"
              >
                Softphone Settings
              </Link>
            ) : null}
          </div>
        </div>

        {error ? (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {error}
          </div>
        ) : null}

        {activeTab === "operations" ? (
          <>
            <section className="overflow-x-auto">
              <div className="flex min-w-max gap-3">
                {summaryCards.map((card) => (
                  <div key={card.label} className="min-w-[170px] rounded-2xl border border-slate-800/80 bg-slate-900/80 px-4 py-3">
                    <div className="text-xs font-medium text-slate-400">{card.label}</div>
                    <div className="mt-1 text-2xl font-semibold text-white">{card.value}</div>
                    <div className="mt-1 text-xs text-slate-500">{card.sub}</div>
                  </div>
                ))}
              </div>
            </section>

            <section className="grid gap-4 xl:h-[calc(100vh-14rem)] xl:grid-cols-[minmax(280px,0.82fr)_minmax(360px,1.12fr)_minmax(320px,0.94fr)]">
              <div className="grid min-h-0 gap-4 xl:grid-rows-[auto_auto_minmax(0,1fr)]">
                {incomingCall ? (
                  <section className="rounded-[24px] border border-cyan-500/25 bg-cyan-500/[0.08] p-4 shadow-[0_12px_30px_rgba(8,145,178,0.08)]">
                    <div className="flex flex-col gap-3">
                      <div>
                        <div className="text-xs font-medium text-cyan-200">Incoming call</div>
                        <div className="mt-1 text-xl font-semibold text-white">
                          {incomingCall.customer.customerName || incomingCall.callerNumber}
                        </div>
                        <div className="mt-1 whitespace-nowrap text-sm text-cyan-50/80">{incomingCall.callerNumber}</div>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs text-slate-200">
                        <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1">
                          {incomingCall.customer.matchedCustomerId ? "Returning customer" : "New caller"}
                        </span>
                        <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1">
                          {formatMoney(incomingCall.customer.totalPurchasesValue)}
                        </span>
                        <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1">
                          {incomingCall.customer.location || "Location unavailable"}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => handleSelectCall(incomingCall.id, incomingCall.callerNumber)}
                          className="rounded-full border border-emerald-400/40 bg-emerald-500/15 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-emerald-100 transition hover:border-emerald-300"
                        >
                          Answer
                        </button>
                        <button
                          type="button"
                          onClick={() => setDismissedIncomingIds((current) => [...current, incomingCall.id])}
                          className="rounded-full border border-slate-700 bg-slate-900/70 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-100 transition hover:border-slate-500"
                        >
                          Decline
                        </button>
                        <Link
                          href={incomingCall.links.customer}
                          className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-cyan-100 transition hover:border-cyan-300"
                        >
                          Open CRM
                        </Link>
                      </div>
                    </div>
                  </section>
                ) : (
                  <section className="rounded-[24px] border border-slate-800/80 bg-slate-950/92 p-4">
                    <div className="text-xs font-medium text-slate-400">Live inbound</div>
                    <div className="mt-1 text-lg font-semibold text-white">No incoming call right now</div>
                    <div className="mt-1 text-sm text-slate-500">New calls, queue alerts, and routing prompts will appear here.</div>
                  </section>
                )}

                <div className={cardShell("p-4")}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-medium text-slate-400">Waiting queue</div>
                      <h2 className="mt-1 text-lg font-semibold text-white">Callback and reassignment queue</h2>
                    </div>
                    <div className="rounded-full border border-slate-800 bg-slate-900/80 px-3 py-1 text-xs text-slate-300">
                      {data.callQueue.length} open
                    </div>
                  </div>
                  <div className="mt-3 space-y-3 xl:max-h-[260px] xl:overflow-y-auto">
                    {queuePreview.length ? queuePreview.map((item) => (
                      <div key={item.id} className="rounded-2xl border border-slate-800/80 bg-slate-900/70 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate font-semibold text-white">{item.customer.customerName || item.phone}</div>
                            <div className="mt-1 whitespace-nowrap text-sm text-slate-300">{item.phone}</div>
                            <div className="mt-1 truncate text-xs text-slate-500">{item.assignedAgentLabel}</div>
                          </div>
                          <span className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${statusTone(item.status)}`}>
                            {item.type === "task" ? "Task" : "Lead"}
                          </span>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <a href={item.links.callBack} className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-cyan-100 transition hover:border-cyan-400">
                            Callback
                          </a>
                          <Link href={item.links.customer} className="rounded-full border border-slate-700 bg-slate-950/80 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-200 transition hover:border-slate-500">
                            CRM
                          </Link>
                        </div>
                      </div>
                    )) : (
                      <div className="rounded-2xl border border-dashed border-slate-800 px-3 py-4 text-sm text-slate-500">
                        No queue items are waiting.
                      </div>
                    )}
                  </div>
                </div>

                <div className={cardShell("p-4 min-h-0")}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-medium text-slate-400">Agent board</div>
                      <h2 className="mt-1 text-lg font-semibold text-white">Availability and routing</h2>
                    </div>
                    <div className="rounded-full border border-slate-800 bg-slate-900/80 px-3 py-1 text-xs text-slate-300">
                      {visibleAgents.length} shown
                    </div>
                  </div>
                  <div className="mt-3 space-y-3 xl:max-h-[100%] xl:overflow-y-auto">
                    {visibleAgents.length ? visibleAgents.map((agent) => (
                      <div key={agent.id} className="flex items-center gap-3 rounded-2xl border border-slate-800/80 bg-slate-900/70 p-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-cyan-400/15 bg-cyan-400/10 text-sm font-semibold text-cyan-100">
                          {getInitials((agent as any).displayName || agent.name)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="truncate font-semibold text-white">{(agent as any).displayName || agent.name || "Unnamed agent"}</div>
                            <span className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${statusTone(agent.status)}`}>
                              {agent.status}
                            </span>
                          </div>
                          <div className="mt-1 truncate text-sm text-slate-400">{(agent as any).displayRoleLabel || agent.attendantCategory || agent.role}</div>
                          <div className="mt-1 flex flex-wrap gap-3 text-xs text-slate-500">
                            <span className="whitespace-nowrap">{(agent as any).phone || "No phone"}</span>
                            <span className="whitespace-nowrap">Active {agent.activeCallCount}</span>
                            <span className="whitespace-nowrap">Waiting {agent.waitingCallCount}</span>
                          </div>
                        </div>
                      </div>
                    )) : (
                      <div className="rounded-2xl border border-dashed border-slate-800 px-3 py-4 text-sm text-slate-500">
                        No agent presence records yet.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid min-h-0 gap-4 xl:grid-rows-[auto_minmax(0,1fr)_auto]">
                <CallStatusBar />

                <div className={cardShell("p-4 min-h-0")}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-medium text-slate-400">Focus workspace</div>
                      <h2 className="mt-1 text-lg font-semibold text-white">Active calls and next action</h2>
                    </div>
                    <div className="rounded-full border border-slate-800 bg-slate-900/80 px-3 py-1 text-xs text-slate-300">
                      {data.activeCalls.length} live
                    </div>
                  </div>
                  <div className="mt-3 grid min-h-0 gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(280px,0.95fr)]">
                    <div className="space-y-3 xl:max-h-[100%] xl:overflow-y-auto xl:pr-1">
                      {activeCallPreview.length ? activeCallPreview.map((call) => (
                        <button
                          key={call.id}
                          type="button"
                          onClick={() => handleSelectCall(call.id, call.callerNumber)}
                          className={`w-full rounded-[22px] border p-4 text-left transition ${
                            selectedCall?.id === call.id
                              ? "border-cyan-500/40 bg-cyan-500/[0.08]"
                              : "border-slate-800/80 bg-slate-900/70 hover:border-slate-700"
                          }`}
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${statusTone(call.direction)}`}>
                              {call.direction}
                            </span>
                            <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${statusTone(call.status)}`}>
                              {call.statusLabel}
                            </span>
                            <span className="rounded-full border border-slate-700 bg-slate-950/80 px-2.5 py-1 text-[10px] font-semibold text-slate-300">
                              {formatRelative(call.waitingSeconds)}
                            </span>
                          </div>
                          <div className="mt-3 flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="truncate text-lg font-semibold text-white">{call.customer.customerName || call.callerNumber}</div>
                              <div className="mt-1 whitespace-nowrap text-sm text-slate-300">{call.callerNumber}</div>
                              <div className="mt-2 text-xs text-slate-500">{call.linkedSummaryText}</div>
                            </div>
                            <div className="shrink-0 text-right text-xs text-slate-400">
                              <div>{formatTimeOnly(call.startedAt || call.createdAt)}</div>
                              <div className="mt-1">{formatDuration(call.durationInSeconds)}</div>
                            </div>
                          </div>
                          <div className="mt-3 grid gap-2 text-xs text-slate-500 sm:grid-cols-2">
                            <div className="truncate">Assigned {call.assignedToName || call.assignedToEmail || call.routedTo || "-"}</div>
                            <div className="truncate">Route {call.routedToDisplay || "-"}</div>
                          </div>
                        </button>
                      )) : (
                        <div className="rounded-2xl border border-dashed border-slate-800 px-3 py-4 text-sm text-slate-500">
                          No active voice calls right now.
                        </div>
                      )}
                    </div>

                    <div className="space-y-4 rounded-[22px] border border-slate-800/80 bg-slate-900/60 p-4">
                      <div>
                        <div className="text-xs font-medium text-slate-400">Selected interaction</div>
                        <div className="mt-1 text-lg font-semibold text-white">
                          {selectedCall?.customer.customerName || selectedCall?.callerNumber || "No call selected"}
                        </div>
                        <div className="mt-1 text-sm text-slate-400">
                          {selectedCall ? `${selectedCall.callerNumber} · ${selectedCall.routedToDisplay || "No route label"}` : "Select an active line to work notes and follow-ups."}
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <label className="text-xs font-medium text-slate-400">Call note</label>
                          <textarea
                            value={noteDraft}
                            onChange={(event) => setNoteDraft(event.target.value)}
                            rows={4}
                            placeholder="Add a clear call note or promise made to the customer."
                            className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-950/80 px-3 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:ring-2 focus:ring-cyan-500/40"
                          />
                          <button
                            type="button"
                            disabled={!selectedCall?.id || submittingNote || !noteDraft.trim()}
                            onClick={handleAddNote}
                            className="mt-3 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-emerald-100 transition hover:border-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {submittingNote ? "Saving..." : "Save note"}
                          </button>
                        </div>

                        <div className="border-t border-slate-800/80 pt-3">
                          <label className="text-xs font-medium text-slate-400">Follow-up title</label>
                          <input
                            value={followUpTitle}
                            onChange={(event) => setFollowUpTitle(event.target.value)}
                            placeholder="Callback customer about quotation"
                            className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-950/80 px-3 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:ring-2 focus:ring-cyan-500/40"
                          />
                          <input
                            value={followUpDueAt}
                            onChange={(event) => setFollowUpDueAt(event.target.value)}
                            type="datetime-local"
                            className="mt-3 w-full rounded-2xl border border-slate-800 bg-slate-950/80 px-3 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-cyan-500/40"
                          />
                          <textarea
                            value={followUpNotes}
                            onChange={(event) => setFollowUpNotes(event.target.value)}
                            rows={3}
                            placeholder="Optional callback notes"
                            className="mt-3 w-full rounded-2xl border border-slate-800 bg-slate-950/80 px-3 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:ring-2 focus:ring-cyan-500/40"
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
                    </div>
                  </div>
                </div>

                <div className={cardShell("p-4")}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-medium text-slate-400">Supervisor shortcuts</div>
                      <div className="mt-1 text-sm text-slate-300">Jump to recordings, follow-ups, or deep customer work without leaving the console.</div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => switchTab("recordings")}
                        className="rounded-full border border-slate-700 bg-slate-900/80 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-100 transition hover:border-slate-500"
                      >
                        Recordings
                      </button>
                      <button
                        type="button"
                        onClick={() => switchTab("followups")}
                        className="rounded-full border border-slate-700 bg-slate-900/80 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-100 transition hover:border-slate-500"
                      >
                        Follow-ups
                      </button>
                      <button
                        type="button"
                        onClick={() => switchTab("recent")}
                        className="rounded-full border border-slate-700 bg-slate-900/80 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-100 transition hover:border-slate-500"
                      >
                        Recent calls
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid min-h-0 gap-4 xl:grid-rows-[minmax(0,1fr)_auto]">
                <div className={cardShell("p-4 min-h-0 xl:sticky xl:top-28")}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-medium text-slate-400">Persistent CRM card</div>
                      <h2 className="mt-1 text-lg font-semibold text-white">Customer context</h2>
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
                    <div className="mt-4 grid min-h-0 gap-4">
                      <div className="rounded-[22px] border border-slate-800/80 bg-slate-900/70 p-4">
                        <div className="text-xl font-semibold text-white">
                          {data.selectedContext.customerName || data.selectedPhone || "Unknown caller"}
                        </div>
                        <div className="mt-1 text-sm text-slate-400">
                          {data.selectedPhone || "-"} · {data.selectedContext.email || "No email"} · {data.selectedContext.location || "No saved location"}
                        </div>
                        <div className="mt-4 grid gap-3 text-sm text-slate-300 sm:grid-cols-2">
                          <div className="rounded-2xl border border-slate-800 bg-slate-950/80 px-3 py-3">
                            <div className="text-xs text-slate-500">Total sales</div>
                            <div className="mt-1 font-semibold text-white">{formatMoney(data.selectedContext.totalPurchasesValue)}</div>
                          </div>
                          <div className="rounded-2xl border border-slate-800 bg-slate-950/80 px-3 py-3">
                            <div className="text-xs text-slate-500">Assigned agent</div>
                            <div className="mt-1 truncate font-semibold text-white">{data.selectedContext.assignedAgent?.name || data.selectedContext.assignedAgent?.email || "-"}</div>
                          </div>
                          <div className="rounded-2xl border border-slate-800 bg-slate-950/80 px-3 py-3">
                            <div className="text-xs text-slate-500">Open quotations</div>
                            <div className="mt-1 font-semibold text-white">{data.selectedContext.openQuotations}</div>
                          </div>
                          <div className="rounded-2xl border border-slate-800 bg-slate-950/80 px-3 py-3">
                            <div className="text-xs text-slate-500">Pending web orders</div>
                            <div className="mt-1 font-semibold text-white">{data.selectedContext.pendingWebOrders}</div>
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Link href={selectedCustomerLinks.customer} className="rounded-full border border-slate-700 bg-slate-950/80 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-100 transition hover:border-slate-500">
                            Open customer
                          </Link>
                          <Link href={selectedCustomerLinks.quote} className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-emerald-100 transition hover:border-emerald-400">
                            Quote
                          </Link>
                          <Link href={selectedCustomerLinks.receipt} className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-cyan-100 transition hover:border-cyan-400">
                            Receipt
                          </Link>
                        </div>
                      </div>

                      <div className="rounded-[22px] border border-slate-800/80 bg-slate-900/70 p-4 xl:min-h-0">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm font-semibold text-white">Recent customer timeline</div>
                          <button
                            type="button"
                            onClick={() => setDrawerOpen(true)}
                            className="rounded-full border border-slate-700 bg-slate-950/80 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-200 transition hover:border-slate-500"
                          >
                            Open drawer
                          </button>
                        </div>
                        <div className="mt-3 space-y-2 xl:max-h-[300px] xl:overflow-y-auto">
                          {data.selectedContext.recentTimeline.length ? data.selectedContext.recentTimeline.map((item) => (
                            <div key={item.id} className="rounded-2xl border border-slate-800 bg-slate-950/80 px-3 py-3">
                              <div className="text-sm font-medium text-white">{item.title}</div>
                              <div className="mt-1 text-xs text-slate-400">
                                {item.detail} · {formatDateTime(item.at)}
                              </div>
                            </div>
                          )) : (
                            <div className="rounded-2xl border border-dashed border-slate-800 px-3 py-4 text-sm text-slate-500">
                              No customer activity linked yet.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 rounded-[22px] border border-dashed border-slate-800 px-4 py-5 text-sm text-slate-500">
                      Select a call to pin the CRM context here.
                    </div>
                  )}
                </div>

                <div className={cardShell("p-4")}>
                  <div className="text-xs font-medium text-slate-400">Drawer and deep work</div>
                  <div className="mt-1 text-sm text-slate-300">Use the call detail drawer for full notes, follow-ups, timeline, and recordings without losing the live workspace.</div>
                </div>
              </div>
            </section>
          </>
        ) : null}

        {(activeTab === "agents" || activeTab === "recent") ? (
        <section className="grid gap-5 overflow-hidden xl:grid-cols-[0.95fr_1.05fr] xl:items-start">
          <div className={cardShell("p-5")}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                  {mode === "admin" ? "Agent Availability" : "My Queue"}
                </div>
                <h2 className="mt-2 text-2xl font-semibold text-white">
                  {mode === "admin" ? "Routing status for Brendah, Jennifer, and Admin" : "Open follow-ups and missed calls"}
                </h2>
              </div>
              <div className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-slate-300">
                {mode === "admin" ? `${visibleAgents.length} agents` : `${data.callQueue.length} open`}
              </div>
            </div>

            <div className={`mt-4 ${mode === "admin" ? "space-y-3" : "grid gap-3"}`}>
              {mode === "admin"
                ? (
                  <>
                    <div className="space-y-3 lg:hidden">
                      {visibleAgents.map((agent) => (
                        <div key={agent.id} className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
                          <div className="flex items-start gap-3">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-400/10 text-sm font-semibold text-cyan-100">
                              {getInitials((agent as any).displayName || agent.name)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="min-w-0">
                                <div className="truncate font-semibold text-white">{(agent as any).displayName || agent.name || "Unnamed agent"}</div>
                                <div className="truncate text-sm text-slate-400">{(agent as any).displayRoleLabel || agent.attendantCategory || agent.role}</div>
                              </div>
                              <span className={`whitespace-nowrap rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${statusTone(agent.status)}`}>
                                {agent.status}
                                </span>
                              </div>
                              <div className="mt-3 grid gap-2 text-sm text-slate-300">
                                <div className="whitespace-nowrap">{(agent as any).phone || "—"}</div>
                                <div className="text-slate-400">Active {agent.activeCallCount} · Waiting {agent.waitingCallCount}</div>
                                <div className="text-xs text-slate-500">{agent.isAvailableForRouting ? "Eligible for routing" : "Not currently routable"}</div>
                                <div className="text-slate-400">Last seen {formatDateTime(agent.lastSeenAt)}</div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="hidden overflow-x-auto lg:block">
                      <div className="min-w-[980px] space-y-3">
                        <div className="grid grid-cols-[minmax(220px,1.3fr)_minmax(190px,1fr)_150px_120px_110px_110px_140px_120px] gap-3 px-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                          <div>Agent</div>
                          <div>Role / Category</div>
                          <div>Phone</div>
                          <div>Status</div>
                          <div>Active Calls</div>
                          <div>Waiting</div>
                          <div>Last Seen</div>
                          <div>Action</div>
                        </div>
                        {visibleAgents.map((agent) => (
                          <div
                            key={agent.id}
                            className="grid grid-cols-[minmax(220px,1.3fr)_minmax(190px,1fr)_150px_120px_110px_110px_140px_120px] items-center gap-3 rounded-[22px] border border-white/10 bg-white/[0.03] px-4 py-4"
                          >
                            <div className="flex min-w-0 items-center gap-3">
                              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-400/10 text-sm font-semibold text-cyan-100">
                                {getInitials((agent as any).displayName || agent.name)}
                              </div>
                              <div className="min-w-0">
                                <div className="truncate font-semibold text-white">{(agent as any).displayName || agent.name || "Unnamed agent"}</div>
                                <div className="truncate text-sm text-slate-400">{agent.email || "—"}</div>
                              </div>
                            </div>
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium text-slate-200">{(agent as any).displayRoleLabel || agent.attendantCategory || agent.role}</div>
                              <div className="truncate text-xs text-slate-500">{agent.attendantCategory || agent.role || "Voice Agent"}</div>
                            </div>
                            <div className="whitespace-nowrap text-sm text-slate-300">{(agent as any).phone || "—"}</div>
                            <div>
                              <span className={`inline-flex whitespace-nowrap rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${statusTone(agent.status)}`}>
                                {agent.status}
                              </span>
                            </div>
                            <div className="whitespace-nowrap text-sm text-slate-200">{agent.activeCallCount}</div>
                            <div className="whitespace-nowrap text-sm text-slate-200">{agent.waitingCallCount}</div>
                            <div className="whitespace-nowrap text-sm text-slate-400">{formatDateTime(agent.lastSeenAt)}</div>
                            <div>
                              <span className={`inline-flex whitespace-nowrap rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-wide ${
                                agent.isAvailableForRouting
                                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
                                  : "border-white/10 bg-white/[0.03] text-slate-300"
                              }`}>
                                {agent.isAvailableForRouting ? "Ready" : "Review"}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )
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
              {!visibleAgents.length && mode === "admin" ? (
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

          {activeTab === "recent" ? (
          <div className={cardShell("p-5")}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Recent Calls</div>
                <h2 className="mt-2 text-2xl font-semibold text-white">Compact CRM call history</h2>
              </div>
              <div className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-slate-300">
                {filteredRecentCalls.length} rows
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-3 rounded-[22px] border border-white/10 bg-white/[0.03] p-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-1 flex-col gap-3 sm:flex-row">
                <input
                  value={recentSearch}
                  onChange={(event) => setRecentSearch(event.target.value)}
                  placeholder="Search caller, phone, route, or status"
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-3 text-sm text-white outline-none placeholder:text-slate-500"
                />
                <select
                  value={recentFilter}
                  onChange={(event) => setRecentFilter(event.target.value as typeof recentFilter)}
                  className="rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-3 text-sm text-white outline-none sm:w-56"
                >
                  <option value="all">All directions</option>
                  <option value="INBOUND">Inbound only</option>
                  <option value="OUTBOUND">Outbound only</option>
                  <option value="with_recording">With recording</option>
                </select>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleExportRecentCalls}
                  className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-100 transition hover:border-white/20"
                >
                  Export CSV
                </button>
              </div>
            </div>

            <div className="mt-4 space-y-3 lg:hidden">
              {filteredRecentCalls.length ? filteredRecentCalls.map((call) => (
                <button
                  key={call.id}
                  type="button"
                  onClick={() => handleSelectCall(call.id, call.callerNumber)}
                  className={`w-full rounded-[22px] border p-4 text-left transition ${
                    selectedCall?.id === call.id
                      ? "border-cyan-400/50 bg-cyan-500/10"
                      : "border-white/10 bg-white/[0.03] hover:border-white/20"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="whitespace-nowrap text-sm font-semibold text-white">{formatTimeOnly(call.startedAt || call.createdAt)}</div>
                    <span className={`whitespace-nowrap rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${statusTone(call.status)}`}>
                      {call.statusLabel}
                    </span>
                  </div>
                  <div className="mt-3">
                    <div className="truncate font-semibold text-white">{call.customer.customerName || call.callerNumber}</div>
                    <div className="mt-1 whitespace-nowrap text-sm text-slate-300">{call.callerNumber}</div>
                    <div className="mt-2 truncate text-sm text-slate-400">{call.routedToDisplay || call.customer.assignedAgent?.name || call.assignedToName || "-"}</div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className={`whitespace-nowrap rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${statusTone(call.direction)}`}>
                      {call.direction}
                    </span>
                    <span className="whitespace-nowrap rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-300">
                      {formatDuration(call.durationInSeconds)}
                    </span>
                    <span className="whitespace-nowrap rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-300">
                      {formatMoney(call.amount, call.currencyCode)}
                    </span>
                    <span className="whitespace-nowrap rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-300">
                      {getRecentCallBucket(call.startedAt || call.createdAt)}
                    </span>
                  </div>
                </button>
              )) : (
                <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-5 text-sm text-slate-400">
                  No recent calls yet.
                </div>
              )}
            </div>

            <div className="mt-4 hidden overflow-x-auto lg:block">
              {groupedRecentCalls.length ? (
                <div className="min-w-[1100px] space-y-5">
                  {groupedRecentCalls.map(([bucket, calls]) => (
                    <div key={bucket} className="space-y-3">
                      <div className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                        {bucket}
                      </div>
                      <div className="grid grid-cols-[110px_220px_110px_240px_120px_110px_120px_180px] gap-3 px-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                        <div>Time</div>
                        <div>Caller</div>
                        <div>Direction</div>
                        <div>Routed To</div>
                        <div>Status</div>
                        <div>Duration</div>
                        <div>Cost</div>
                        <div>Action</div>
                      </div>
                      {calls.map((call) => (
                        <button
                          key={call.id}
                          type="button"
                          onClick={() => handleSelectCall(call.id, call.callerNumber)}
                          className={`grid w-full grid-cols-[110px_220px_110px_240px_120px_110px_120px_180px] items-center gap-3 rounded-[22px] border px-4 py-4 text-left transition ${
                            selectedCall?.id === call.id
                              ? "border-cyan-400/50 bg-cyan-500/10"
                              : "border-white/10 bg-white/[0.03] hover:border-white/20"
                          }`}
                        >
                          <div className="whitespace-nowrap text-sm text-slate-200">{formatTimeOnly(call.startedAt || call.createdAt)}</div>
                          <div className="min-w-0">
                            <div className="truncate font-semibold text-white">{call.customer.customerName || call.callerNumber}</div>
                            <div className="whitespace-nowrap text-sm text-slate-400">{call.callerNumber}</div>
                          </div>
                          <div>
                            <span className={`inline-flex whitespace-nowrap rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${statusTone(call.direction)}`}>
                              {call.direction}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-sm text-slate-200">{call.routedToDisplay || call.customer.assignedAgent?.name || call.assignedToName || "-"}</div>
                            <div className="truncate text-xs text-slate-500">{call.lastActivityTitle || "No recent activity"}</div>
                          </div>
                          <div>
                            <span className={`inline-flex whitespace-nowrap rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${statusTone(call.status)}`}>
                              {call.statusLabel}
                            </span>
                          </div>
                          <div className="whitespace-nowrap text-sm text-slate-200">{formatDuration(call.durationInSeconds)}</div>
                          <div className="whitespace-nowrap text-sm text-slate-200">{formatMoney(call.amount, call.currencyCode)}</div>
                          <div className="flex items-center gap-2">
                            {call.recordingUrl ? (
                              <>
                                <a
                                  href={call.recordingUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  onClick={(event) => event.stopPropagation()}
                                  className="inline-flex whitespace-nowrap rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-emerald-100 transition hover:border-emerald-400"
                                >
                                  Playback
                                </a>
                                <a
                                  href={call.recordingUrl}
                                  download
                                  onClick={(event) => event.stopPropagation()}
                                  className="inline-flex whitespace-nowrap rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-100 transition hover:border-white/20"
                                >
                                  Download
                                </a>
                              </>
                            ) : null}
                            <Link
                              href={call.links.customer}
                              onClick={(event) => event.stopPropagation()}
                              className="inline-flex whitespace-nowrap rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-cyan-100 transition hover:border-cyan-400"
                            >
                              CRM
                            </Link>
                          </div>
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-5 text-sm text-slate-400">
                  No recent calls yet.
                </div>
              )}
            </div>
          </div>
          ) : null}
        </section>
        ) : null}

        {(activeTab === "followups" || activeTab === "recordings") ? (
        <section className="grid gap-5 overflow-hidden xl:grid-cols-[1fr_0.9fr]">
          {activeTab !== "recordings" ? (
          <div className={cardShell("p-5")}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Waiting Queue</div>
                <h2 className="mt-2 text-2xl font-semibold text-white">Supervisor callback and reassignment queue</h2>
              </div>
              <div className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-slate-300">
                {data.callQueue.length} open
              </div>
            </div>

            <div className="mt-4 space-y-3 lg:hidden">
              {data.callQueue.length ? data.callQueue.map((item) => (
                <div key={item.id} className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-semibold text-white">{item.customer.customerName || item.phone}</div>
                    <span className={`rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${statusTone(item.status)}`}>
                      {item.statusLabel}
                    </span>
                  </div>
                  <div className="mt-2 whitespace-nowrap text-sm text-slate-300">{item.phone}</div>
                  <div className="mt-2 text-sm text-slate-400">{item.assignedAgentLabel}</div>
                  <div className="mt-2 text-xs text-slate-500">
                    Waiting {formatDateTime(item.dueAt || item.updatedAt)} · Priority {item.type === "task" ? "Task" : "Lead"}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <a href={item.links.callBack} className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-100 transition hover:border-cyan-400">
                      Callback
                    </a>
                    <Link href={item.links.customer} className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-100 transition hover:border-white/20">
                      Open CRM
                    </Link>
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
              )) : (
                <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-5 text-sm text-slate-400">
                  No pending queue items right now.
                </div>
              )}
            </div>

            <div className="mt-4 hidden overflow-x-auto lg:block">
              {data.callQueue.length ? (
                <div className="min-w-[1120px] space-y-3">
                  <div className="grid grid-cols-[140px_220px_160px_180px_100px_120px_220px] gap-3 px-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    <div>Waiting Time</div>
                    <div>Customer</div>
                    <div>Phone</div>
                    <div>Assigned Agent</div>
                    <div>Priority</div>
                    <div>Callback</div>
                    <div>Reassign</div>
                  </div>
                  {data.callQueue.map((item) => (
                    <div
                      key={item.id}
                      className="grid grid-cols-[140px_220px_160px_180px_100px_120px_220px] items-center gap-3 rounded-[22px] border border-white/10 bg-white/[0.03] px-4 py-4"
                    >
                      <div className="whitespace-nowrap text-sm text-slate-300">{formatDateTime(item.dueAt || item.updatedAt)}</div>
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-white">{item.customer.customerName || item.phone}</div>
                        <div className="truncate text-xs text-slate-500">{item.title}</div>
                      </div>
                      <div className="whitespace-nowrap text-sm text-slate-300">{item.phone}</div>
                      <div className="min-w-0">
                        <div className="truncate text-sm text-slate-200">{item.assignedAgentLabel}</div>
                        <div className="truncate text-xs text-slate-500">{item.customer.assignedAgent?.name || item.customer.assignedAgent?.email || "Supervisor queue"}</div>
                      </div>
                      <div>
                        <span className={`inline-flex whitespace-nowrap rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${statusTone(item.status)}`}>
                          {item.type === "task" ? "Task" : "Lead"}
                        </span>
                      </div>
                      <div className="flex justify-start">
                        <a href={item.links.callBack} className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-cyan-100 transition hover:border-cyan-400">
                          Callback
                        </a>
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          defaultValue={item.assignedToId || ""}
                          onChange={(event) => {
                            const assignedToId = event.target.value;
                            if (!assignedToId) return;
                            void handleReassign({
                              queueId: item.id,
                              queueType: item.type,
                              assignedToId,
                            });
                          }}
                          className="w-full rounded-full border border-white/10 bg-slate-950/80 px-3 py-2 text-xs text-slate-100 outline-none"
                        >
                          <option value="">Select agent</option>
                          {visibleAgents.map((agent) => (
                            <option key={agent.id} value={agent.id}>
                              {(agent as any).displayName || agent.name}
                            </option>
                          ))}
                        </select>
                        {item.type === "task" ? (
                          <button
                            type="button"
                            onClick={() => handleResolveTask(item.id)}
                            className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-emerald-100 transition hover:border-emerald-400"
                          >
                            Resolve
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-5 text-sm text-slate-400">
                  No pending queue items right now.
                </div>
              )}
            </div>
          </div>
          ) : null}

          {activeTab !== "followups" ? (
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
                  <div className="flex flex-col gap-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-white">{call.customer.customerName || call.callerNumber}</div>
                        <div className="mt-1 text-sm text-slate-400">
                          {call.callerNumber} · {formatDateTime(call.startedAt || call.createdAt)}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                          <span className="rounded-full border border-white/10 bg-slate-950/60 px-3 py-1">
                            {formatDuration(call.durationInSeconds)}
                          </span>
                          <span className="rounded-full border border-white/10 bg-slate-950/60 px-3 py-1">
                            {formatMoney(call.amount, call.currencyCode)}
                          </span>
                          <span className="rounded-full border border-white/10 bg-slate-950/60 px-3 py-1">
                            {call.assignedToName || call.assignedToEmail || call.routedToDisplay || "Unassigned"}
                          </span>
                        </div>
                      </div>
                      {call.recordingUrl ? (
                        <div className="flex flex-wrap gap-2">
                          <a
                            href={call.recordingUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-emerald-100 transition hover:border-emerald-400"
                          >
                            Download
                          </a>
                        </div>
                      ) : null}
                    </div>
                    <div>
                      {call.recordingUrl ? (
                        <audio
                          controls
                          preload="none"
                          className="w-full"
                          src={call.recordingUrl}
                        />
                      ) : (
                        <div className="text-sm text-slate-500">Recording URL is not available.</div>
                      )}
                    </div>
                  </div>
                </div>
              )) : (
                <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-5 text-sm text-slate-400">
                  No recordings available yet.
                </div>
              )}
            </div>
          </div>
          ) : null}
        </section>
        ) : null}

        {drawerOpen && selectedCall ? (
          <div className="fixed inset-0 z-[60] bg-slate-950/70 backdrop-blur-sm">
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              className="absolute inset-0 h-full w-full cursor-default"
              aria-label="Close call detail drawer backdrop"
            />
            <aside className="relative ml-auto flex h-full w-full max-w-full flex-col overflow-hidden border-l border-white/10 bg-slate-950 shadow-[-24px_0_80px_rgba(0,0,0,0.45)] md:w-[420px] lg:w-[480px] xl:w-[520px]">
              <div className="sticky top-0 z-10 border-b border-white/10 bg-[linear-gradient(180deg,rgba(2,6,23,0.98),rgba(2,6,23,0.94))] px-5 py-4 backdrop-blur">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-300">Call Detail</div>
                    <h2 className="mt-2 truncate text-xl font-semibold text-white">{selectedCall.callerNumber}</h2>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className={`inline-flex whitespace-nowrap rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${statusTone(selectedCall.status)}`}>
                        {selectedCall.statusLabel}
                      </span>
                      <span className="truncate text-sm text-slate-400">
                        {selectedCall.customer.customerName || selectedCall.callerNumber}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDrawerOpen(false)}
                    className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-100 transition hover:border-white/30"
                  >
                    Close
                  </button>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <a href={selectedCustomerLinks.callBack} className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-100 transition hover:border-white/20">
                    Call back
                  </a>
                  <Link href={selectedCustomerLinks.customer} className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-100 transition hover:border-white/20">
                    Open customer
                  </Link>
                  <Link href={selectedCustomerLinks.quote} className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-emerald-100 transition hover:border-emerald-400">
                    Create quote
                  </Link>
                  <Link href={selectedCustomerLinks.receipt} className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-cyan-100 transition hover:border-cyan-400">
                    Create receipt
                  </Link>
                </div>

                <div className="mt-4 flex overflow-x-auto pb-1">
                  <div className="flex min-w-max gap-2">
                  {[
                    ["overview", "Overview"],
                    ["timeline", "Timeline"],
                    ["notes", "Notes"],
                    ["followUps", "Follow-ups"],
                    ["recordings", "Recordings"],
                  ].map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setDrawerTab(key as typeof drawerTab)}
                      className={`rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-wide transition ${
                        drawerTab === key
                          ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-100"
                          : "border-white/10 bg-white/[0.03] text-slate-200 hover:border-white/20"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-5">
                {drawerTab === "overview" ? (
                  <div className="grid gap-5">
                    <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Customer</div>
                          <div className="mt-2 text-sm text-white">{selectedCall.customer.customerName || "Unknown caller"}</div>
                          <div className="mt-1 text-sm text-slate-400">{selectedCall.customer.email || "No email saved"}</div>
                          <div className="mt-1 text-sm text-slate-400">{selectedCall.customer.location || "No location saved"}</div>
                        </div>
                        <div>
                          <div className="text-xs uppercase tracking-[0.18em] text-slate-500">CRM</div>
                          <div className="mt-2 text-sm text-slate-200">{selectedCall.linkedSummaryText}</div>
                          <div className="mt-1 text-sm text-slate-400">
                            Quotes {selectedCall.customer.openQuotations} · Web orders {selectedCall.customer.pendingWebOrders} · POD {selectedCall.customer.pendingPod}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
                      <div className="text-sm font-semibold text-white">Current call</div>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <div className="rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-3">
                          <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Direction</div>
                          <div className="mt-1 text-sm text-white">{selectedCall.direction}</div>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-3">
                          <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Routed To</div>
                          <div className="mt-1 text-sm text-white">{selectedCall.routedToDisplay}</div>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-3">
                          <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Started</div>
                          <div className="mt-1 text-sm text-white">{formatDateTime(selectedCall.startedAt || selectedCall.createdAt)}</div>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-3">
                          <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Duration / Cost</div>
                          <div className="mt-1 text-sm text-white">{formatDuration(selectedCall.durationInSeconds)} · {formatMoney(selectedCall.amount, selectedCall.currencyCode)}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}

                {drawerTab === "timeline" ? (
                  <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
                    <div className="text-sm font-semibold text-white">Voice Event Timeline</div>
                    <div className="mt-3 space-y-2">
                      {data.selectedCallDetail?.timeline?.length ? data.selectedCallDetail.timeline.map((item: any) => (
                        <div key={item.id} className="rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-3">
                          <div className="text-sm font-medium text-white">{item.title}</div>
                          <div className="mt-1 text-xs text-slate-400">
                            {item.detail || "No extra detail"} · {formatDateTime(item.at)}
                          </div>
                        </div>
                      )) : (
                        <div className="rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-3 text-sm text-slate-400">
                          No timeline entries yet.
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}

                {drawerTab === "notes" ? (
                  <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
                    <div className="text-sm font-semibold text-white">Notes</div>
                    <div className="mt-3 space-y-2">
                      {data.selectedCallDetail?.notes?.length ? data.selectedCallDetail.notes.map((note: any) => (
                        <div key={note.id} className="rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-3">
                          <div className="text-sm text-slate-100">{note.note}</div>
                          <div className="mt-1 text-xs text-slate-500">
                            {note.authorName || note.authorEmail || "Unknown author"} · {formatDateTime(note.createdAt)}
                          </div>
                        </div>
                      )) : (
                        <div className="rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-3 text-sm text-slate-400">
                          No notes attached to this call yet.
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}

                {drawerTab === "followUps" ? (
                  <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
                    <div className="text-sm font-semibold text-white">Follow-ups</div>
                    <div className="mt-3 space-y-2">
                      {data.selectedCallDetail?.followUps?.length ? data.selectedCallDetail.followUps.map((task: any) => (
                        <div key={task.id} className="rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-3">
                          <div className="text-sm text-slate-100">{task.title}</div>
                          <div className="mt-1 text-xs text-slate-500">
                            {task.status.replace(/_/g, " ")} · {task.assignedToName || task.assignedToEmail || "Unassigned"} · {formatDateTime(task.dueAt)}
                          </div>
                        </div>
                      )) : (
                        <div className="rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-3 text-sm text-slate-400">
                          No follow-ups linked to this call yet.
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}

                {drawerTab === "recordings" ? (
                  <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
                    <div className="text-sm font-semibold text-white">Recording</div>
                    {selectedCall.recordingUrl ? (
                      <audio controls preload="none" className="mt-3 w-full" src={selectedCall.recordingUrl} />
                    ) : (
                      <div className="mt-3 rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-3 text-sm text-slate-400">
                        Recording not available for this call.
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            </aside>
          </div>
        ) : null}
      </main>
    </div>
  );
}
