"use client";

import {
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Grip,
  History,
  Mic,
  MoreHorizontal,
  PhoneCall,
  PhoneOff,
  Radio,
  Settings2,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import DialPad from "@/components/voice/DialPad";
import RegistrationBadge from "@/components/voice/RegistrationBadge";
import VoiceSettingsClient from "@/components/voice/VoiceSettingsClient";
import { useSoftphone } from "@/components/voice/SoftphoneProvider";
import { getTradingPeriodFor } from "@/lib/tradingPeriod";
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
const VOICE_DATE_FILTERS = ["today", "yesterday", "week", "period"] as const;
type VoiceDateFilter = (typeof VOICE_DATE_FILTERS)[number];

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
  if (["available", "answered", "completed", "resolved", "contacted", "registered", "live", "success"].includes(normalized)) {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-100";
  }
  if (["busy", "ringing", "queued", "pending", "in_progress", "pending_follow_up", "away", "waiting", "connecting"].includes(normalized)) {
    return "border-amber-500/30 bg-amber-500/10 text-amber-100";
  }
  if (["offline", "break", "missed", "aborted", "failed", "closed", "error"].includes(normalized)) {
    return "border-rose-500/30 bg-rose-500/10 text-rose-100";
  }
  return "border-white/10 bg-white/[0.04] text-slate-200";
}

function cardShell(extra = "") {
  return `rounded-[24px] border border-slate-800/90 bg-slate-950/96 ${extra}`.trim();
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

function normalizeVoiceDateFilter(value: string | null): VoiceDateFilter {
  return VOICE_DATE_FILTERS.includes(value as VoiceDateFilter) ? (value as VoiceDateFilter) : "today";
}

function getVoiceDateFilterMeta(
  filter: VoiceDateFilter,
  now = new Date(),
): { label: string; start: Date; end: Date; detail?: string } {
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart);
  todayEnd.setHours(23, 59, 59, 999);

  if (filter === "today") {
    return { label: "Today", start: todayStart, end: todayEnd };
  }

  if (filter === "yesterday") {
    const start = new Date(todayStart);
    start.setDate(start.getDate() - 1);
    const end = new Date(start);
    end.setHours(23, 59, 59, 999);
    return { label: "Yesterday", start, end };
  }

  if (filter === "week") {
    const dayOfWeek = todayStart.getDay();
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const start = new Date(todayStart);
    start.setDate(start.getDate() + diffToMonday);
    return { label: "This Week", start, end: todayEnd };
  }

  const tradingPeriod = getTradingPeriodFor(now);
  return {
    label: "Trading Period",
    start: tradingPeriod.start,
    end: tradingPeriod.end,
    detail: tradingPeriod.label,
  };
}

