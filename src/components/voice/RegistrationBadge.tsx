"use client";

import { useSoftphone } from "@/components/voice/SoftphoneProvider";

const STATUS_TONE: Record<string, string> = {
  idle: "border-white/10 bg-white/[0.05] text-slate-200",
  ready: "border-emerald-500/30 bg-emerald-500/10 text-emerald-100",
  warning: "border-amber-500/30 bg-amber-500/10 text-amber-100",
  error: "border-rose-500/30 bg-rose-500/10 text-rose-100",
};

export default function RegistrationBadge() {
  const softphone = useSoftphone();
  const registrationLabel =
    softphone.registrationStatus === "registered"
      ? "Phone ready"
      : softphone.registrationStatus === "registering"
        ? "Connecting"
        : softphone.registrationStatus === "error"
          ? "Phone error"
          : "Offline";

  return (
    <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] ${STATUS_TONE[softphone.connectionStatus]}`}>
      <span className="inline-flex h-2.5 w-2.5 rounded-full bg-current opacity-90" />
      <span>{registrationLabel}</span>
    </div>
  );
}
