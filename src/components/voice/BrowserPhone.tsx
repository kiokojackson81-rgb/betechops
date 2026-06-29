"use client";

import {
  ChevronDown,
  ChevronUp,
  Delete,
  Headset,
  LayoutDashboard,
  Mic,
  PauseCircle,
  Phone,
  PhoneOff,
  RadioTower,
  RefreshCw,
  X,
} from "lucide-react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSoftphone } from "@/components/voice/SoftphoneProvider";
import type { SoftphoneCall, SoftphoneState } from "@/lib/voiceSoftphone";

const SHOW_DEBUG_TOOLS = process.env.NODE_ENV !== "production";
const DIGITS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"];
const ALLOWED_ROLES = new Set(["ADMIN", "AGENT", "ATTENDANT", "SUPERVISOR"]);

type PhoneUiState = "idle" | "dialing" | "ringing" | "connected" | "ended" | "failed";
type CallFeedback = {
  number: string;
  label: string;
  status: string;
  tone: "slate" | "emerald" | "amber" | "rose";
};

function FloatingActionButton({
  label,
  icon,
  onClick,
  active = false,
  disabled = false,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-col items-center gap-1.5 rounded-xl border px-2 py-2 text-[11px] font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${
        active
          ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-100"
          : "border-white/10 bg-white/[0.03] text-slate-100 hover:border-white/20"
      }`}
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900/90">{icon}</span>
      <span>{label}</span>
    </button>
  );
}

function formatTimer(startedAt: string | null | undefined) {
  if (!startedAt) return "00:00";
  const elapsedMs = Math.max(0, Date.now() - new Date(startedAt).getTime());
  const totalSeconds = Math.floor(elapsedMs / 1000);
  const mins = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const secs = (totalSeconds % 60).toString().padStart(2, "0");
  return `${mins}:${secs}`;
}

function getEndedFeedback(previousCall: SoftphoneCall | null, nextState: SoftphoneState, fallbackNumber: string): CallFeedback {
  if (nextState === "ERROR") {
    return {
      number: fallbackNumber,
      label: previousCall?.displayName || "Last call",
      status: "Failed",
      tone: "rose",
    };
  }
  if (nextState === "DISCONNECTED") {
    return {
      number: fallbackNumber,
      label: previousCall?.displayName || "Last call",
      status: "Disconnected",
      tone: "rose",
    };
  }
  if (previousCall?.state === "RINGING_OUTBOUND") {
    return {
      number: fallbackNumber,
      label: previousCall.displayName || "Last call",
      status: "No answer",
      tone: "amber",
    };
  }
  return {
    number: fallbackNumber,
    label: previousCall?.displayName || "Last call",
    status: "Call ended",
    tone: "slate",
  };
}

export default function BrowserPhone() {
  const { data: session, status: sessionStatus } = useSession();
  const softphone = useSoftphone();
  const [showKeypad, setShowKeypad] = useState(false);
  const [showDevices, setShowDevices] = useState(false);
  const [showTestingTools, setShowTestingTools] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [online, setOnline] = useState(true);
  const [callFeedback, setCallFeedback] = useState<CallFeedback | null>(null);
  const [timerValue, setTimerValue] = useState("00:00");
  const previousCallRef = useRef<SoftphoneCall | null>(null);
  const clearFeedbackTimeoutRef = useRef<number | null>(null);
  const sessionUser = session?.user as { role?: string | null } | undefined;

  const isIncomingCall = Boolean(softphone.incomingCall);
  const hasCall = Boolean(softphone.currentCall);
  const hasAllowedRole = ALLOWED_ROLES.has(String(sessionUser?.role || "").toUpperCase());
  const canRenderPhone = sessionStatus === "authenticated" && hasAllowedRole;
  const isOffline = !online || softphone.transportMode === "unavailable";
  const canDial = !isOffline && softphone.connectionStatus !== "error";
  const activeCallNumber = softphone.currentCall?.remoteIdentity || callFeedback?.number || softphone.dialedDigits || "No active call";
  const voiceDashboardHref =
    String(sessionUser?.role || "").toUpperCase() === "ADMIN" || String(sessionUser?.role || "").toUpperCase() === "SUPERVISOR"
      ? "/admin/communications/voice"
      : "/attendant/voice";
  const isAvailableForCalls = !isOffline && softphone.availability !== "OFFLINE";
  const readinessLabel = isAvailableForCalls ? "Available" : "Offline";
  const readinessActionLabel = isAvailableForCalls ? "Go Offline" : "Go Available";

  const statusTone = useMemo(() => {
    if (isOffline) return "bg-slate-500";
    if (softphone.connectionStatus === "ready") return "bg-emerald-400";
    if (softphone.state === "REGISTERING" || softphone.state === "RINGING_INBOUND" || softphone.state === "RINGING_OUTBOUND") {
      return "bg-amber-400";
    }
    if (softphone.connectionStatus === "error" || softphone.availability === "BUSY" || softphone.availability === "TALKING") {
      return "bg-rose-400";
    }
    return "bg-slate-400";
  }, [isOffline, softphone.availability, softphone.connectionStatus, softphone.state]);

  const readyLabel = useMemo(() => {
    if (softphone.transportMode === "webrtc" && softphone.connectionStatus === "ready") return "WebRTC ready";
    if (softphone.transportMode === "webrtc") return "WebRTC connecting";
    if (softphone.transportMode === "mock") return "Mobile fallback";
    if (softphone.connectionStatus === "error") return "Connection error";
    return "Offline";
  }, [softphone.connectionStatus, softphone.transportMode]);

  const uiState = useMemo<PhoneUiState>(() => {
    if (softphone.currentCall?.state === "RINGING_OUTBOUND") return "dialing";
    if (softphone.currentCall?.state === "RINGING_INBOUND") return "ringing";
    if (softphone.currentCall?.state === "TALKING" || softphone.currentCall?.state === "ON_HOLD") return "connected";
    if (callFeedback) {
      return callFeedback.status === "Failed" || callFeedback.status === "Disconnected" ? "failed" : "ended";
    }
    return "idle";
  }, [callFeedback, softphone.currentCall?.state]);

  const activeStatusLabel = useMemo(() => {
    if (uiState === "dialing") return "Calling...";
    if (uiState === "ringing") return "Incoming call";
    if (uiState === "connected") return softphone.currentCall?.held ? "On hold" : "Connected";
    if (uiState === "failed" || uiState === "ended") return callFeedback?.status || "Call ended";
    return readyLabel;
  }, [callFeedback?.status, readyLabel, softphone.currentCall?.held, uiState]);

  const feedbackToneClass = callFeedback?.tone === "rose"
    ? "border-rose-500/30 bg-rose-500/10 text-rose-100"
    : callFeedback?.tone === "amber"
      ? "border-amber-500/30 bg-amber-500/10 text-amber-100"
      : callFeedback?.tone === "emerald"
        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
        : "border-white/10 bg-white/[0.03] text-slate-200";

  useEffect(() => {
    setOnline(typeof navigator === "undefined" ? true : navigator.onLine);
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    const handleDrawerState = (event: Event) => {
      const detail = (event as CustomEvent<{ open?: boolean }>).detail;
      const isOpen = Boolean(detail?.open);
      setDrawerOpen(isOpen);
      if (isOpen) {
        softphone.setCollapsed(true);
      }
    };

    window.addEventListener("voice-console-drawer", handleDrawerState as EventListener);
    return () => {
      window.removeEventListener("voice-console-drawer", handleDrawerState as EventListener);
    };
  }, [softphone]);

  useEffect(() => {
    if (isIncomingCall) {
      softphone.setCollapsed(false);
    }
  }, [isIncomingCall, softphone]);

  useEffect(() => {
    if (softphone.currentCall) {
      softphone.setCollapsed(false);
    }
  }, [softphone, softphone.currentCall]);

  useEffect(() => {
    if (!softphone.currentCall?.startedAt || (softphone.currentCall.state !== "TALKING" && softphone.currentCall.state !== "ON_HOLD")) {
      setTimerValue("00:00");
      return;
    }

    setTimerValue(formatTimer(softphone.currentCall.startedAt));
    const interval = window.setInterval(() => {
      setTimerValue(formatTimer(softphone.currentCall?.startedAt));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [softphone.currentCall?.startedAt, softphone.currentCall?.state]);

  useEffect(() => {
    const currentCall = softphone.currentCall;
    const previousCall = previousCallRef.current;

    if (clearFeedbackTimeoutRef.current) {
      window.clearTimeout(clearFeedbackTimeoutRef.current);
      clearFeedbackTimeoutRef.current = null;
    }

    if (currentCall) {
      setCallFeedback(null);
      previousCallRef.current = currentCall;
      return;
    }

    if (previousCall) {
      const feedback = getEndedFeedback(previousCall, softphone.state, previousCall.remoteIdentity || "Unknown number");
      setCallFeedback(feedback);
      previousCallRef.current = null;
      clearFeedbackTimeoutRef.current = window.setTimeout(() => {
        setCallFeedback(null);
        clearFeedbackTimeoutRef.current = null;
      }, 3200);
    } else if (softphone.state === "ERROR") {
      setCallFeedback({
        number: activeCallNumber,
        label: "Last call",
        status: "Failed",
        tone: "rose",
      });
      clearFeedbackTimeoutRef.current = window.setTimeout(() => {
        setCallFeedback(null);
        clearFeedbackTimeoutRef.current = null;
      }, 3200);
    }
  }, [activeCallNumber, softphone.currentCall, softphone.state]);

  useEffect(() => {
    if (softphone.currentCall) {
      setShowKeypad(false);
    }
  }, [softphone.currentCall?.id]);

  useEffect(() => {
    return () => {
      if (clearFeedbackTimeoutRef.current) {
        window.clearTimeout(clearFeedbackTimeoutRef.current);
      }
    };
  }, []);

  if (!canRenderPhone) {
    return null;
  }

  const handleStartCall = () => {
    if (!canDial) return;
    softphone.setCollapsed(false);
    softphone.startOutgoingCall();
    setShowKeypad(false);
    setShowDevices(false);
  };

  const handleToggleAvailability = () => {
    if (!online) return;
    const nextAvailability = isAvailableForCalls ? "OFFLINE" : "AVAILABLE";
    softphone.setAvailability(nextAvailability);
    void softphone.syncPresenceNow(nextAvailability);
  };

  const keypadPanel = (
    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Dial pad</div>
          <div className="mt-1 truncate text-xl font-semibold tracking-[0.14em] text-white">
            {softphone.dialedDigits || "Enter number"}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={softphone.backspaceDigit}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-800 bg-slate-950/80 text-slate-100 transition hover:border-slate-600"
            aria-label="Backspace"
          >
            <Delete className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setShowKeypad(false)}
            className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] font-semibold text-slate-300 transition hover:border-white/20 hover:text-white"
          >
            Hide keypad
          </button>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        {DIGITS.map((digit) => (
          <button
            key={digit}
            type="button"
            onClick={() => {
              softphone.appendDigit(digit);
              if (softphone.currentCall) softphone.sendDtmf(digit);
            }}
            className="flex h-14 items-center justify-center rounded-xl border border-slate-800 bg-slate-950/80 px-3 text-base font-semibold text-white transition hover:border-cyan-400/40 hover:bg-cyan-500/10"
          >
            {digit}
          </button>
        ))}
      </div>

      {!softphone.currentCall ? (
        <button
          type="button"
          onClick={handleStartCall}
          disabled={!softphone.dialedDigits || !canDial}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-100 transition hover:border-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Phone className="h-4.5 w-4.5" />
          Call
        </button>
      ) : null}
    </div>
  );

  return (
    <div
      className={`pointer-events-none fixed bottom-3 right-3 sm:bottom-6 sm:right-6 ${drawerOpen ? "z-[30]" : "z-[40]"}`}
      aria-hidden={false}
    >
      <div className="pointer-events-auto relative flex flex-col items-end gap-3">
      {!softphone.isCollapsed ? (
          <div className="max-h-[calc(100vh-80px)] w-[calc(100vw-24px)] max-w-[420px] overflow-y-auto overflow-x-hidden rounded-[24px] border border-slate-800/90 bg-slate-950/98 shadow-[0_18px_54px_rgba(0,0,0,0.42)] sm:max-h-[calc(100vh-120px)] sm:w-[min(420px,calc(100vw-32px))]">
            <div className="flex items-start justify-between gap-3 border-b border-slate-800 px-4 py-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-300">
                  <Phone className="h-4 w-4" />
                  Phone
                </div>
                <div className="mt-2 flex items-center gap-2 text-sm font-semibold text-white">
                  <span className={`h-2.5 w-2.5 rounded-full ${statusTone}`} />
                  {readinessLabel}
                </div>
                {softphone.currentCall ? (
                  <div className="mt-1 truncate text-xs text-slate-400">
                    {softphone.currentCall.displayName} · {softphone.currentCall.remoteIdentity}
                  </div>
                ) : (
                  <div className="mt-1 truncate text-xs text-slate-400">{readyLabel}</div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href={voiceDashboardHref}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-800 bg-slate-900/80 text-slate-100 transition hover:border-slate-700"
                  aria-label="Open voice dashboard"
                >
                  <LayoutDashboard className="h-4 w-4" />
                </Link>
                <button
                  type="button"
                  onClick={() => softphone.setCollapsed(true)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-800 bg-slate-900/80 text-slate-100 transition hover:border-slate-700"
                  aria-label="Collapse softphone"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="space-y-4 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleToggleAvailability}
                  disabled={!online}
                  className={`inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                    isAvailableForCalls
                      ? "border-rose-500/30 bg-rose-500/10 text-rose-100 hover:border-rose-400"
                      : "border-emerald-500/30 bg-emerald-500/10 text-emerald-100 hover:border-emerald-400"
                  }`}
                >
                  {readinessActionLabel}
                </button>
                <span
                  className={`rounded-full border px-3 py-2 text-xs ${
                    isAvailableForCalls
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
                      : "border-rose-500/30 bg-rose-500/10 text-rose-100"
                  }`}
                >
                  {readinessLabel}
                </span>
              </div>

              {uiState === "idle" ? (
                <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
                  <div className="text-xs font-medium text-slate-400">Phone ready</div>
                  <div className="mt-2 text-sm text-slate-300">
                    Open the keypad to enter a number, then place a call.
                  </div>
                </div>
              ) : null}

              {uiState !== "idle" ? (
                <div className={`rounded-xl border p-4 ${callFeedback ? feedbackToneClass : "border-slate-800 bg-slate-900/70"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                        <Phone className="h-4 w-4" />
                        {uiState === "connected" ? "Active call" : "Call status"}
                      </div>
                      <div className="mt-2 truncate text-xl font-semibold text-white">{activeCallNumber}</div>
                      <div className="mt-1 text-sm text-slate-300">{activeStatusLabel}</div>
                    </div>
                    <div className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-sm font-semibold text-white">
                      {uiState === "connected" ? timerValue : uiState === "dialing" ? "Calling..." : activeStatusLabel}
                    </div>
                  </div>

                  {softphone.currentCall ? (
                    <div className="mt-4 grid grid-cols-4 gap-2">
                      <FloatingActionButton
                        label="End"
                        icon={<PhoneOff className="h-4.5 w-4.5" />}
                        onClick={softphone.hangUp}
                        active
                      />
                      <FloatingActionButton
                        label={softphone.currentCall?.muted ? "Unmute" : "Mute"}
                        icon={<Mic className="h-4.5 w-4.5" />}
                        onClick={softphone.toggleMute}
                        active={Boolean(softphone.currentCall?.muted)}
                      />
                      <FloatingActionButton
                        label={softphone.currentCall?.held ? "Resume" : "Hold"}
                        icon={<PauseCircle className="h-4.5 w-4.5" />}
                        onClick={softphone.toggleHold}
                        active={Boolean(softphone.currentCall?.held)}
                      />
                      <FloatingActionButton
                        label={showKeypad ? "Hide" : "Keypad"}
                        icon={<Headset className="h-4.5 w-4.5" />}
                        onClick={() => setShowKeypad((current) => !current)}
                        active={showKeypad}
                      />
                    </div>
                  ) : null}
                </div>
              ) : null}

              {uiState === "idle" ? (
                <div className="grid grid-cols-5 gap-2">
                  <FloatingActionButton
                    label="Call"
                    icon={<Phone className="h-4.5 w-4.5" />}
                    onClick={handleStartCall}
                    disabled={!softphone.dialedDigits || !canDial}
                  />
                  <FloatingActionButton
                    label={softphone.currentCall?.muted ? "Unmute" : "Mute"}
                    icon={<Mic className="h-4.5 w-4.5" />}
                    onClick={softphone.toggleMute}
                    active={Boolean(softphone.currentCall?.muted)}
                    disabled={!hasCall}
                  />
                  <FloatingActionButton
                    label={softphone.currentCall?.held ? "Resume" : "Hold"}
                    icon={<PauseCircle className="h-4.5 w-4.5" />}
                    onClick={softphone.toggleHold}
                    active={Boolean(softphone.currentCall?.held)}
                    disabled={!hasCall}
                  />
                  <FloatingActionButton
                    label={showKeypad ? "Hide" : "Keypad"}
                    icon={<Headset className="h-4.5 w-4.5" />}
                    onClick={() => setShowKeypad((current) => !current)}
                    active={showKeypad}
                  />
                  <FloatingActionButton
                    label="Devices"
                    icon={<RadioTower className="h-4.5 w-4.5" />}
                    onClick={() => setShowDevices((current) => !current)}
                    active={showDevices}
                  />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <FloatingActionButton
                    label="Devices"
                    icon={<RadioTower className="h-4.5 w-4.5" />}
                    onClick={() => setShowDevices((current) => !current)}
                    active={showDevices}
                  />
                  {!softphone.currentCall ? (
                    <FloatingActionButton
                      label="Close"
                      icon={<X className="h-4.5 w-4.5" />}
                      onClick={() => {
                        setCallFeedback(null);
                        softphone.setCollapsed(true);
                      }}
                    />
                  ) : null}
                </div>
              )}

              {showKeypad ? keypadPanel : null}

              {showDevices ? (
                <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-medium text-slate-400">Devices</div>
                      <div className="mt-1 text-sm text-white">
                        Mic {softphone.microphonePermission} · {softphone.devices.microphones.length} in · {softphone.devices.speakers.length} out
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void softphone.refreshDevices()}
                      className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-950/80 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-200 transition hover:border-slate-700"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Refresh
                    </button>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void softphone.runMicrophoneTest()}
                      className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold text-slate-100 transition hover:border-white/20"
                    >
                      Test Mic
                    </button>
                    <button
                      type="button"
                      onClick={() => void softphone.runSpeakerTest()}
                      className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold text-slate-100 transition hover:border-white/20"
                    >
                      Test Speaker
                    </button>
                  </div>
                </div>
              ) : null}

              {SHOW_DEBUG_TOOLS ? (
                <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
                  <button
                    type="button"
                    onClick={() => setShowTestingTools((value) => !value)}
                    className="flex w-full items-center justify-between gap-3 text-left"
                  >
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Testing tools</div>
                      <div className="mt-1 text-sm text-white">Development-only call-state controls.</div>
                    </div>
                    <ChevronDown className={`h-4 w-4 text-slate-300 transition ${showTestingTools ? "rotate-180" : ""}`} />
                  </button>
                  {showTestingTools ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {[
                        ["Incoming", "incoming"],
                        ["Answered", "answered"],
                        ["Reject", "rejected"],
                        ["End", "ended"],
                        ["Hold", "hold"],
                        ["Resume", "resume"],
                        ["Disconnect", "disconnect"],
                        ["Reconnect", "reconnect"],
                        ["Transfer", "transfer"],
                      ].map(([label, event]) => (
                        <button
                          key={event}
                          type="button"
                          onClick={() => softphone.triggerMockEvent(event as Parameters<typeof softphone.triggerMockEvent>[0])}
                          className="rounded-full border border-slate-800 bg-slate-950/80 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-200 transition hover:border-slate-700"
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="flex items-center justify-end">
          <div className="inline-flex max-w-[calc(100vw-24px)] items-center gap-2 rounded-full border border-slate-800 bg-slate-950/98 px-3 py-2 text-slate-100 shadow-[0_16px_40px_rgba(0,0,0,0.38)]">
            <span className="flex items-center gap-2">
              <span className="relative inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-900/90">
                <Headset className="h-4.5 w-4.5" />
                <span className={`absolute bottom-0.5 right-0.5 h-2.5 w-2.5 rounded-full border border-slate-950 ${statusTone}`} />
              </span>
              <span className="min-w-0">
                <span className="block text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Phone</span>
                <span className="block max-w-[132px] truncate text-sm font-semibold text-white">{uiState === "connected" ? timerValue : readinessLabel}</span>
              </span>
            </span>

            <div className="hidden items-center gap-2 sm:flex">
              <span
                className={`rounded-full border px-2.5 py-1 text-[11px] ${
                  isAvailableForCalls
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
                    : "border-rose-500/30 bg-rose-500/10 text-rose-100"
                }`}
              >
                {readinessLabel}
              </span>
              <button
                type="button"
                onClick={handleToggleAvailability}
                disabled={!online}
                className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                  isAvailableForCalls
                    ? "border-rose-500/30 bg-rose-500/10 text-rose-100 hover:border-rose-400"
                    : "border-emerald-500/30 bg-emerald-500/10 text-emerald-100 hover:border-emerald-400"
                }`}
              >
                {readinessActionLabel}
              </button>
              <Link
                href={voiceDashboardHref}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-slate-100 transition hover:border-white/20"
                aria-label="Open voice dashboard"
              >
                <LayoutDashboard className="h-4 w-4" />
              </Link>
            </div>

            <button
              type="button"
              onClick={() => softphone.setCollapsed(!softphone.isCollapsed)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-slate-100 transition hover:border-white/20"
              aria-label={softphone.isCollapsed ? "Open browser softphone" : "Minimize browser softphone"}
            >
              {softphone.isCollapsed ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
