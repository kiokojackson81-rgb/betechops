"use client";

import {
  ChevronDown,
  ChevronUp,
  Delete,
  Headset,
  Mic,
  PauseCircle,
  Phone,
  RadioTower,
  RefreshCw,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import RegistrationBadge from "@/components/voice/RegistrationBadge";
import { useSoftphone } from "@/components/voice/SoftphoneProvider";

const SHOW_DEBUG_TOOLS = process.env.NODE_ENV !== "production";
const DIGITS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"];

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

export default function BrowserPhone() {
  const softphone = useSoftphone();
  const [showKeypad, setShowKeypad] = useState(false);
  const [showDevices, setShowDevices] = useState(false);
  const [showTestingTools, setShowTestingTools] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const isIncomingCall = Boolean(softphone.incomingCall);
  const hasCall = Boolean(softphone.currentCall);

  const statusTone = useMemo(() => {
    if (softphone.connectionStatus === "ready") return "bg-emerald-400";
    if (softphone.state === "REGISTERING" || softphone.state === "RINGING_INBOUND" || softphone.state === "RINGING_OUTBOUND") {
      return "bg-amber-400";
    }
    if (softphone.connectionStatus === "error" || softphone.availability === "BUSY" || softphone.availability === "TALKING") {
      return "bg-rose-400";
    }
    return "bg-slate-400";
  }, [softphone.availability, softphone.connectionStatus, softphone.state]);

  const readyLabel = useMemo(() => {
    if (softphone.connectionStatus === "error") return "Connection error";
    if (softphone.transportMode === "webrtc" && softphone.connectionStatus === "ready") return "WebRTC ready";
    if (softphone.transportMode === "webrtc") return "WebRTC connecting";
    if (softphone.transportMode === "mock") return "Mobile fallback";
    return "Offline";
  }, [softphone.connectionStatus, softphone.transportMode]);

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

  return (
    <div className={`fixed bottom-3 right-3 sm:bottom-6 sm:right-6 ${drawerOpen ? "z-[30]" : "z-[40]"}`}>
      <div className="relative flex flex-col items-end gap-3">
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
                  {readyLabel}
                </div>
                {softphone.currentCall ? (
                  <div className="mt-1 truncate text-xs text-slate-400">
                    {softphone.currentCall.displayName} · {softphone.currentCall.remoteIdentity}
                  </div>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <RegistrationBadge />
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
                  onClick={() => {
                    softphone.setAvailability("AVAILABLE");
                    void softphone.syncPresenceNow("AVAILABLE");
                  }}
                  disabled={softphone.availability === "AVAILABLE"}
                  className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm font-semibold text-emerald-100 transition hover:border-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Go Available
                </button>
                <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-slate-300">
                  {softphone.availabilityLabel}
                </span>
              </div>

              <div className="grid grid-cols-5 gap-2">
                <FloatingActionButton
                  label="Call"
                  icon={<Phone className="h-4.5 w-4.5" />}
                  onClick={() => softphone.startOutgoingCall()}
                  disabled={!softphone.dialedDigits}
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

              {showKeypad ? (
                <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Dial</div>
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

                  <button
                    type="button"
                    onClick={() => softphone.startOutgoingCall()}
                    disabled={!softphone.dialedDigits}
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-100 transition hover:border-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Phone className="h-4.5 w-4.5" />
                    Call
                  </button>
                </div>
              ) : null}

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
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-950/98 px-3 py-2 text-slate-100 shadow-[0_16px_40px_rgba(0,0,0,0.38)]">
            <span className="flex items-center gap-2">
              <span className="relative inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-900/90">
                <Headset className="h-4.5 w-4.5" />
                <span className={`absolute bottom-0.5 right-0.5 h-2.5 w-2.5 rounded-full border border-slate-950 ${statusTone}`} />
              </span>
              <span className="min-w-0">
                <span className="block text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Phone</span>
                <span className="block max-w-[132px] truncate text-sm font-semibold text-white">{readyLabel}</span>
              </span>
            </span>

            <div className="hidden items-center gap-2 sm:flex">
              <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] text-slate-300">
                {softphone.availabilityLabel}
              </span>
              <button
                type="button"
                onClick={() => {
                  softphone.setAvailability("AVAILABLE");
                  void softphone.syncPresenceNow("AVAILABLE");
                }}
                disabled={softphone.availability === "AVAILABLE"}
                className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-100 transition hover:border-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Go Available
              </button>
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