function isWithinVoiceDateFilter(value: string | null | undefined, filter: VoiceDateFilter) {
  if (!value) return false;
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return false;
  const range = getVoiceDateFilterMeta(filter);
  return timestamp >= range.start.getTime() && timestamp <= range.end.getTime();
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
  const [expandedRecentCallId, setExpandedRecentCallId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<VoiceConsoleTab>(() => normalizeVoiceTab(searchParams.get("tab")));
  const [dateFilter, setDateFilter] = useState<VoiceDateFilter>(() => normalizeVoiceDateFilter(searchParams.get("range")));
  const [queueView, setQueueView] = useState<"all" | "waiting" | "missed">("all");
  const lastInteractionAtRef = useRef(Date.now());
  const availabilityTimerRef = useRef<number | null>(null);
  const lastAnnouncedCallIdRef = useRef<string | null>(null);
  const liveStatusTimeoutRef = useRef<number | null>(null);

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

  const dateFilterMeta = useMemo(() => getVoiceDateFilterMeta(dateFilter), [dateFilter]);

  const filteredRecentCalls = useMemo(() => {
    const query = recentSearch.trim().toLowerCase();
    return visibleRecentCalls.filter((call) => {
      if (!isWithinVoiceDateFilter(call.startedAt || call.createdAt, dateFilter)) return false;
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
  }, [dateFilter, recentFilter, recentSearch, visibleRecentCalls]);

  const filteredRecordings = useMemo(
    () => data.recentRecordings.filter((call) => isWithinVoiceDateFilter(call.startedAt || call.createdAt, dateFilter)),
    [data.recentRecordings, dateFilter],
  );

  const filteredFollowUps = useMemo(
    () =>
      visibleCallQueue.filter((item: any) =>
        isWithinVoiceDateFilter(item.dueAt || item.updatedAt || item.createdAt, dateFilter),
      ),
    [dateFilter, visibleCallQueue],
  );

  useEffect(() => {
    setActiveTab(normalizeVoiceTab(searchParams.get("tab")));
    setDateFilter(normalizeVoiceDateFilter(searchParams.get("range")));
  }, [searchParams]);

  const switchTab = (tab: VoiceConsoleTab) => {
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const switchDateFilter = (nextFilter: VoiceDateFilter) => {
    setDateFilter(nextFilter);
    const params = new URLSearchParams(searchParams.toString());
    params.set("range", nextFilter);
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
    if (liveStatusTimeoutRef.current) {
      window.clearTimeout(liveStatusTimeoutRef.current);
      liveStatusTimeoutRef.current = null;
    }
    liveStatusTimeoutRef.current = window.setTimeout(() => {
      setLiveStatus((current) => (current === "live" ? current : "connecting"));
    }, 1200);

    eventSource.onopen = () => {
      if (liveStatusTimeoutRef.current) {
        window.clearTimeout(liveStatusTimeoutRef.current);
        liveStatusTimeoutRef.current = null;
      }
      setLiveStatus("live");
      setError(null);
    };

    eventSource.onerror = () => {
      if (liveStatusTimeoutRef.current) {
        window.clearTimeout(liveStatusTimeoutRef.current);
        liveStatusTimeoutRef.current = null;
      }
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
      if (liveStatusTimeoutRef.current) {
        window.clearTimeout(liveStatusTimeoutRef.current);
        liveStatusTimeoutRef.current = null;
      }
      try {
        eventSource.close();
      } catch {}
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
    const calls =
      mode === "staff"
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

  const handleToggleRecentCall = (callId: string, phone: string) => {
    const nextExpanded = expandedRecentCallId === callId ? null : callId;
    setExpandedRecentCallId(nextExpanded);
    if (!nextExpanded) return;
    if (selectedCallId === callId && selectedPhone === phone) return;
    handleSelectCall(callId, phone);
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
    const csv = rows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")).join("\n");
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
        headers: { "Content-Type": "application/json" },
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
          headers: { "Content-Type": "application/json" },
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
        headers: { "Content-Type": "application/json" },
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
        headers: { "Content-Type": "application/json" },
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
        headers: { "Content-Type": "application/json" },
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
        headers: { "Content-Type": "application/json" },
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

  const filteredAnsweredCount = filteredRecentCalls.filter((call) =>
    ["answered", "in progress", "completed"].includes(String(call.statusLabel || "").trim().toLowerCase()),
  ).length;

  const filteredMissedCount =
    filteredRecentCalls.filter((call) =>
      ["missed", "no answer", "busy", "failed", "aborted"].includes(String(call.statusLabel || "").trim().toLowerCase()),
    ).length + filteredFollowUps.length;

  const filteredAverageTalkTime =
    filteredRecentCalls.reduce((sum, call) => sum + Number(call.durationInSeconds || 0), 0) /
    Math.max(1, filteredRecentCalls.filter((call) => Number(call.durationInSeconds || 0) > 0).length);

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
        String((left as any).displayName || left.name || "").localeCompare(
          String((right as any).displayName || right.name || ""),
        ),
    );
  }, [data.agents]);

  const queueItems = useMemo(() => {
    const query = queueSearch.trim().toLowerCase();
    const allItems = [...visibleWaitingCalls, ...filteredFollowUps] as Array<any>;
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
  }, [filteredFollowUps, queueSearch, visibleWaitingCalls]);

  const queueItemsByView = useMemo(() => {
    if (queueView === "waiting") return queueItems.filter((item: any) => Boolean(item.callerNumber));
    if (queueView === "missed") return queueItems.filter((item: any) => !item.callerNumber);
    return queueItems;
  }, [queueItems, queueView]);

  const activeCallPreview = useMemo(() => visibleActiveCalls.slice(0, 6), [visibleActiveCalls]);

  const selectedAgent =
    visibleAgents.find((agent) => agent.id === selectedCall?.assignedToId) ||
    visibleAgents.find((agent) => agent.currentCallId === selectedCall?.id) ||
    visibleAgents[0] ||
    null;

  const timelineItems = (data.selectedCallDetail?.timeline?.length
    ? data.selectedCallDetail.timeline
    : selectedContextData?.recentTimeline || []) as Array<any>;

  const consoleNav = [
    { key: "operations", label: "Live Desk", icon: PhoneCall },
    { key: "recent", label: "Call History", icon: History },
    { key: "recordings", label: "Recordings", icon: Radio },
    { key: "followups", label: "Follow-ups", icon: ClipboardList },
    { key: "agents", label: "Agents", icon: Users },
    { key: "settings", label: "Settings", icon: Settings2 },
  ] as const;

  const activeTabDescriptionMap: Record<VoiceConsoleTab, string> = {
    operations: "Live queue, active call handling, recordings, follow-ups, and routing visibility in one console.",
    recent: "Review completed and in-progress calls with detailed history, actions, and CRM-linked context.",
    recordings: "Monitor saved call recordings, playback, and download access across the selected period.",
    followups: "Track callback work, pending customer actions, and reassignment across the voice desk.",
    agents: "Watch routing readiness, browser registration, workload, and fallback lines for each routing agent.",
    settings: "Control browser calling, devices, registration, and operator preferences from one place.",
  };

  const topMetrics =
    mode === "admin"
      ? [
          { label: "Calls Today", value: String(filteredRecentCalls.length) },
          { label: "Waiting", value: String(visibleWaitingCalls.length) },
          { label: "Missed", value: String(filteredMissedCount) },
          {
            label: "Avg Talk Time",
            value: formatDuration(Number.isFinite(filteredAverageTalkTime) ? Math.round(filteredAverageTalkTime) : 0),
          },
        ]
      : [
          { label: "My Calls", value: String(filteredRecentCalls.length) },
          { label: "My Waiting", value: String(visibleWaitingCalls.length) },
          { label: "My Missed", value: String(filteredMissedCount) },
          {
            label: "Avg Talk Time",
            value: formatDuration(Number.isFinite(filteredAverageTalkTime) ? Math.round(filteredAverageTalkTime) : 0),
          },
        ];

  const contextQuickCards = [
    { label: "Phone Number", value: selectedCall?.callerNumber || "No active call" },
    { label: "Location", value: selectedContextData?.location || "No location saved" },
    {
      label: "Assigned Agent",
      value:
        selectedContextData?.assignedAgent?.name ||
        selectedContextData?.assignedAgent?.email ||
        (selectedAgent as any)?.displayName ||
        "Unassigned",
    },
    { label: "First Seen", value: formatDateTime(selectedCall?.startedAt || selectedCall?.createdAt || null) },
  ];

  const selectedCallLabel =
    selectedCall?.customer.customerName || selectedContextData?.customerName || selectedCall?.callerNumber || "No active call";

  const selectedCallSubLabel = selectedCall
    ? `${selectedCall.direction === "INBOUND" ? "Inbound call" : "Outbound call"} · ${
        selectedCall.routedToDisplay || selectedCall.assignedToName || selectedCall.assignedToEmail || "Route pending"
      }`
    : "Choose a live caller or callback task to begin work.";

  const statusSelectValue =
    myPresence?.status && PRESENCE_STATUSES.includes(myPresence.status as (typeof PRESENCE_STATUSES)[number])
      ? (myPresence.status as (typeof PRESENCE_STATUSES)[number])
      : "AVAILABLE";

  return (
    <div className="overflow-x-hidden bg-slate-950 text-slate-100">
      <main
        className={`mx-auto max-w-[1880px] px-3 pb-10 sm:px-4 lg:px-6 xl:px-8 2xl:px-10 ${
          mode === "admin" ? "pt-24 sm:pt-28" : "pt-4 sm:pt-5"
        }`}
      >
        {error ? (
          <div className="mb-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {error}
          </div>
        ) : null}

        <section className={cardShell("overflow-hidden shadow-[0_30px_90px_rgba(0,0,0,0.35)]")}>
          <div className="grid min-h-[calc(100vh-11rem)] lg:grid-cols-[232px_minmax(0,1fr)]">
            <aside className="border-b border-slate-800/90 bg-[linear-gradient(180deg,rgba(12,18,32,0.98),rgba(7,13,24,0.98))] lg:border-b-0 lg:border-r">
              <div className="flex items-center gap-3 border-b border-slate-800/90 px-5 py-5">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
                  <Grip className="h-5 w-5 text-slate-200" />
                </div>
                <div>
                  <div className="text-lg font-semibold text-white">BetechOps</div>
                  <div className="text-sm text-slate-400">Unified Admin</div>
                </div>
              </div>

              <div className="space-y-6 px-4 py-5">
                <div>
                  <div className="px-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Main</div>
                  <div className="mt-3 space-y-1.5">
                    {consoleNav.map((item) => {
                      const Icon = item.icon;
                      const isActive = activeTab === item.key;
                      return (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => switchTab(item.key)}
                          className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition ${
                            isActive
                              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
                              : "border-transparent text-slate-300 hover:border-white/10 hover:bg-white/[0.03]"
                          }`}
                        >
                          <Icon className="h-4.5 w-4.5 shrink-0" />
                          <span className="text-sm font-medium">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="border-t border-slate-800/90 pt-5">
                  <div className="px-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Quick Actions</div>
                  <div className="mt-3 space-y-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        switchTab("operations");
                        setShowWorkspaceDialPad(true);
                      }}
                      className="flex w-full items-center gap-3 rounded-2xl border border-transparent px-3 py-3 text-left text-slate-300 transition hover:border-white/10 hover:bg-white/[0.03]"
                    >
                      <PhoneCall className="h-4.5 w-4.5 shrink-0" />
                      <span className="text-sm font-medium">Open Dialer</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => switchTab("followups")}
                      className="flex w-full items-center gap-3 rounded-2xl border border-transparent px-3 py-3 text-left text-slate-300 transition hover:border-white/10 hover:bg-white/[0.03]"
                    >
                      <ClipboardList className="h-4.5 w-4.5 shrink-0" />
                      <span className="text-sm font-medium">Create Follow-up</span>
                    </button>
                    <a
                      href={selectedCustomerLinks.callBack}
                      className="flex w-full items-center gap-3 rounded-2xl border border-transparent px-3 py-3 text-left text-slate-300 transition hover:border-white/10 hover:bg-white/[0.03]"
                    >
                      <PhoneOff className="h-4.5 w-4.5 shrink-0" />
                      <span className="text-sm font-medium">Call Back</span>
                    </a>
                  </div>
                </div>
              </div>
            </aside>

            <div className="min-w-0 bg-[linear-gradient(180deg,rgba(9,16,30,0.98),rgba(4,8,18,1))]">
              <div className="border-b border-slate-800/90 px-4 py-4 sm:px-5 lg:px-6">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-400/10 text-cyan-100">
                      <PhoneCall className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-2xl font-semibold tracking-tight text-white">
                        {title || "Voice Center"}
                      </div>
                      <div className="truncate text-sm text-slate-400">
                        {activeTab === "operations" ? subtitle || "Voice operations workspace" : activeTabDescriptionMap[activeTab]}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 xl:items-end">
                    <div className="flex flex-wrap items-center gap-2">
                      <RegistrationBadge />
                      <span className={`rounded-full border px-3 py-2 text-sm font-semibold ${statusTone(liveStatus)}`}>
                        {liveStatus === "live" ? "Live" : liveStatus === "connecting" ? "Connecting" : "Offline"}
                      </span>
                      <select
                        value={statusSelectValue}
                        onChange={(event) =>
                          handlePresenceUpdate(event.target.value as (typeof PRESENCE_STATUSES)[number])
                        }
                        disabled={presencePending}
                        className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-100 outline-none"
                      >
                        {PRESENCE_STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                      {topMetrics.map((metric) => (
                        <div key={metric.label} className="min-w-[110px] rounded-2xl border border-slate-800/90 bg-slate-950/85 px-4 py-3">
                          <div className="text-xs text-slate-500">{metric.label}</div>
                          <div className="mt-1 text-2xl font-semibold text-white">{metric.value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="min-w-0 px-4 py-5 sm:px-5 lg:px-6">
                {activeTab === "operations" ? (
                  <section className="grid gap-4 xl:grid-cols-[370px_minmax(0,1fr)_400px] xl:items-start">
                    <aside className="min-w-0 space-y-4">
                      <div className={cardShell("p-4")}>
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Incoming Queue</div>
                            <div className="mt-1 text-lg font-semibold text-white">Live work items</div>
                          </div>
                          <span className="rounded-full border border-slate-800 bg-slate-900/80 px-3 py-1 text-xs text-slate-300">
                            {queueItems.length}
                          </span>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          {[
                            { key: "all", label: `All (${queueItems.length})` },
                            { key: "waiting", label: `Waiting (${visibleWaitingCalls.length})` },
                            { key: "missed", label: `Missed (${filteredFollowUps.length})` },
                          ].map((item) => (
                            <button
                              key={item.key}
                              type="button"
                              onClick={() => setQueueView(item.key as typeof queueView)}
                              className={`rounded-full border px-3 py-2 text-sm font-medium transition ${
                                queueView === item.key
                                  ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-100"
                                  : "border-white/10 bg-white/[0.02] text-slate-400 hover:border-white/20 hover:text-slate-200"
                              }`}
                            >
                              {item.label}
                            </button>
                          ))}
                        </div>

                        <input
                          value={queueSearch}
                          onChange={(event) => setQueueSearch(event.target.value)}
                          placeholder="Search caller, phone, agent"
                          className="mt-4 w-full rounded-2xl border border-slate-800 bg-slate-900/75 px-3 py-3 text-sm text-white outline-none placeholder:text-slate-500"
                        />

                        <div className="mt-4 space-y-3 xl:max-h-[36rem] xl:overflow-y-auto">
                          {queueItemsByView.length ? (
                            queueItemsByView.map((item) => {
                              const queueItem = item as any;
                              const id = String(queueItem.id);
                              const phone = String(queueItem.callerNumber || queueItem.phone || "");
                              const isCall = Boolean(queueItem.callerNumber);
                              const isSelected = selectedCall?.id === id;
                              return (
                                <button
                                  key={`${isCall ? "call" : "queue"}-${id}`}
                                  type="button"
                                  onClick={() => phone && handleSelectCall(id, phone)}
                                  className={`w-full rounded-[20px] border p-4 text-left transition ${
                                    isSelected
                                      ? "border-cyan-500/35 bg-cyan-500/[0.09]"
                                      : "border-slate-800 bg-slate-900/70 hover:border-slate-700"
                                  }`}
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <div className="text-lg font-semibold text-white">
                                        {queueItem.customer?.customerName || phone}
                                      </div>
                                      <div className="mt-1 text-sm text-slate-400">
                                        {queueItem.customer?.location || queueItem.routedToDisplay || queueItem.assignedAgentLabel || "Queue item"}
                                      </div>
                                      <div className="mt-2 text-2xl font-semibold text-white">{phone}</div>
                                    </div>
                                    <div className="text-right">
                                      <span className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${statusTone(queueItem.status || queueItem.direction)}`}>
                                        {isCall ? queueItem.statusLabel : queueItem.statusLabel || queueItem.type}
                                      </span>
                                      <div className="mt-2 text-sm text-slate-400">
                                        {isCall ? formatRelative(queueItem.waitingSeconds) : formatTimeOnly(queueItem.dueAt || queueItem.updatedAt)}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="mt-3 flex items-center justify-between gap-3 text-sm text-slate-400">
                                    <div className="truncate">
                                      {queueItem.assignedToName || queueItem.assignedToEmail || queueItem.routedToDisplay || "Unassigned"}
                                    </div>
                                    <div className="shrink-0">
                                      {isCall ? formatTimeOnly(queueItem.startedAt || queueItem.createdAt) : queueItem.type === "task" ? "Task" : "Lead"}
                                    </div>
                                  </div>
                                </button>
                              );
                            })
                          ) : (
                            <div className="rounded-2xl border border-dashed border-slate-800 px-4 py-8 text-sm text-slate-500">
                              No queue items for this view.
                            </div>
                          )}
                        </div>
                      </div>

                      <div className={cardShell("p-4")}>
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Agent Availability</div>
                            <div className="mt-1 text-lg font-semibold text-white">Routing visibility</div>
                          </div>
                          <div className="text-sm font-semibold text-emerald-300">
                            {visibleAgents.filter((agent: any) => agent.status === "AVAILABLE").length}/{visibleAgents.length} Online
                          </div>
                        </div>

                        <div className="mt-4 space-y-3">
                          {visibleAgents.map((agent) => {
                            const row = agent as any;
                            return (
                              <div key={row.id} className="flex items-center gap-3 rounded-[20px] border border-slate-800 bg-slate-900/70 px-4 py-3">
                                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-cyan-400/20 bg-cyan-400/10 text-sm font-semibold text-cyan-100">
                                  {getInitials(row.displayName || row.name)}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="truncate font-semibold text-white">{row.displayName || row.name}</div>
                                  <div className="truncate text-sm text-slate-400">{row.displayRoleLabel}</div>
                                </div>
                                <div className="text-right">
                                  <span className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${statusTone(row.status)}`}>
                                    {row.status}
                                  </span>
                                  <div className="mt-2 text-xs text-slate-500">
                                    {row.isWebrtcRegistered ? "Browser ready" : "Browser offline"}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </aside>

                    <section className="min-w-0 space-y-4">
                      <div className={cardShell("p-5")}>
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                              <span>Active Call</span>
                              {selectedCall ? (
                                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] text-emerald-100">
                                  Live
                                </span>
                              ) : null}
                            </div>
                            <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-center">
                              <div className="flex h-24 w-24 items-center justify-center rounded-full border border-emerald-400/30 bg-emerald-500/10 text-emerald-100">
                                <PhoneCall className="h-10 w-10" />
                              </div>
                              <div className="min-w-0">
                                <div className="truncate text-4xl font-semibold tracking-tight text-white">{selectedCallLabel}</div>
                                <div className="mt-2 text-base text-slate-400">
                                  {selectedContextData?.location || selectedCall?.customer.location || "Customer location not captured"}
                                </div>
                                {selectedCall ? (
                                  <div className="mt-2">
                                    <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-100">
                                      {selectedCall.direction === "INBOUND" ? "Inbound Call" : "Outbound Call"}
                                    </span>
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-medium text-slate-300">{selectedCall ? formatDuration(selectedCall.durationInSeconds) : "00:00"}</div>
                          </div>
                        </div>

                        <div className="mt-6 grid gap-3 sm:grid-cols-5">
                          {[
                            { label: softphone.currentCall?.muted ? "Unmute" : "Mute", onClick: softphone.toggleMute, icon: Mic },
                            { label: softphone.currentCall?.held ? "Resume" : "Hold", onClick: softphone.toggleHold, icon: PhoneOff },
                            { label: showWorkspaceDialPad ? "Hide Keypad" : "Keypad", onClick: () => setShowWorkspaceDialPad((value) => !value), icon: Grip },
                            { label: "Answer", onClick: softphone.answerCall, icon: PhoneCall },
                            { label: "More", onClick: () => switchTab("recent"), icon: MoreHorizontal },
                          ].map((action) => {
                            const Icon = action.icon;
                            return (
                              <button
                                key={action.label}
                                type="button"
                                onClick={action.onClick}
                                disabled={!selectedCall && action.label !== "Keypad" && action.label !== "More"}
                                className="flex flex-col items-center justify-center gap-2 rounded-[20px] border border-slate-800 bg-slate-900/70 px-4 py-4 text-center text-sm font-medium text-slate-100 transition hover:border-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                <Icon className="h-5 w-5" />
                                <span>{action.label}</span>
                              </button>
                            );
                          })}
                        </div>

                        <div className="mt-5 flex flex-wrap gap-3">
                          <button
                            type="button"
                            onClick={softphone.hangUp}
                            disabled={!selectedCall}
                            className="min-w-[220px] rounded-full border border-rose-500/40 bg-rose-600 px-6 py-3 text-base font-semibold text-white transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            End Call
                          </button>
                          <a
                            href={selectedCustomerLinks.callBack}
                            className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-5 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-cyan-100 transition hover:border-cyan-400"
                          >
                            Call Back
                          </a>
                        </div>

                        {showWorkspaceDialPad ? (
                          <div className="mt-5 rounded-[22px] border border-slate-800 bg-slate-900/70 p-4">
                            <DialPad compact />
                          </div>
                        ) : null}

                        <div className="mt-6 rounded-[22px] border border-slate-800 bg-slate-900/55 p-4">
                          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
                            <div className="grid gap-4 md:grid-cols-2">
                              <div className="rounded-[20px] border border-slate-800 bg-slate-950/70 p-4">
                                <div className="text-sm font-semibold text-white">Customer</div>
                                <div className="mt-3 text-lg font-semibold text-white">
                                  {selectedContextData?.customerName || selectedCall?.callerNumber || "Unknown caller"}
                                </div>
                                <div className="mt-1 text-sm text-slate-400">{selectedCall?.callerNumber || "No active number"}</div>
                                <div className="mt-3">
                                  <span className="rounded-full border border-fuchsia-500/30 bg-fuchsia-500/10 px-3 py-1 text-xs font-semibold text-fuchsia-100">
                                    {selectedContextData?.matchedCustomerId ? "Known Customer" : "New Customer"}
                                  </span>
                                </div>
                              </div>

                              <div className="rounded-[20px] border border-slate-800 bg-slate-950/70 p-4">
                                <div className="text-sm font-semibold text-white">Context</div>
                                <div className="mt-3 space-y-2 text-sm text-slate-400">
                                  <div>{selectedContextData?.email || "No email saved"}</div>
                                  <div>{selectedContextData?.location || "No location saved"}</div>
                                  <div>
                                    {selectedContextData
                                      ? `${selectedContextData.linkedRecords.recentCalls} previous calls · ${selectedContextData.linkedRecords.webOrders} orders · ${selectedContextData.linkedRecords.quotations} quotes`
                                      : "No CRM records found"}
                                  </div>
                                </div>
                              </div>

                              <div className="rounded-[20px] border border-slate-800 bg-slate-950/70 p-4 md:col-span-2">
                                <div className="text-sm font-semibold text-white">Quick Note</div>
                                <textarea
                                  value={noteDraft}
                                  onChange={(event) => setNoteDraft(event.target.value)}
                                  rows={4}
                                  placeholder="Add a note about this call..."
                                  className="mt-3 w-full rounded-2xl border border-slate-800 bg-slate-950/80 px-3 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:ring-2 focus:ring-cyan-500/40"
                                />
                                <button
                                  type="button"
                                  disabled={!selectedCall?.id || submittingNote || !noteDraft.trim()}
                                  onClick={handleAddNote}
                                  className="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-100 transition hover:border-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  {submittingNote ? "Saving..." : "Save Note"}
                                </button>
                              </div>
                            </div>

                            <div className="rounded-[20px] border border-slate-800 bg-slate-950/70 p-4">
                              <div className="text-sm font-semibold text-white">Follow-up</div>
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
                                rows={5}
                                placeholder="Follow-up notes or supervisor instruction"
                                className="mt-3 w-full rounded-2xl border border-slate-800 bg-slate-950/80 px-3 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:ring-2 focus:ring-cyan-500/40"
                              />
                              <button
                                type="button"
                                disabled={submittingFollowUp || !followUpTitle.trim()}
                                onClick={handleCreateFollowUp}
                                className="mt-3 w-full rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-sm font-semibold text-cyan-100 transition hover:border-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {submittingFollowUp ? "Saving..." : "Create Follow-up"}
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="mt-6 rounded-[22px] border border-slate-800 bg-slate-900/55 p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Live calls</div>
                              <div className="mt-1 text-lg font-semibold text-white">Focus list</div>
                            </div>
                            <span className="rounded-full border border-slate-800 bg-slate-950/80 px-3 py-1 text-xs text-slate-300">
                              {activeCallPreview.length}
                            </span>
                          </div>
                          <div className="mt-4 space-y-3">
                            {activeCallPreview.length ? (
                              activeCallPreview.map((call) => (
                                <button
                                  key={call.id}
                                  type="button"
                                  onClick={() => handleSelectCall(call.id, call.callerNumber)}
                                  className={`w-full rounded-[20px] border p-4 text-left transition ${
                                    selectedCall?.id === call.id
                                      ? "border-cyan-500/35 bg-cyan-500/[0.09]"
                                      : "border-slate-800 bg-slate-950/60 hover:border-slate-700"
                                  }`}
                                >
                                  <div className="flex items-center justify-between gap-3">
                                    <div className="min-w-0">
                                      <div className="truncate text-lg font-semibold text-white">
                                        {call.customer.customerName || call.callerNumber}
                                      </div>
                                      <div className="mt-1 text-sm text-slate-400">
                                        {call.callerNumber} · {call.assignedToName || call.routedToDisplay || "Unassigned"}
                                      </div>
                                    </div>
                                    <span className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${statusTone(call.status)}`}>
                                      {call.statusLabel}
                                    </span>
                                  </div>
                                </button>
                              ))
                            ) : (
                              <div className="rounded-2xl border border-dashed border-slate-800 px-4 py-8 text-sm text-slate-500">
                                No live calls at the moment.
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </section>

                    <aside className="min-w-0 space-y-4">
                      <div className={cardShell("p-4")}>
                        <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-3">
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
                              className={`rounded-full border px-3 py-2 text-sm font-medium transition ${
                                contextTab === key
                                  ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-100"
                                  : "border-white/10 bg-white/[0.02] text-slate-400 hover:border-white/20 hover:text-slate-200"
                              }`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>

                        <div className="mt-4 space-y-4">
                          {contextTab === "customer" ? (
                            <>
                              <div className="rounded-[20px] border border-slate-800 bg-slate-900/70 p-4">
                                <div className="text-lg font-semibold text-white">Customer Information</div>
                                <div className="mt-4 space-y-4">
                                  {contextQuickCards.map((item) => (
                                    <div key={item.label}>
                                      <div className="text-xs uppercase tracking-[0.18em] text-slate-500">{item.label}</div>
                                      <div className="mt-1 text-sm text-white">{item.value}</div>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              <div className="rounded-[20px] border border-slate-800 bg-slate-900/70 p-4">
                                <div className="text-lg font-semibold text-white">Recent Activity</div>
                                <div className="mt-4 space-y-3">
                                  {timelineItems.slice(0, 3).length ? (
                                    timelineItems.slice(0, 3).map((item: any) => (
                                      <div key={item.id} className="rounded-2xl border border-slate-800 bg-slate-950/70 px-3 py-3">
                                        <div className="text-sm font-semibold text-white">{item.title}</div>
                                        <div className="mt-1 text-xs text-slate-400">
                                          {item.detail || "No extra detail"} · {formatDateTime(item.at)}
                                        </div>
                                      </div>
                                    ))
                                  ) : (
                                    <div className="rounded-2xl border border-dashed border-slate-800 px-3 py-6 text-sm text-slate-500">
                                      No previous interactions. This may be a new customer.
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div className="rounded-[20px] border border-slate-800 bg-slate-900/70 p-4">
                                <div className="text-lg font-semibold text-white">Quick Actions</div>
                                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                  <Link href={selectedCustomerLinks.customer} className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-center text-sm font-semibold text-cyan-100 transition hover:border-cyan-400">
                                    Open CRM
                                  </Link>
                                  <Link href={selectedCustomerLinks.quote} className="rounded-xl border border-fuchsia-500/30 bg-fuchsia-500/10 px-4 py-3 text-center text-sm font-semibold text-fuchsia-100 transition hover:border-fuchsia-400">
                                    Create Quote
                                  </Link>
                                  <Link href={selectedCustomerLinks.receipt} className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-center text-sm font-semibold text-emerald-100 transition hover:border-emerald-400">
                                    Create Receipt
                                  </Link>
                                  <button
                                    type="button"
                                    onClick={() => switchTab("followups")}
                                    className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-center text-sm font-semibold text-amber-100 transition hover:border-amber-400"
                                  >
                                    Create Follow-up
                                  </button>
                                </div>
                              </div>
                            </>
                          ) : null}

                          {contextTab === "timeline" ? (
                            <div className="space-y-3">
                              {timelineItems.length ? (
                                timelineItems.map((item: any) => (
                                  <div key={item.id} className="rounded-[20px] border border-slate-800 bg-slate-900/70 p-4">
                                    <div className="text-sm font-semibold text-white">{item.title}</div>
                                    <div className="mt-1 text-xs text-slate-400">
                                      {item.detail || "No extra detail"} · {formatDateTime(item.at)}
                                    </div>
                                  </div>
                                ))
                              ) : (
                                <div className="rounded-2xl border border-dashed border-slate-800 px-3 py-6 text-sm text-slate-500">
                                  No timeline entries yet.
                                </div>
                              )}
                            </div>
                          ) : null}

                          {contextTab === "agent" ? (
                            selectedAgent ? (
                              <div className="space-y-3">
                                <div className="rounded-[20px] border border-slate-800 bg-slate-900/70 p-4">
                                  <div className="text-lg font-semibold text-white">{(selectedAgent as any).displayName || selectedAgent.name}</div>
                                  <div className="mt-1 text-sm text-slate-400">{(selectedAgent as any).displayRoleLabel}</div>
                                  <div className="mt-4 flex flex-wrap gap-2">
                                    <span className={`inline-flex whitespace-nowrap rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${statusTone(selectedAgent.status)}`}>
                                      {selectedAgent.status}
                                    </span>
                                    <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-300">
                                      {(selectedAgent as any).isWebrtcRegistered ? "Browser Ready" : "Browser Offline"}
                                    </span>
                                  </div>
                                </div>
                                <div className="rounded-[20px] border border-slate-800 bg-slate-900/70 p-4 text-sm text-slate-300">
                                  <div>Active Calls: {selectedAgent.activeCallCount}</div>
                                  <div className="mt-2">Waiting Calls: {selectedAgent.waitingCallCount}</div>
                                  <div className="mt-2">Fallback: {(selectedAgent as any).phone || "No mobile fallback"}</div>
                                  <div className="mt-2">Last seen: {formatDateTime(selectedAgent.lastSeenAt)}</div>
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
                              <div className="space-y-3">
                                <audio controls preload="none" className="w-full" src={selectedCall.recordingUrl} />
                                <a
                                  href={selectedCall.recordingUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-100 transition hover:border-emerald-400"
                                >
                                  Download Recording
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
                  <section className="space-y-5">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Call History</div>
                        <h2 className="mt-1 text-3xl font-semibold text-white">Recent calls</h2>
                        <p className="mt-2 text-sm text-slate-400">
                          Review every voice interaction with drill-down actions and CRM-linked context.
                        </p>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[520px]">
                        <div className="rounded-[24px] border border-slate-800 bg-slate-900/70 p-4 sm:col-span-2">
                          <div className="grid gap-2 sm:grid-cols-4">
                            {([
                              ["today", "Today"],
                              ["yesterday", "Yesterday"],
                              ["week", "This Week"],
                              ["period", "Trading Period"],
                            ] as Array<[VoiceDateFilter, string]>).map(([key, label]) => (
                              <button
                                key={key}
                                type="button"
                                onClick={() => switchDateFilter(key)}
                                className={`rounded-full border px-4 py-2 text-left text-sm font-semibold transition ${
                                  dateFilter === key
                                    ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-100"
                                    : "border-white/10 bg-white/[0.02] text-slate-400 hover:border-white/20 hover:text-slate-200"
                                }`}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        </div>
                        <input
                          value={recentSearch}
                          onChange={(event) => setRecentSearch(event.target.value)}
                          placeholder="Search caller, route, or status"
                          className="w-full rounded-2xl border border-slate-800 bg-slate-900/75 px-3 py-3 text-sm text-white outline-none placeholder:text-slate-500"
                        />
                        <select
                          value={recentFilter}
                          onChange={(event) => setRecentFilter(event.target.value as typeof recentFilter)}
                          className="rounded-2xl border border-slate-800 bg-slate-900/75 px-3 py-3 text-sm text-white outline-none"
                        >
                          <option value="all">All directions</option>
                          <option value="INBOUND">Inbound only</option>
                          <option value="OUTBOUND">Outbound only</option>
                          <option value="with_recording">With recording</option>
                        </select>
                      </div>
                    </div>

                    <section className={cardShell("p-5")}>
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <div className="text-sm text-slate-400">{formatRefreshStamp(lastRefreshAt)}</div>
                        <button
                          type="button"
                          onClick={handleExportRecentCalls}
                          className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-100 transition hover:border-white/20"
                        >
                          Export
                        </button>
                      </div>
                      <div className="space-y-5">
                        {groupedRecentCalls.length ? (
                          groupedRecentCalls.map(([bucket, calls]) => (
                            <div key={bucket} className="space-y-3">
                              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">{bucket}</div>
                              <div className="overflow-x-auto">
                                <div className="min-w-[1080px] rounded-2xl border border-slate-800 bg-slate-900/60">
                                  <div className="grid grid-cols-[72px_110px_220px_100px_220px_110px_100px_110px_190px] gap-3 border-b border-slate-800 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                                    <div>View</div>
                                    <div>Time</div>
                                    <div>Caller</div>
                                    <div>Direction</div>
                                    <div>Agent</div>
                                    <div>Status</div>
                                    <div>Duration</div>
                                    <div>Cost</div>
                                    <div>Actions</div>
                                  </div>
                                  {calls.map((call) => {
                                    const isExpanded = expandedRecentCallId === call.id;
                                    const expandedDetail = isExpanded && selectedCallId === call.id ? data.selectedCallDetail : null;
                                    return (
                                      <div key={call.id} className="border-b border-slate-800/80 last:border-b-0">
                                        <div className="grid grid-cols-[72px_110px_220px_100px_220px_110px_100px_110px_190px] gap-3 px-4 py-4 transition hover:bg-white/[0.02]">
                                          <div className="flex items-center">
                                            <button
                                              type="button"
                                              onClick={() => handleToggleRecentCall(call.id, call.callerNumber)}
                                              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-slate-100 transition hover:border-cyan-400/40 hover:bg-cyan-500/10"
                                              aria-expanded={isExpanded}
                                              aria-label={isExpanded ? "Hide call details" : "Show call details"}
                                            >
                                              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                            </button>
                                          </div>
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
                                            <button
                                              type="button"
                                              onClick={() => handleToggleRecentCall(call.id, call.callerNumber)}
                                              className="inline-flex whitespace-nowrap rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-cyan-100 transition hover:border-cyan-400"
                                            >
                                              Review
                                            </button>
                                          </div>
                                        </div>

                                        {isExpanded ? (
                                          <div className="border-t border-slate-800 bg-slate-950/80 px-5 py-5">
                                            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
                                              <div className="space-y-4">
                                                <div className="flex flex-wrap items-start justify-between gap-3">
                                                  <div>
                                                    <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Call review</div>
                                                    <div className="mt-1 text-xl font-semibold text-white">{call.customer.customerName || call.callerNumber}</div>
                                                    <div className="mt-1 text-sm text-slate-400">
                                                      {call.callerNumber} · {call.direction} · {call.statusLabel}
                                                    </div>
                                                  </div>
                                                  <div className="flex flex-wrap gap-2">
                                                    <a
                                                      href={call.links.callBack}
                                                      className="inline-flex whitespace-nowrap rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-cyan-100 transition hover:border-cyan-400"
                                                    >
                                                      Call back
                                                    </a>
                                                    <a
                                                      href={`sms:${call.callerNumber}`}
                                                      className="inline-flex whitespace-nowrap rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-100 transition hover:border-white/20"
                                                    >
                                                      Send SMS
                                                    </a>
                                                    <Link
                                                      href={call.links.customer}
                                                      className="inline-flex whitespace-nowrap rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-100 transition hover:border-white/20"
                                                    >
                                                      Open customer
                                                    </Link>
                                                    <button
                                                      type="button"
                                                      onClick={() => {
                                                        handleSelectCall(call.id, call.callerNumber);
                                                        switchTab("operations");
                                                      }}
                                                      className="inline-flex whitespace-nowrap rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-emerald-100 transition hover:border-emerald-400"
                                                    >
                                                      Open live desk
                                                    </button>
                                                  </div>
                                                </div>

                                                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                                                  <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                                                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Who received</div>
                                                    <div className="mt-2 text-sm font-semibold text-white">{call.assignedToName || call.assignedToEmail || call.routedToDisplay || "Unassigned"}</div>
                                                    <div className="mt-1 text-xs text-slate-500">{call.routeType || "Direct route"}</div>
                                                  </div>
                                                  <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                                                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Orders</div>
                                                    <div className="mt-2 text-lg font-semibold text-white">{call.customer.linkedRecords.webOrders}</div>
                                                    <div className="mt-1 text-xs text-slate-500">Previous orders linked to caller</div>
                                                  </div>
                                                  <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                                                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Previous calls</div>
                                                    <div className="mt-2 text-lg font-semibold text-white">{call.customer.linkedRecords.recentCalls}</div>
                                                    <div className="mt-1 text-xs text-slate-500">CRM voice history</div>
                                                  </div>
                                                  <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                                                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Open quotes</div>
                                                    <div className="mt-2 text-lg font-semibold text-white">{call.customer.openQuotations}</div>
                                                    <div className="mt-1 text-xs text-slate-500">Quotations still pending</div>
                                                  </div>
                                                </div>

                                                <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                                                  <div className="flex items-center justify-between gap-3">
                                                    <div>
                                                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Customer activity</div>
                                                      <div className="mt-1 text-sm text-white">{call.linkedSummaryText}</div>
                                                    </div>
                                                    <div className="text-xs text-slate-500">{formatDateTime(call.startedAt || call.createdAt)}</div>
                                                  </div>
                                                  <div className="mt-4 space-y-3">
                                                    {(expandedDetail?.timeline?.length ? expandedDetail.timeline : call.customer.recentTimeline)
                                                      .slice(0, 5)
                                                      .map((item: any) => (
                                                        <div key={item.id} className="rounded-2xl border border-slate-800/80 bg-slate-950/70 px-3 py-3">
                                                          <div className="text-sm font-semibold text-white">{item.title}</div>
                                                          <div className="mt-1 text-xs text-slate-400">
                                                            {item.detail || "No extra detail"} · {formatDateTime(item.at)}
                                                          </div>
                                                        </div>
                                                      ))}
                                                  </div>
                                                </div>
                                              </div>

                                              <div className="space-y-4">
                                                <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                                                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Reassign</div>
                                                  <div className="mt-2 text-sm text-slate-300">Move this call to another agent for ownership and follow-up.</div>
                                                  <select
                                                    defaultValue={call.assignedToId || ""}
                                                    onChange={(event) => {
                                                      const assignedToId = event.target.value;
                                                      if (!assignedToId) return;
                                                      void handleReassign({ callId: call.id, assignedToId });
                                                    }}
                                                    className="mt-3 w-full rounded-2xl border border-slate-800 bg-slate-950/80 px-3 py-3 text-sm text-slate-100 outline-none"
                                                  >
                                                    <option value="">Select agent</option>
                                                    {visibleAgents.map((agent) => (
                                                      <option key={agent.id} value={agent.id}>
                                                        {(agent as any).displayName || agent.name}
                                                      </option>
                                                    ))}
                                                  </select>
                                                </div>

                                                <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                                                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Recording</div>
                                                  {call.recordingUrl ? (
                                                    <div className="mt-3 space-y-3">
                                                      <audio controls preload="none" className="w-full" src={call.recordingUrl} />
                                                      <a
                                                        href={call.recordingUrl}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="inline-flex whitespace-nowrap rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-emerald-100 transition hover:border-emerald-400"
                                                      >
                                                        Play / download
                                                      </a>
                                                    </div>
                                                  ) : (
                                                    <div className="mt-3 rounded-2xl border border-dashed border-slate-800 px-3 py-6 text-sm text-slate-500">
                                                      No recording attached to this call.
                                                    </div>
                                                  )}
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                        ) : null}
                                      </div>
                                    );
                                  })}
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
                        {filteredRecordings.length}
                      </span>
                    </div>
                    <div className="mt-4 grid gap-4 xl:grid-cols-2">
                      {filteredRecordings.length ? (
                        filteredRecordings.map((call) => (
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
                        {filteredFollowUps.length}
                      </span>
                    </div>
                    <div className="mt-4 space-y-3">
                      {filteredFollowUps.length ? (
                        filteredFollowUps.map((item) => (
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
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
