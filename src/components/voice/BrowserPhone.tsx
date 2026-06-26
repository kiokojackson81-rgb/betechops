"use client";

import { ChevronDown, Headset, Phone, RefreshCw, RadioTower, Settings2, TestTube2, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import CallControls from "@/components/voice/CallControls";
import CallStatusBar from "@/components/voice/CallStatusBar";
import DialPad from "@/components/voice/DialPad";
import RegistrationBadge from "@/components/voice/RegistrationBadge";
import { useSoftphone } from "@/components/voice/SoftphoneProvider";

const SHOW_DEBUG_TOOLS = process.env.NODE_ENV !== "production";

export default function BrowserPhone() {
  const softphone = useSoftphone();
  const [showDialPad, setShowDialPad] = useState(false);
  const [showTestingTools, setShowTestingTools] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

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

  const widgetStatusLabel = useMemo(() => {
    if (softphone.connectionStatus === "error") return "Error";
    if (softphone.transportMode === "webrtc" && softphone.connectionStatus === "ready") return "WebRTC ready";
    if (softphone.availability === "TALKING") return "On call";
    if (softphone.availability === "AVAILABLE") return "Available";
    if (softphone.transportMode === "unavailable") return "Offline";
    if (softphone.transportMode === "mock") return "Mobile fallback active";
    return softphone.availabilityLabel;
  }, [softphone.availability, softphone.availabilityLabel, softphone.connectionStatus, softphone.transportMode]);

  const connectionSummary = useMemo(() => {
    if (softphone.transportMode === "webrtc" && softphone.connectionStatus === "ready") {
      return "WebRTC ready";
    }
    if (softphone.transportMode === "webrtc") {
      return "WebRTC connecting";
    }
    if (softphone.transportMode === "mock") {
      return "Mobile fallback active";
    }
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

  return (
    <div className={`fixed bottom-4 right-4 ${drawerOpen ? "z-[30]" : "z-[40]"}`}>
      <div className="relative flex flex-col items-end gap-3">
        {!softphone.isCollapsed ? (
          <div className="max-h-[70vh] w-[min(calc(100vw-24px),320px)] overflow-hidden rounded-[24px] border border-slate-800/90 bg-slate-950/98 shadow-[0_18px_54px_rgba(0,0,0,0.42)]">
            <div className="flex items-center justify-between gap-3 border-b border-slate-800 px-4 py-3">
              <div className="min-w-0">
                <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">Browser Phone</div>
                <div className="mt-1 truncate text-sm font-semibold text-white">
                  {softphone.currentCall ? `${softphone.currentCall.displayName} · ${softphone.currentCall.remoteIdentity}` : "Operator console"}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <RegistrationBadge />
                <button
                  type="button"
                  onClick={() => softphone.setCollapsed(true)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-slate-800 bg-slate-900/80 text-slate-100 transition hover:border-slate-700"
                  aria-label="Collapse softphone"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="max-h-[calc(70vh-66px)] space-y-3 overflow-y-auto p-4">
            <CallStatusBar />
            <div className="rounded-[20px] border border-slate-800 bg-slate-900/70 px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Presence</div>
                  <div className="mt-1 text-sm font-semibold text-white">{softphone.availabilityLabel}</div>
                  <div className="mt-1 text-xs text-slate-400">{connectionSummary}</div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    softphone.setAvailability("AVAILABLE");
                    void softphone.syncPresenceNow("AVAILABLE");
                  }}
                  disabled={softphone.availability === "AVAILABLE"}
                  className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-100 transition hover:border-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Go Available
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <CallControls />
              <button
                type="button"
                onClick={() => setShowDialPad((value) => !value)}
                className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/80 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-100 transition hover:border-slate-700"
              >
                <Phone className="h-4 w-4" />
                {showDialPad ? "Hide keypad" : "Keypad"}
              </button>
            </div>
            {showDialPad ? <DialPad compact /> : null}

            <div className="rounded-[20px] border border-slate-800 bg-slate-900/70 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Devices</div>
                  <div className="mt-1 text-sm text-white">
                    Mic {softphone.microphonePermission} · {softphone.devices.microphones.length} in · {softphone.devices.speakers.length} out
                  </div>
                  {softphone.statusMessage ? (
                    <div className="mt-2 text-xs text-amber-200">{softphone.statusMessage}</div>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void softphone.refreshDevices()}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-950/80 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-200 transition hover:border-slate-700"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Sync
                  </button>
                  <button
                    type="button"
                    onClick={() => void softphone.runMicrophoneTest()}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-950/80 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-200 transition hover:border-slate-700"
                  >
                    <TestTube2 className="h-3.5 w-3.5" />
                    Mic
                  </button>
                  <button
                    type="button"
                    onClick={() => void softphone.runSpeakerTest()}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-950/80 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-200 transition hover:border-slate-700"
                  >
                    <RadioTower className="h-3.5 w-3.5" />
                    Speaker
                  </button>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-400">
                <span>Ring {softphone.preferences.ringVolume}%</span>
                <span>Output {softphone.preferences.outputVolume}%</span>
              </div>
              <div className="mt-3">
                <Link
                  href="/admin/communications/voice/settings"
                  className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-100 transition hover:border-cyan-400"
                >
                  <Settings2 className="h-3.5 w-3.5" />
                  Settings
                </Link>
              </div>
            </div>

            {SHOW_DEBUG_TOOLS ? (
              <div className="rounded-[20px] border border-slate-800 bg-slate-900/70 p-4">
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
            ) : (
              <div className="rounded-[20px] border border-slate-800 bg-slate-900/70 px-4 py-3 text-xs text-slate-400">
                {softphone.transportMode === "webrtc"
                  ? "Browser calling connected through Africa's Talking WebRTC."
                  : "Mobile fallback remains active while browser calling is unavailable."}
              </div>
            )}
          </div>
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => softphone.setCollapsed(!softphone.isCollapsed)}
          className="group inline-flex h-12 items-center gap-3 rounded-full border border-slate-800 bg-slate-950/98 px-3.5 text-slate-100 shadow-[0_16px_40px_rgba(0,0,0,0.38)] transition hover:border-slate-700"
          aria-label={softphone.isCollapsed ? "Open browser softphone" : "Minimize browser softphone"}
        >
          <span className="relative inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-900/90">
            {softphone.isCollapsed ? <Headset className="h-5 w-5" /> : <X className="h-4.5 w-4.5" />}
            <span className={`absolute bottom-0.5 right-0.5 h-2.5 w-2.5 rounded-full border border-slate-950 ${statusTone}`} />
          </span>
          <span className="hidden min-w-0 text-left sm:block">
            <span className="block text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Phone</span>
            <span className="block max-w-[140px] truncate text-sm font-semibold text-white">
              {softphone.currentCall ? softphone.currentCall.displayName : widgetStatusLabel}
            </span>
          </span>
        </button>
      </div>
    </div>
  );
}
