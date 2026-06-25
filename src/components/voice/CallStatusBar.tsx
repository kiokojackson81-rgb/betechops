"use client";

import { useMemo } from "react";
import { useSoftphone } from "@/components/voice/SoftphoneProvider";

function formatElapsed(startedAt: string | null) {
  if (!startedAt) return "00:00";
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export default function CallStatusBar() {
  const softphone = useSoftphone();
  const elapsed = useMemo(() => formatElapsed(softphone.currentCall?.startedAt ?? null), [softphone.currentCall?.startedAt, softphone.state]);

  return (
    <div className="rounded-[22px] border border-white/10 bg-slate-950/80 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Current call state</div>
          <div className="mt-1 truncate text-sm font-semibold text-white">
            {softphone.currentCall ? `${softphone.currentCall.displayName} · ${softphone.currentCall.remoteIdentity}` : "Idle"}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 uppercase tracking-[0.18em]">
            {softphone.stateLabel}
          </span>
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">
            {elapsed}
          </span>
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">
            {softphone.currentCall?.muted ? "Muted" : "Mic live"}
          </span>
        </div>
      </div>
    </div>
  );
}
