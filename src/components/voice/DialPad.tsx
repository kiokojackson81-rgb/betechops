"use client";

import { Delete, Star, Clock3 } from "lucide-react";
import { useSoftphone } from "@/components/voice/SoftphoneProvider";

const DIGITS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"];

export default function DialPad() {
  const softphone = useSoftphone();

  return (
    <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Dial pad</div>
          <div className="mt-1 text-2xl font-semibold tracking-[0.24em] text-white">{softphone.dialedDigits || "Enter number"}</div>
        </div>
        <button
          type="button"
          onClick={softphone.backspaceDigit}
          className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-slate-950/80 text-slate-100 transition hover:border-white/20"
          aria-label="Backspace"
        >
          <Delete className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        {DIGITS.map((digit) => (
          <button
            key={digit}
            type="button"
            onClick={() => {
              softphone.appendDigit(digit);
              if (softphone.currentCall) softphone.sendDtmf(digit);
            }}
            className="rounded-2xl border border-white/10 bg-slate-950/80 px-3 py-4 text-lg font-semibold text-white transition hover:border-cyan-400/40 hover:bg-cyan-500/10"
          >
            {digit}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            <Star className="h-3.5 w-3.5" />
            Favorites
          </div>
          <div className="mt-3 space-y-2">
            {softphone.favoriteNumbers.map((favorite) => (
              <button
                key={favorite.phone}
                type="button"
                onClick={() => softphone.startOutgoingCall(favorite.phone)}
                className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-left transition hover:border-white/20"
              >
                <span className="text-sm font-medium text-white">{favorite.label}</span>
                <span className="whitespace-nowrap text-xs text-slate-400">{favorite.phone}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            <Clock3 className="h-3.5 w-3.5" />
            Recent mock calls
          </div>
          <div className="mt-3 space-y-2">
            {softphone.recentCalls.slice(0, 4).length ? softphone.recentCalls.slice(0, 4).map((call) => (
              <button
                key={call.id}
                type="button"
                onClick={() => softphone.startOutgoingCall(call.remoteIdentity)}
                className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-left transition hover:border-white/20"
              >
                <span className="truncate text-sm font-medium text-white">{call.displayName}</span>
                <span className="whitespace-nowrap text-xs text-slate-400">{call.remoteIdentity}</span>
              </button>
            )) : (
              <div className="rounded-2xl border border-dashed border-white/10 px-3 py-4 text-sm text-slate-500">
                Call history will appear here after mock sessions.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
