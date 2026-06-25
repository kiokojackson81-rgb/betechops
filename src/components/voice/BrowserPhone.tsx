"use client";

import { ChevronDown, ChevronUp, Headset, Phone, RefreshCw, RadioTower, Settings2, TestTube2, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import CallControls from "@/components/voice/CallControls";
import CallStatusBar from "@/components/voice/CallStatusBar";
import DialPad from "@/components/voice/DialPad";
import RegistrationBadge from "@/components/voice/RegistrationBadge";
import { useSoftphone } from "@/components/voice/SoftphoneProvider";

function MockEventButton({
  label,
  event,
}: {
  label: string;
  event: Parameters<ReturnType<typeof useSoftphone>["triggerMockEvent"]>[0];
}) {
  const softphone = useSoftphone();
  return (
    <button
      type="button"
      onClick={() => softphone.triggerMockEvent(event)}
      className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-200 transition hover:border-white/20"
    >
      {label}
    </button>
  );
}

export default function BrowserPhone() {
  const softphone = useSoftphone();
  const pathname = usePathname();
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
    <div className={`fixed bottom-4 right-4 ${drawerOpen ? "z-[50]" : "z-[80]"}`}>
      <div className="relative flex flex-col items-end gap-3">
        {!softphone.isCollapsed ? (
          <div className="max-h-[70vh] w-[min(calc(100vw-24px),360px)] overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.97),rgba(2,6,23,0.98))] shadow-[0_24px_70px_rgba(0,0,0,0.45)]">
            <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
              <div className="min-w-0">
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Browser Phone</div>
                <div className="mt-1 truncate text-sm font-semibold text-white">
                  {softphone.currentCall ? `${softphone.currentCall.displayName} · ${softphone.currentCall.remoteIdentity}` : "Operator console"}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <RegistrationBadge />
                <button
                  type="button"
                  onClick={() => softphone.setCollapsed(true)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-slate-100 transition hover:border-white/20"
                  aria-label="Collapse softphone"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="max-h-[calc(70vh-72px)] space-y-4 overflow-y-auto p-4">
            <CallStatusBar />
            <div className="rounded-[22px] border border-white/10 bg-white/[0.03] px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Presence</div>
                  <div className="mt-1 text-sm font-semibold text-white">{softphone.availabilityLabel}</div>
                  <div className="mt-1 text-xs text-slate-400">
                    Last heartbeat{" "}
                    {softphone.lastHeartbeatAt
                      ? new Date(softphone.lastHeartbeatAt).toLocaleTimeString("en-KE", {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                          hour12: false,
                          timeZone: "Africa/Nairobi",
                        })
                      : "pending"}
                  </div>
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
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-100 transition hover:border-white/20"
              >
                <Phone className="h-4 w-4" />
                {showDialPad ? "Hide keypad" : "Keypad"}
              </button>
            </div>
            {showDialPad ? <DialPad compact /> : null}

            <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Connection + devices</div>
                  <div className="mt-1 text-sm text-white">
                    Mic {softphone.microphonePermission} · Heartbeat {softphone.lastHeartbeatAt ? "live" : "pending"} · Mode {softphone.transportMode}
                  </div>
                  {softphone.statusMessage ? (
                    <div className="mt-2 text-xs text-amber-200">{softphone.statusMessage}</div>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void softphone.refreshDevices()}
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-200 transition hover:border-white/20"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Refresh
                  </button>
                  <button
                    type="button"
                    onClick={() => void softphone.runMicrophoneTest()}
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-200 transition hover:border-white/20"
                  >
                    <TestTube2 className="h-3.5 w-3.5" />
                    Mic test
                  </button>
                  <button
                    type="button"
                    onClick={() => void softphone.runSpeakerTest()}
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-200 transition hover:border-white/20"
                  >
                    <RadioTower className="h-3.5 w-3.5" />
                    Speaker
                  </button>
                </div>
              </div>
              <div className="mt-3 grid gap-2 text-xs text-slate-400 sm:grid-cols-2">
                <div>Microphones: {softphone.devices.microphones.length}</div>
                <div>Speakers: {softphone.devices.speakers.length}</div>
                <div>Ring volume: {softphone.preferences.ringVolume}%</div>
                <div>Output volume: {softphone.preferences.outputVolume}%</div>
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

            {softphone.transportMode === "mock" ? (
              <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
                <button
                  type="button"
                  onClick={() => setShowTestingTools((value) => !value)}
                  className="flex w-full items-center justify-between gap-3 text-left"
                >
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Testing tools</div>
                    <div className="mt-1 text-sm text-white">Mock event harness for development and QA.</div>
                  </div>
                  {showTestingTools ? <ChevronUp className="h-4 w-4 text-slate-300" /> : <ChevronDown className="h-4 w-4 text-slate-300" />}
                </button>
                {showTestingTools ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <MockEventButton label="Incoming" event="incoming" />
                    <MockEventButton label="Answered" event="answered" />
                    <MockEventButton label="Reject" event="rejected" />
                    <MockEventButton label="End" event="ended" />
                    <MockEventButton label="Hold" event="hold" />
                    <MockEventButton label="Resume" event="resume" />
                    <MockEventButton label="Disconnect" event="disconnect" />
                    <MockEventButton label="Reconnect" event="reconnect" />
                    <MockEventButton label="Transfer" event="transfer" />
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">WebRTC control plane</div>
                <div className="mt-1 text-sm text-white">
                  {softphone.transportMode === "webrtc"
                    ? "Africa's Talking WebRTC is active through the adapter layer."
                    : "WebRTC is enabled but not currently available."}
                </div>
              </div>
            )}

            {pathname !== "/admin/communications/voice/settings" ? (
              <div className="text-[11px] text-slate-500">
                Settings, SIP configuration placeholders, and device testing live under <code>/admin/communications/voice/settings</code>.
              </div>
            ) : null}
          </div>
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => softphone.setCollapsed(!softphone.isCollapsed)}
          className="group inline-flex h-14 items-center gap-3 rounded-full border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.97),rgba(2,6,23,0.98))] px-4 text-slate-100 shadow-[0_16px_48px_rgba(0,0,0,0.4)] transition hover:border-white/20"
          aria-label={softphone.isCollapsed ? "Open browser softphone" : "Minimize browser softphone"}
        >
          <span className="relative inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.06]">
            {softphone.isCollapsed ? <Headset className="h-5 w-5" /> : <X className="h-4.5 w-4.5" />}
            <span className={`absolute bottom-0.5 right-0.5 h-2.5 w-2.5 rounded-full border border-slate-950 ${statusTone}`} />
          </span>
          <span className="hidden min-w-0 text-left sm:block">
            <span className="block text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Phone</span>
            <span className="block max-w-[140px] truncate text-sm font-semibold text-white">
              {softphone.currentCall ? softphone.currentCall.displayName : softphone.stateLabel}
            </span>
          </span>
        </button>
      </div>
    </div>
  );
}
