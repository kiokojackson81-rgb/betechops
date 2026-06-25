"use client";

import { Phone, PhoneCall, PhoneOff, Mic, MicOff, PauseCircle, PlayCircle } from "lucide-react";
import { useSoftphone } from "@/components/voice/SoftphoneProvider";

function ControlButton({
  onClick,
  label,
  active = false,
  danger = false,
  disabled = false,
  children,
}: {
  onClick: () => void;
  label: string;
  active?: boolean;
  danger?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] transition disabled:cursor-not-allowed disabled:opacity-40 ${
        danger
          ? "border-rose-500/30 bg-rose-500/10 text-rose-100 hover:border-rose-400"
          : active
            ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-100 hover:border-cyan-400"
            : "border-white/10 bg-white/[0.04] text-slate-100 hover:border-white/20"
      }`}
      aria-label={label}
    >
      {children}
      <span>{label}</span>
    </button>
  );
}

export default function CallControls() {
  const softphone = useSoftphone();
  const hasCall = Boolean(softphone.currentCall);
  const inboundRinging = softphone.currentCall?.state === "RINGING_INBOUND";

  return (
    <div className="flex flex-wrap gap-2">
      {inboundRinging ? (
        <>
          <ControlButton onClick={softphone.answerCall} label="Answer" active>
            <PhoneCall className="h-4 w-4" />
          </ControlButton>
          <ControlButton onClick={softphone.rejectCall} label="Decline" danger>
            <PhoneOff className="h-4 w-4" />
          </ControlButton>
        </>
      ) : null}

      {!hasCall ? (
        <ControlButton onClick={() => softphone.startOutgoingCall()} label="Call" active={Boolean(softphone.dialedDigits)}>
          <Phone className="h-4 w-4" />
        </ControlButton>
      ) : (
        <ControlButton onClick={softphone.hangUp} label="Hang up" danger>
          <PhoneOff className="h-4 w-4" />
        </ControlButton>
      )}

      <ControlButton onClick={softphone.toggleMute} label={softphone.currentCall?.muted ? "Unmute" : "Mute"} disabled={!hasCall} active={Boolean(softphone.currentCall?.muted)}>
        {softphone.currentCall?.muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
      </ControlButton>

      <ControlButton onClick={softphone.toggleHold} label={softphone.currentCall?.held ? "Resume" : "Hold"} disabled={!hasCall} active={Boolean(softphone.currentCall?.held)}>
        {softphone.currentCall?.held ? <PlayCircle className="h-4 w-4" /> : <PauseCircle className="h-4 w-4" />}
      </ControlButton>
    </div>
  );
}
