"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import CallStatusBar from "@/components/voice/CallStatusBar";
import DialPad from "@/components/voice/DialPad";
import RegistrationBadge from "@/components/voice/RegistrationBadge";
import VoiceSettingsClient from "@/components/voice/VoiceSettingsClient";
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
const VOICE_CONSOLE_TABS = ["operations", "recent", "recordings", "followups", "agents", "settings"] as const;
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
  if (["available", "answered", "completed", "resolved", "contacted", "registered"].includes(normalized)) {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-100";
  }
  if (["busy", "ringing", "queued", "pending", "in_progress", "pending_follow_up", "away"].includes(normalized)) {
    return "border-amber-500/30 bg-amber-500/10 text-amber-100";
  }
  if (["offline", "break", "missed", "aborted", "failed", "closed", "error"].includes(normalized)) {
    return "border-rose-500/30 bg-rose-500/10 text-rose-100";
  }
  return "border-white/10 bg-white/[0.04] text-slate-200";
}

function cardShell(extra = "") {
  return `rounded-[22px] border border-slate-800/90 bg-slate-950/96 ${extra}`.trim();
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

function isMeaningfulVoicePhone(phone: string | null | undefined) {
  return Boolean(phone) && !isDeveloperPlaceholderPhone(phone);
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
  const [selectedCallId, setSelectedCallId] = useState<string | null>(initialData.selectedCallId ?? null);
  const [selectedPhone, setSelectedPhone] = useState<string | null>(initialData.selectedPhone ?? null);
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
  const [contextTab, setContextTab] = useState<"customer" | "timeline" | "agent" | "recording">("customer");
  const [queueSearch, setQueueSearch] = useState("");
  const [showWorkspaceDialPad, setShowWorkspaceDialPad] = useState(false);
  const [recentSearch, setRecentSearch] = useState("");
  const [recentFilter, setRecentFilter] = useState<"all" | "INBOUND" | "OUTBOUND" | "with_recording">("all");
  const [activeTab, setActiveTab] = useState<VoiceConsoleTab>(() => normalizeVoiceTab(searchParams.get("tab")));
  const lastInteractionAtRef = useRef(Date.now());
  const availabilityTimerRef = useRef<number | null>(null);
  const lastAnnouncedCallIdRef = useRef<string | null>(null);

  const visibleActiveCalls = useMemo(
    () => data.activeCalls.filter((call) => isMeaningfulVoicePhone(call.callerNumber)),
    [data.activeCalls],
  );
  const visibleRecentCalls = useMemo(
    () => data.recentCalls.filter((call) => isMeaningfulVoicePhone(call.callerNumber)),
    [data.recentCalls],
  );
  const visibleWaitingCalls = useMemo(
    () => data.waitingCalls.filter((call) => isMeaningfulVoicePhone(call.callerNumber)),
    [data.waitingCalls],
  );
  const visibleCallQueue = useMemo(
    () =>
      data.callQueue.filter((item: any) =>
        isMeaningfulVoicePhone(item.callerNumber || item.phone || data.selectedPhone),
      ),
    [data.callQueue, data.selectedPhone],
  );

  useEffect(() => {
    setActiveTab(normalizeVoiceTab(searchParams.get("tab")));
  }, [searchParams]);

  const switchTab = (tab: VoiceConsoleTab) => {
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
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
      setLiveStatus("offline");
    };
  }, [pollBaseHref, selectedCallId, selectedPhone]);

  const selectedCall = useMemo(() => {
    return (
      visibleActiveCalls.find((call) => call.id === selectedCallId) ||
      visibleRecentCalls.find((call) => call.id === selectedCallId) ||
      (activeTab === "operations" ? visibleActiveCalls[0] || null : null) ||
      null
    );
  }, [activeTab, selectedCallId, visibleActiveCalls, visibleRecentCalls]);

  const filteredRecentCalls = useMemo(() => {
    const query = recentSearch.trim().toLowerCase();
    return visibleRecentCalls.filter((call) => {
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
  }, [recentFilter, recentSearch, visibleRecentCalls]);

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
      ? visibleWaitingCalls.filter((call) => call.assignedToId === data.viewer.targetUserId)
      : visibleWaitingCalls;
    return (
      calls.find((call) => {
        if (dismissedIncomingIds.includes(call.id)) return false;
        return isFreshIncomingCall(call.startedAt || call.createdAt);
      }) || null
    );
  }, [data.viewer.targetUserId, dismissedIncomingIds, mode, visibleWaitingCalls]);

  useEffect(() => {
    if (!incomingCall) return;
    if (lastAnnouncedCallIdRef.current === incomingCall.id) return;
    lastAnnouncedCallIdRef.current = incomingCall.id;
    setSelectedCallId(incomingCall.id);
    setSelectedPhone(incomingCall.callerNumber);
    setContextTab("customer");
  }, [incomingCall]);

  useEffect(() => {
    if (!selectedPhone || isMeaningfulVoicePhone(selectedPhone)) return;
    if (selectedCall) return;
    setSelectedCallId(null);
    setSelectedPhone(null);
  }, [selectedCall, selectedPhone]);

  const selectedCustomerLinks = useMemo(() => {
    const phone = selectedCall?.callerNumber || (isMeaningfulVoicePhone(selectedPhone) ? selectedPhone : "") || "";
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

  const selectedContextData = useMemo(() => {
    if (!selectedCall || !isMeaningfulVoicePhone(selectedCall.callerNumber)) return null;
    return data.selectedContext;
  }, [data.selectedContext, selectedCall]);

  useEffect(() => {
    if (selectedCall?.customer && isMeaningfulVoicePhone(selectedCall.callerNumber)) {
      softphone.seedCustomerContext({
        name: selectedCall.customer.customerName || selectedCall.callerNumber,
        phone: selectedCall.callerNumber,
        location: selectedCall.customer.location || "Unknown",
        totalSpent: selectedCall.customer.totalPurchasesValue || 0,
        recentOrders: selectedCall.customer.linkedRecords.webOrders || 0,
        recentQuotes: selectedCall.customer.linkedRecords.quotations || 0,
        recentReceipts: selectedCall.customer.linkedRecords.receipts || 0,
        notes: selectedContextData?.recentNotes?.slice(0, 2).map((note) => note.note) || [],
      });
      return;
    }
    softphone.seedCustomerContext(null);
  }, [selectedCall, selectedContextData?.recentNotes, softphone]);

  const handleSelectCall = (callId: string, phone: string) => {
    setSelectedCallId(callId);
    setSelectedPhone(phone);
    setContextTab("customer");
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
          { label: "Waiting", value: String((data.summary as any).waitingCalls), sub: "Queued or still ringing" },
          { label: "Missed", value: String((data.summary as any).missedCalls), sub: "Needs callback" },
          { label: "Active", value: String((data.summary as any).activeCalls), sub: "Live or in progress" },
          { label: "Answered", value: String((data.summary as any).answeredCalls), sub: "Answered or completed" },
          { label: "Avg Talk", value: formatDuration((data.summary as any).averageTalkTimeSeconds), sub: "Current day average" },
        ]
      : [
          { label: "My Calls", value: String((data.summary as any).myCallsToday), sub: "Calls routed to you today" },
          { label: "My Active", value: String((data.summary as any).myActiveCalls), sub: "Live or ringing" },
          { label: "My Missed", value: String((data.summary as any).myMissedCalls), sub: "Needs action" },
          { label: "My Follow-ups", value: String((data.summary as any).myFollowUps), sub: "Open tasks" },
          { label: "My Answered", value: String((data.summary as any).myAnsweredCalls), sub: "Answered or completed" },
        ];

  const visibleAgents = useMemo(() => {
    const routingAliases = [
      { key: "brendah", match: ["brendah"] },
      { key: "jennifer", match: ["jennifer", "jeniffer", "jen"] },
      { key: "jackson", match: ["jackson", "admin"] },
    ];
    const preferredByAlias = new Map<string, (typeof data.agents)[number]>();

    for (const agent of data.agents) {
      const displayName = String((agent as any).displayName || agent.name || "").trim().toLowerCase();
      const email = String(agent.email || "").trim().toLowerCase();
      const role = String(agent.role || "").trim().toLowerCase();
      const alias = routingAliases.find((entry) =>
        entry.match.some((needle) => displayName.includes(needle) || email.includes(needle) || role === needle),
      )?.key;

      if (!alias) continue;

      const current = preferredByAlias.get(alias);
      if (!current) {
        preferredByAlias.set(alias, agent);
        continue;
      }

      const currentScore =
        ((current as any).isRoutingAgent ? 4 : 0) +
        ((current as any).isWebrtcRegistered ? 2 : 0) +
        (((current as any).activeCallCount || 0) > 0 ? 1 : 0);
      const nextScore =
        ((agent as any).isRoutingAgent ? 4 : 0) +
        ((agent as any).isWebrtcRegistered ? 2 : 0) +
        (((agent as any).activeCallCount || 0) > 0 ? 1 : 0);

      if (nextScore > currentScore) {
        preferredByAlias.set(alias, agent);
      }
    }

    return Array.from(preferredByAlias.values()).sort(
      (left, right) =>
        (((left as any).routingPriority as number | undefined) ?? 99) -
          (((right as any).routingPriority as number | undefined) ?? 99) ||
        String((left as any).displayName || left.name || "").localeCompare(String((right as any).displayName || right.name || "")),
    );
  }, [data.agents]);

  const queueItems = useMemo(() => {
    const query = queueSearch.trim().toLowerCase();
    const allItems = [...visibleWaitingCalls, ...visibleCallQueue] as Array<any>;
    return allItems.filter((item) => {
      if (!query) return true;
      return [
        item.callerNumber,
        item.phone,
        item.customer?.customerName,
        item.assignedAgentLabel,
        item.assignedToName,
        item.assignedToEmail,
        item.statusLabel,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [queueSearch, visibleCallQueue, visibleWaitingCalls]);

  const activeCallPreview = useMemo(() => visibleActiveCalls.slice(0, 8), [visibleActiveCalls]);
  const selectedAgent =
    visibleAgents.find((agent) => agent.id === selectedCall?.assignedToId) ||
    visibleAgents.find((agent) => agent.currentCallId === selectedCall?.id) ||
    visibleAgents[0] ||
    null;

  const timelineItems = (data.selectedCallDetail?.timeline?.length
    ? data.selectedCallDetail.timeline
    : selectedContextData?.recentTimeline || []) as Array<any>;

  return (
    <div className="overflow-x-hidden bg-slate-950 text-slate-100">
      <main
        className={`mx-auto max-w-[1600px] space-y-4 px-3 pb-10 sm:px-4 lg:px-6 ${
          mode === "admin" ? "pt-24 sm:pt-28" : "pt-4 sm:pt-5"
        }`}
      >
        <header className={cardShell("px-4 py-4 shadow-[0_18px_48px_rgba(0,0,0,0.28)] sm:px-5")}>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-100">
                  Voice Calls
                </span>
                <button
                  type="button"
                  onClick={() => switchTab("operations")}
                  className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] transition ${
                    activeTab === "operations"
                      ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-100"
                      : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/20"
                  }`}
                >
                  Operations Center
                </button>
                {[
                  ["recent", "Call History"],
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
                <button
                  type="button"
                  onClick={() => switchTab("settings")}
                  className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] transition ${
                    activeTab === "settings"
                      ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-100"
                      : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/20"
                  }`}
                >
                  Softphone Settings
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                <RegistrationBadge />
                <span
                  className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${
                    liveStatus === "live"
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
                      : liveStatus === "connecting"
                        ? "border-amber-500/30 bg-amber-500/10 text-amber-100"
                        : "border-rose-500/30 bg-rose-500/10 text-rose-100"
                  }`}
                >
                  {liveStatus === "live" ? "Live" : liveStatus === "connecting" ? "Connecting" : "Offline"}
                </span>
                {myPresence ? (
                  <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${statusTone(myPresence.status)}`}>
                    {myPresence.status}
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={() => refreshSnapshot(selectedCallId, selectedPhone).catch(() => setError("Refresh failed."))}
                  className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-emerald-100 transition hover:border-emerald-400"
                >
                  Refresh
                </button>
              </div>
            </div>

            <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
              <div>
                <h1 className="text-2xl font-semibold text-white">Voice Operations Center</h1>
                <p className="mt-1 text-sm text-slate-400">
                  Live queue, active call handling, recordings, follow-ups, and routing visibility in one console.
                </p>
              </div>
              <div className="text-xs text-slate-500 xl:text-right">{formatRefreshStamp(lastRefreshAt)}</div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
              {summaryCards.map((card) => (
                <div key={card.label} className="rounded-2xl border border-slate-800 bg-slate-900/75 px-3 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{card.label}</div>
                  <div className="mt-2 text-xl font-semibold text-white">{card.value}</div>
                </div>
              ))}
            </div>

            {mode === "staff" ? (
              <div className="flex flex-wrap gap-2">
                {PRESENCE_STATUSES.map((status) => (
                  <button
                    key={status}
                    type="button"
                    disabled={presencePending}
                    onClick={() => handlePresenceUpdate(status)}
                    className={`rounded-full border px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] transition ${
                      myPresence?.status === status
                        ? "border-emerald-400 bg-emerald-500/15 text-emerald-100"
                        : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/20"
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </header>

        {error ? (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {error}
          </div>
        ) : null}

        {activeTab === "operations" ? (
          <section className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)_360px] xl:items-start">
            <aside className="min-w-0 space-y-4">
              <div className={cardShell("p-4")}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Queue</div>
                    <div className="mt-1 text-lg font-semibold text-white">Incoming and callbacks</div>
                  </div>
                  <span className="rounded-full border border-slate-800 bg-slate-900/80 px-3 py-1 text-xs text-slate-300">
                    {queueItems.length}
                  </span>
                </div>
                <input
                  value={queueSearch}
                  onChange={(event) => setQueueSearch(event.target.value)}
                  placeholder="Search caller, phone, agent"
                  className="mt-3 w-full rounded-2xl border border-slate-800 bg-slate-900/75 px-3 py-3 text-sm text-white outline-none placeholder:text-slate-500"
                />
                <div className="mt-3 space-y-3 xl:max-h-[calc(100vh-25rem)] xl:overflow-y-auto">
                  {incomingCall ? (
                    <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/[0.08] p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100">Ringing now</div>
                        <span className="rounded-full border border-white/10 bg-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white">
                          {formatRelative(incomingCall.waitingSeconds)}
                        </span>
                      </div>
                      <div className="mt-2 font-semibold text-white">{incomingCall.customer.customerName || incomingCall.callerNumber}</div>
                      <div className="mt-1 text-sm text-cyan-50/80">{incomingCall.callerNumber}</div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => handleSelectCall(incomingCall.id, incomingCall.callerNumber)}
                          className="rounded-full border border-emerald-400/40 bg-emerald-500/15 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-100 transition hover:border-emerald-300"
                        >
                          Open
                        </button>
                        <button
                          type="button"
                          onClick={() => setDismissedIncomingIds((current) => [...current, incomingCall.id])}
                          className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-200 transition hover:border-white/20"
                        >
                          Dismiss
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {queueItems.length ? (
                    queueItems.map((item) => {
                      const queueItem = item as any;
                      const id = String(queueItem.id);
                      const phone = String(queueItem.callerNumber || queueItem.phone || "");
                      const name = queueItem.customer?.customerName || phone;
                      const isCall = Boolean(queueItem.callerNumber);
                      const isSelected = selectedCall?.id === id;
                      return (
                        <button
                          key={`${isCall ? "call" : "queue"}-${id}`}
                          type="button"
                          onClick={() => phone && handleSelectCall(id, phone)}
                          className={`w-full rounded-2xl border p-3 text-left transition ${
                            isSelected
                              ? "border-cyan-500/40 bg-cyan-500/[0.08]"
                              : "border-slate-800 bg-slate-900/70 hover:border-slate-700"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="truncate font-semibold text-white">{name}</div>
                              <div className="mt-1 whitespace-nowrap text-sm text-slate-300">{phone}</div>
                              <div className="mt-1 truncate text-xs text-slate-500">
                                {isCall
                                  ? queueItem.routedToDisplay || queueItem.assignedToName || queueItem.assignedToEmail || "Live queue"
                                  : queueItem.assignedAgentLabel}
                              </div>
                            </div>
                            <span className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${statusTone(queueItem.status || queueItem.direction)}`}>
                              {isCall ? queueItem.statusLabel : queueItem.statusLabel || queueItem.type}
                            </span>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-400">
                            {isCall ? (
                              <>
                                <span>{formatTimeOnly(queueItem.startedAt || queueItem.createdAt)}</span>
                                <span>{formatDuration(queueItem.durationInSeconds)}</span>
                              </>
                            ) : (
                              <>
                                <span>{formatDateTime(queueItem.dueAt || queueItem.updatedAt)}</span>
                                <span>{queueItem.type === "task" ? "Task" : "Lead"}</span>
                              </>
                            )}
                          </div>
                        </button>
                      );
                    })
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-800 px-3 py-6 text-sm text-slate-500">
                      No incoming or waiting work right now.
                    </div>
                  )}
                </div>
              </div>

              <div className={cardShell("p-4")}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Agents</div>
                    <div className="mt-1 text-lg font-semibold text-white">Routing availability</div>
                  </div>
                  <span className="rounded-full border border-slate-800 bg-slate-900/80 px-3 py-1 text-xs text-slate-300">
                    {visibleAgents.length}
                  </span>
                </div>
                <div className="mt-3 space-y-3">
                  {visibleAgents.map((agent) => {
                    const row = agent as any;
                    return (
                      <div key={row.id} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-400/10 text-sm font-semibold text-cyan-100">
                            {getInitials(row.displayName || row.name)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-semibold text-white">{row.displayName || row.name}</div>
                            <div className="truncate text-sm text-slate-400">{row.displayRoleLabel}</div>
                          </div>
                          <span className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${statusTone(row.status)}`}>
                            {row.status}
                          </span>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-400">
                          <span className="whitespace-nowrap">{row.phone || "No mobile fallback"}</span>
                          <span className="whitespace-nowrap">{row.isWebrtcRegistered ? "Browser registered" : "Browser offline"}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </aside>

            <section className="min-w-0 space-y-4">
              <div className={cardShell("p-4")}>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Active workspace</div>
                    <div className="mt-1 text-xl font-semibold text-white">
                      {selectedCall?.customer.customerName || selectedCall?.callerNumber || "No active interaction selected"}
                    </div>
                    <div className="mt-1 text-sm text-slate-400">
                      {selectedCall
                        ? [
                            selectedCall.direction === "INBOUND" ? "Inbound call" : "Outbound call",
                            selectedCall.routedToDisplay || selectedCall.assignedToName || "Route pending",
                          ].join(" · ")
                        : "Choose a live caller or callback task to begin work."}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selectedCall?.callerNumber ? (
                      <a
                        href={selectedCustomerLinks.callBack}
                        className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-cyan-100 transition hover:border-cyan-400"
                      >
                        Call back
                      </a>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setShowWorkspaceDialPad((value) => !value)}
                      className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-200 transition hover:border-white/20"
                    >
                      {showWorkspaceDialPad ? "Hide keypad" : "Show keypad"}
                    </button>
                  </div>
                </div>

                <div className="mt-4 space-y-4">
                  <div className="space-y-4">
                    <CallStatusBar />
                    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${statusTone(selectedCall?.status || "idle")}`}>
                          {selectedCall?.statusLabel || "Idle"}
                        </span>
                        {selectedCall ? (
                          <>
                            <span className="rounded-full border border-slate-800 bg-slate-950/80 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-300">
                              {selectedCall.direction}
                            </span>
                            <span className="rounded-full border border-slate-800 bg-slate-950/80 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-300">
                              {formatDuration(selectedCall.durationInSeconds)}
                            </span>
                            <span className="rounded-full border border-slate-800 bg-slate-950/80 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-300">
                              {formatMoney(selectedCall.amount, selectedCall.currencyCode)}
                            </span>
                          </>
                        ) : null}
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={softphone.answerCall}
                          className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-emerald-100 transition hover:border-emerald-400"
                          disabled={!selectedCall}
                        >
                          Answer
                        </button>
                        <button
                          type="button"
                          onClick={softphone.rejectCall}
                          className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-200 transition hover:border-white/20"
                          disabled={!selectedCall}
                        >
                          Decline
                        </button>
                        <button
                          type="button"
                          onClick={softphone.hangUp}
                          className="rounded-full border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-rose-100 transition hover:border-rose-400"
                          disabled={!selectedCall}
                        >
                          Hang up
                        </button>
                        <button
                          type="button"
                          onClick={softphone.toggleMute}
                          className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-200 transition hover:border-white/20"
                          disabled={!selectedCall}
                        >
                          {softphone.currentCall?.muted ? "Unmute" : "Mute"}
                        </button>
                        <button
                          type="button"
                          onClick={softphone.toggleHold}
                          className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-200 transition hover:border-white/20"
                          disabled={!selectedCall}
                        >
                          {softphone.currentCall?.held ? "Resume" : "Hold"}
                        </button>
                      </div>
                      {showWorkspaceDialPad ? (
                        <div className="mt-4">
                          <DialPad compact />
                        </div>
                      ) : null}
                    </div>

                    <div className="grid gap-4 xl:grid-cols-2">
                      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                        <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Call note</label>
                        <textarea
                          value={noteDraft}
                          onChange={(event) => setNoteDraft(event.target.value)}
                          rows={6}
                          placeholder="Capture the promise made, objection handled, or next action."
                          className="mt-3 w-full rounded-2xl border border-slate-800 bg-slate-950/80 px-3 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:ring-2 focus:ring-cyan-500/40"
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

                      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                        <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Follow-up</label>
                        <input
                          value={followUpTitle}
                          onChange={(event) => setFollowUpTitle(event.target.value)}
                          placeholder="Callback customer about quotation"
                          className="mt-3 w-full rounded-2xl border border-slate-800 bg-slate-950/80 px-3 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:ring-2 focus:ring-cyan-500/40"
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
                          rows={4}
                          placeholder="Callback notes, promised time, or supervisor comment."
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

                  <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Live calls</div>
                        <div className="mt-1 text-lg font-semibold text-white">Focus list</div>
                      </div>
                      <span className="rounded-full border border-slate-800 bg-slate-950/80 px-3 py-1 text-xs text-slate-300">
                        {activeCallPreview.length}
                      </span>
                    </div>
                    <div className="mt-3 space-y-3">
                      {activeCallPreview.length ? (
                        activeCallPreview.map((call) => (
                          <button
                            key={call.id}
                            type="button"
                            onClick={() => handleSelectCall(call.id, call.callerNumber)}
                            className={`w-full rounded-2xl border p-3 text-left transition ${
                              selectedCall?.id === call.id
                                ? "border-cyan-500/40 bg-cyan-500/[0.08]"
                                : "border-slate-800 bg-slate-950/60 hover:border-slate-700"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="truncate font-semibold text-white">{call.customer.customerName || call.callerNumber}</div>
                              <span className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${statusTone(call.status)}`}>
                                {call.statusLabel}
                              </span>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-400">
                              <span>{call.callerNumber}</span>
                              <span>{call.assignedToName || call.routedToDisplay || "Unassigned"}</span>
                              <span>{formatTimeOnly(call.startedAt || call.createdAt)}</span>
                            </div>
                          </button>
                        ))
                      ) : (
                        <div className="rounded-2xl border border-dashed border-slate-800 px-3 py-6 text-sm text-slate-500">
                          No live calls at the moment.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <aside className="min-w-0 space-y-4 xl:sticky xl:top-28">
              <div className={cardShell("p-4")}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Customer</div>
                    <div className="mt-1 text-lg font-semibold text-white">Customer details and timeline</div>
                  </div>
                  {selectedCall?.callerNumber ? (
                    <Link
                      href={selectedCustomerLinks.customer}
                      className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-200 transition hover:border-white/20"
                    >
                      Open CRM
                    </Link>
                  ) : null}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {[
                    ["customer", "Customer"],
                    ["timeline", "Timeline"],
                    ["agent", "Agent"],
                    ["recording", "Recording"],
                  ].map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setContextTab(key as typeof contextTab)}
                      className={`rounded-full border px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] transition ${
                        contextTab === key
                          ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-100"
                          : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/20"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <div className="mt-4">
                  {contextTab === "customer" ? (
                    selectedContextData ? (
                      <div className="space-y-4">
                        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                          <div className="text-xl font-semibold text-white">
                            {selectedContextData.customerName || selectedCall?.callerNumber || "Unknown caller"}
                          </div>
                          <div className="mt-1 text-sm text-slate-400">
                            {selectedCall?.callerNumber || "-"} · {selectedContextData.email || "No email"} · {selectedContextData.location || "No location"}
                          </div>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                            <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Total sales</div>
                            <div className="mt-2 text-lg font-semibold text-white">{formatMoney(selectedContextData.totalPurchasesValue)}</div>
                          </div>
                          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                            <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Assigned agent</div>
                            <div className="mt-2 text-sm font-semibold text-white">
                              {selectedContextData.assignedAgent?.name || selectedContextData.assignedAgent?.email || "-"}
                            </div>
                          </div>
                          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                            <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Open quotations</div>
                            <div className="mt-2 text-lg font-semibold text-white">{selectedContextData.openQuotations}</div>
                          </div>
                          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                            <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Pending web orders</div>
                            <div className="mt-2 text-lg font-semibold text-white">{selectedContextData.pendingWebOrders}</div>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <a href={selectedCustomerLinks.callBack} className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-cyan-100 transition hover:border-cyan-400">
                            Call back
                          </a>
                          <Link href={selectedCustomerLinks.quote} className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-emerald-100 transition hover:border-emerald-400">
                            Quote
                          </Link>
                          <Link href={selectedCustomerLinks.receipt} className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-100 transition hover:border-white/20">
                            Receipt
                          </Link>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-slate-800 px-3 py-6 text-sm text-slate-500">
                        Select a real live call or callback to load customer context.
                      </div>
                    )
                  ) : null}

                  {contextTab === "timeline" ? (
                    <div className="space-y-3">
                      {timelineItems.length ? (
                        timelineItems.map((item) => {
                          const row = item as any;
                          return (
                            <div key={row.id} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                              <div className="text-sm font-semibold text-white">{row.title}</div>
                              <div className="mt-1 text-xs text-slate-400">
                                {row.detail || "No extra detail"} · {formatDateTime(row.at)}
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="rounded-2xl border border-dashed border-slate-800 px-3 py-6 text-sm text-slate-500">
                          No timeline entries yet.
                        </div>
                      )}
                    </div>
                  ) : null}

                  {contextTab === "agent" ? (
                    selectedAgent ? (
                      <div className="space-y-4">
                        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-400/10 text-sm font-semibold text-cyan-100">
                              {getInitials((selectedAgent as any).displayName || selectedAgent.name)}
                            </div>
                            <div className="min-w-0">
                              <div className="truncate text-lg font-semibold text-white">{(selectedAgent as any).displayName || selectedAgent.name}</div>
                              <div className="truncate text-sm text-slate-400">{(selectedAgent as any).displayRoleLabel}</div>
                            </div>
                          </div>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                            <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Status</div>
                            <div className="mt-2 flex items-center gap-2">
                              <span className={`inline-flex whitespace-nowrap rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${statusTone(selectedAgent.status)}`}>
                                {selectedAgent.status}
                              </span>
                              <span className="text-xs text-slate-400">{(selectedAgent as any).isAvailableForRouting ? "Routable" : "Not routable"}</span>
                            </div>
                          </div>
                          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                            <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Browser</div>
                            <div className="mt-2 text-sm font-semibold text-white">{(selectedAgent as any).isWebrtcRegistered ? "Registered" : "Offline"}</div>
                            <div className="mt-1 text-xs text-slate-400">{(selectedAgent as any).webRtcIdentity || "No browser identity"}</div>
                          </div>
                          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                            <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Load</div>
                            <div className="mt-2 text-sm text-white">Active {selectedAgent.activeCallCount} · Waiting {selectedAgent.waitingCallCount}</div>
                            <div className="mt-1 text-xs text-slate-400">Last seen {formatDateTime(selectedAgent.lastSeenAt)}</div>
                          </div>
                          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                            <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Fallback line</div>
                            <div className="mt-2 text-sm font-semibold text-white">{(selectedAgent as any).phone || "No mobile fallback"}</div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-slate-800 px-3 py-6 text-sm text-slate-500">
                        No agent context available.
                      </div>
                    )
                  ) : null}

                  {contextTab === "recording" ? (
                    selectedCall?.recordingUrl ? (
                      <div className="space-y-4">
                        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                          <div className="text-sm font-semibold text-white">Recording</div>
                          <div className="mt-1 text-xs text-slate-400">
                            {formatDateTime(selectedCall.startedAt || selectedCall.createdAt)} · {formatDuration(selectedCall.durationInSeconds)}
                          </div>
                        </div>
                        <audio controls preload="none" className="w-full" src={selectedCall.recordingUrl} />
                        <a
                          href={selectedCall.recordingUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-emerald-100 transition hover:border-emerald-400"
                        >
                          Download recording
                        </a>
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-slate-800 px-3 py-6 text-sm text-slate-500">
                        Recording not available for this interaction.
                      </div>
                    )
                  ) : null}
                </div>
              </div>
            </aside>
          </section>
        ) : null}

        {activeTab === "recent" ? (
          <section className={cardShell("p-5")}>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Call History</div>
                <h2 className="mt-1 text-2xl font-semibold text-white">Recent calls</h2>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <input
                  value={recentSearch}
                  onChange={(event) => setRecentSearch(event.target.value)}
                  placeholder="Search caller, route, or status"
                  className="w-full rounded-2xl border border-slate-800 bg-slate-900/75 px-3 py-3 text-sm text-white outline-none placeholder:text-slate-500 sm:w-72"
                />
                <select
                  value={recentFilter}
                  onChange={(event) => setRecentFilter(event.target.value as typeof recentFilter)}
                  className="rounded-2xl border border-slate-800 bg-slate-900/75 px-3 py-3 text-sm text-white outline-none sm:w-52"
                >
                  <option value="all">All directions</option>
                  <option value="INBOUND">Inbound only</option>
                  <option value="OUTBOUND">Outbound only</option>
                  <option value="with_recording">With recording</option>
                </select>
                <button
                  type="button"
                  onClick={handleExportRecentCalls}
                  className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-100 transition hover:border-white/20"
                >
                  Export
                </button>
              </div>
            </div>

            <div className="mt-4 space-y-5">
              {groupedRecentCalls.length ? (
                groupedRecentCalls.map(([bucket, calls]) => (
                  <div key={bucket} className="space-y-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">{bucket}</div>
                    <div className="overflow-x-auto">
                      <div className="min-w-[980px] rounded-2xl border border-slate-800 bg-slate-900/60">
                        <div className="grid grid-cols-[110px_220px_100px_220px_110px_100px_110px_190px] gap-3 border-b border-slate-800 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                          <div>Time</div>
                          <div>Caller</div>
                          <div>Direction</div>
                          <div>Agent</div>
                          <div>Status</div>
                          <div>Duration</div>
                          <div>Cost</div>
                          <div>Actions</div>
                        </div>
                        {calls.map((call) => (
                          <button
                            key={call.id}
                            type="button"
                            onClick={() => {
                              handleSelectCall(call.id, call.callerNumber);
                              switchTab("operations");
                            }}
                            className="grid w-full grid-cols-[110px_220px_100px_220px_110px_100px_110px_190px] gap-3 border-b border-slate-800/80 px-4 py-4 text-left transition last:border-b-0 hover:bg-white/[0.02]"
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
                              <div className="truncate text-sm text-slate-200">{call.routedToDisplay || call.assignedToName || call.assignedToEmail || "-"}</div>
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
                                <a
                                  href={call.recordingUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  onClick={(event) => event.stopPropagation()}
                                  className="inline-flex whitespace-nowrap rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-emerald-100 transition hover:border-emerald-400"
                                >
                                  Recording
                                </a>
                              ) : null}
                              <Link
                                href={call.links.customer}
                                onClick={(event) => event.stopPropagation()}
                                className="inline-flex whitespace-nowrap rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-100 transition hover:border-white/20"
                              >
                                CRM
                              </Link>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-800 px-4 py-8 text-sm text-slate-500">
                  No recent calls match the current filter.
                </div>
              )}
            </div>
          </section>
        ) : null}

        {activeTab === "recordings" ? (
          <section className={cardShell("p-5")}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Recordings</div>
                <h2 className="mt-1 text-2xl font-semibold text-white">Saved call recordings</h2>
              </div>
              <span className="rounded-full border border-slate-800 bg-slate-900/80 px-3 py-1 text-xs text-slate-300">
                {data.recentRecordings.length}
              </span>
            </div>
            <div className="mt-4 grid gap-4 xl:grid-cols-2">
              {data.recentRecordings.length ? (
                data.recentRecordings.map((call) => (
                  <div key={call.id} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-white">{call.customer.customerName || call.callerNumber}</div>
                        <div className="mt-1 text-sm text-slate-400">{call.callerNumber}</div>
                        <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-400">
                          <span>{call.assignedToName || call.assignedToEmail || call.routedToDisplay || "Unassigned"}</span>
                          <span>{formatDuration(call.durationInSeconds)}</span>
                          <span>{formatMoney(call.amount, call.currencyCode)}</span>
                        </div>
                      </div>
                      {call.recordingUrl ? (
                        <a
                          href={call.recordingUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-emerald-100 transition hover:border-emerald-400"
                        >
                          Download
                        </a>
                      ) : null}
                    </div>
                    {call.recordingUrl ? (
                      <audio controls preload="none" className="mt-4 w-full" src={call.recordingUrl} />
                    ) : (
                      <div className="mt-4 rounded-2xl border border-dashed border-slate-800 px-3 py-4 text-sm text-slate-500">
                        Recording URL unavailable.
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-800 px-4 py-8 text-sm text-slate-500">
                  No recordings available yet.
                </div>
              )}
            </div>
          </section>
        ) : null}

        {activeTab === "followups" ? (
          <section className={cardShell("p-5")}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Follow-ups</div>
                <h2 className="mt-1 text-2xl font-semibold text-white">Callback and reassignment queue</h2>
              </div>
              <span className="rounded-full border border-slate-800 bg-slate-900/80 px-3 py-1 text-xs text-slate-300">
                {data.callQueue.length}
              </span>
            </div>
            <div className="mt-4 space-y-3">
              {data.callQueue.length ? (
                data.callQueue.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-white">{item.customer.customerName || item.phone}</div>
                        <div className="mt-1 text-sm text-slate-400">{item.phone} · {item.title}</div>
                        <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-500">
                          <span>{item.assignedAgentLabel}</span>
                          <span>{formatDateTime(item.dueAt || item.updatedAt)}</span>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${statusTone(item.status)}`}>
                          {item.statusLabel}
                        </span>
                        <a href={item.links.callBack} className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-cyan-100 transition hover:border-cyan-400">
                          Callback
                        </a>
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
                          className="rounded-full border border-slate-800 bg-slate-950/80 px-3 py-2 text-xs text-slate-100 outline-none"
                        >
                          <option value="">Reassign</option>
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
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-800 px-4 py-8 text-sm text-slate-500">
                  No pending follow-ups right now.
                </div>
              )}
            </div>
          </section>
        ) : null}

        {activeTab === "agents" ? (
          <section className={cardShell("p-5")}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Agents</div>
                <h2 className="mt-1 text-2xl font-semibold text-white">Routing status for Brendah, Jennifer, and Jackson</h2>
              </div>
              <span className="rounded-full border border-slate-800 bg-slate-900/80 px-3 py-1 text-xs text-slate-300">
                {visibleAgents.length}
              </span>
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-3">
              {visibleAgents.length ? (
                visibleAgents.map((agent) => {
                  const row = agent as any;
                  return (
                    <div key={row.id} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-400/10 text-sm font-semibold text-cyan-100">
                          {getInitials(row.displayName || row.name)}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-lg font-semibold text-white">{row.displayName || row.name}</div>
                          <div className="truncate text-sm text-slate-400">{row.displayRoleLabel}</div>
                        </div>
                      </div>
                      <div className="mt-4 space-y-3 text-sm text-slate-300">
                        <div className="flex items-center justify-between gap-3">
                          <span>Status</span>
                          <span className={`inline-flex whitespace-nowrap rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${statusTone(row.status)}`}>
                            {row.status}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span>Browser</span>
                          <span className="text-right text-slate-400">{row.isWebrtcRegistered ? "Registered" : "Offline"}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span>Active calls</span>
                          <span>{row.activeCallCount}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span>Waiting</span>
                          <span>{row.waitingCallCount}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span>Fallback line</span>
                          <span className="whitespace-nowrap text-slate-400">{row.phone || "—"}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span>Last seen</span>
                          <span className="text-right text-slate-400">{formatDateTime(row.lastSeenAt)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-800 px-4 py-8 text-sm text-slate-500">
                  No routing agents available yet.
                </div>
              )}
            </div>
          </section>
        ) : null}

        {activeTab === "settings" ? (
          <section className={cardShell("p-5")}>
            <VoiceSettingsClient />
          </section>
        ) : null}
      </main>
    </div>
  );
}
